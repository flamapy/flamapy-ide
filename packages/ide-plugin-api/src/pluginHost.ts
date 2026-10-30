import { compatibilityProblem } from './manifest';
import { createPluginSettings } from './settings';
import type {
  Disposable,
  FlamapyPlugin,
  PluginContext,
  ServiceRegistry,
  ShellApi,
} from './types';

export type PluginState =
  | 'registered'
  | 'active'
  | 'failed'
  /** A dependency is missing, disabled or not active. */
  | 'skipped'
  | 'deactivated'
  /** Turned off by the user (`setEnabled(id, false)`); remembered across sessions. */
  | 'disabled'
  /** `engines.pluginApi` excludes this IDE's `PLUGIN_API_VERSION`; never activated. */
  | 'incompatible';

/** Where a plugin came from: compiled into the IDE, or loaded from a URL. */
export type PluginSource = { kind: 'builtin' } | { kind: 'remote'; url: string };

export interface PluginRecord {
  plugin: FlamapyPlugin;
  state: PluginState;
  source: PluginSource;
  /** Why the plugin is `failed`, `skipped` or `incompatible`. */
  error?: unknown;
}

export interface PluginHostOptions {
  log?: (message: string, error?: unknown) => void;
  /** A plugin whose `activate` takes longer is marked `failed`. Default 10 s. */
  activationTimeoutMs?: number;
  /** Which plugins the user turned off. Default: in memory, everything enabled. */
  enablement?: {
    isEnabled(id: string): boolean;
    setEnabled(id: string, enabled: boolean): void;
  };
}

/**
 * Registers plugins and runs their lifecycle.
 *
 * - `activateAll` activates every `registered` plugin in dependency order. A cycle
 *   throws (a programming mistake); a missing, disabled, failed or inactive dependency
 *   marks the dependent `skipped`, with the reason in `error`.
 * - A plugin whose `engines.pluginApi` range excludes `PLUGIN_API_VERSION` is recorded
 *   as `incompatible` and never activated.
 * - A plugin whose `activate` throws or times out is isolated: it is marked `failed`,
 *   its partial subscriptions are disposed, and the rest of the workbench keeps going.
 * - `setEnabled`, `reload` and `unregister` act on one plugin at runtime. Deactivating a
 *   plugin first deactivates the active plugins that depend on it (they become
 *   `skipped`); they come back when it is active again.
 * - Deactivation runs `deactivate()`, then disposes the plugin's `subscriptions`
 *   newest first. Module-level state survives: ES modules can't be unloaded.
 */
export class PluginHost {
  private records = new Map<string, PluginRecord>();
  private contexts = new Map<string, PluginContext>();
  private activationOrder: string[] = [];
  private listeners = new Set<(record: PluginRecord) => void>();
  private log: NonNullable<PluginHostOptions['log']>;
  private activationTimeoutMs: number;
  private enablement: NonNullable<PluginHostOptions['enablement']>;

  /**
   * `shell` is either the one ShellApi every plugin gets, or a factory giving each plugin
   * its own (so the shell can tell which plugin registered a contribution).
   */
  constructor(
    private shell: ShellApi | ((pluginId: string) => ShellApi),
    private services: ServiceRegistry,
    options: PluginHostOptions = {},
  ) {
    this.log =
      options.log ?? ((message, error) => console.error(message, error)); // eslint-disable-line no-console
    this.activationTimeoutMs = options.activationTimeoutMs ?? 10_000;
    const disabled = new Set<string>();
    this.enablement = options.enablement ?? {
      isEnabled: (id) => !disabled.has(id),
      setEnabled: (id, enabled) => void (enabled ? disabled.delete(id) : disabled.add(id)),
    };
  }

  /** Adds a plugin (not yet activated). Throws if the id is taken: use `reload` to swap. */
  register(plugin: FlamapyPlugin, options: { source?: PluginSource } = {}): void {
    const { id } = plugin.manifest;
    if (this.records.has(id)) {
      throw new Error(`Plugin '${id}' is already registered.`);
    }
    const record: PluginRecord = {
      plugin,
      state: 'registered',
      source: options.source ?? { kind: 'builtin' },
    };
    this.records.set(id, record);
    this.checkCompatibility(record);
    this.emit(record);
  }

  get(id: string): PluginRecord | undefined {
    return this.records.get(id);
  }

  list(): PluginRecord[] {
    return [...this.records.values()];
  }

  /** Called after every state change of any plugin (for a Plugins panel). */
  onDidChange(listener: (record: PluginRecord) => void): Disposable {
    this.listeners.add(listener);
    return { dispose: () => void this.listeners.delete(listener) };
  }

  isEnabled(id: string): boolean {
    return this.enablement.isEnabled(id);
  }

  async activateAll(): Promise<void> {
    for (const id of this.sorted()) {
      const record = this.records.get(id)!;
      if (record.state !== 'registered') {
        continue;
      }
      if (!this.enablement.isEnabled(id)) {
        this.setState(record, 'disabled');
        continue;
      }
      const problem = this.dependencyProblem(record);
      if (problem) {
        this.setState(record, 'skipped', new Error(problem));
        this.log(`Plugin '${id}' skipped: ${problem}`);
        continue;
      }
      await this.activate(record);
    }
  }

  /** Register + activate one plugin after startup. */
  async activateOne(
    plugin: FlamapyPlugin,
    options: { source?: PluginSource } = {},
  ): Promise<PluginRecord> {
    this.register(plugin, options);
    await this.activatePending();
    return this.records.get(plugin.manifest.id)!;
  }

  /** Turns a plugin off (deactivating it and its dependents) or back on. Persisted. */
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const record = this.require(id);
    this.enablement.setEnabled(id, enabled);
    if (!enabled) {
      if (record.state !== 'incompatible') {
        await this.deactivateTree(id, 'disabled');
      }
      return;
    }
    if (record.state === 'disabled' || record.state === 'deactivated') {
      this.setState(record, 'registered');
    }
    await this.activatePending();
  }

  /**
   * Deactivates the plugin (and its dependents), optionally swaps in a new build of it,
   * and activates it again. The way to retry a failed plugin or upgrade a remote one.
   */
  async reload(id: string, plugin?: FlamapyPlugin): Promise<PluginRecord> {
    const record = this.require(id);
    if (plugin && plugin.manifest.id !== id) {
      throw new Error(`Cannot reload '${id}' with plugin '${plugin.manifest.id}'.`);
    }
    await this.deactivateTree(id, 'deactivated');
    if (plugin) {
      record.plugin = plugin;
    }
    this.setState(record, 'registered');
    this.checkCompatibility(record);
    await this.activatePending();
    return record;
  }

  /** Deactivates the plugin (and its dependents) and forgets it. */
  async unregister(id: string): Promise<void> {
    const record = this.require(id);
    await this.deactivateTree(id, 'deactivated');
    this.records.delete(id);
    this.contexts.delete(id);
    this.emit(record);
    await this.activatePending();
  }

  async deactivateAll(): Promise<void> {
    for (const id of [...this.activationOrder].reverse()) {
      await this.deactivateOne(id, 'deactivated');
    }
  }

  // -- internals ----------------------------------------------------------------------

  private require(id: string): PluginRecord {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Plugin '${id}' is not registered.`);
    }
    return record;
  }

  private emit(record: PluginRecord): void {
    for (const listener of [...this.listeners]) {
      listener(record);
    }
  }

  private setState(record: PluginRecord, state: PluginState, error?: unknown): void {
    record.state = state;
    record.error = error;
    this.emit(record);
  }

  private checkCompatibility(record: PluginRecord): void {
    const problem = compatibilityProblem(record.plugin.manifest);
    if (problem) {
      this.setState(record, 'incompatible', new Error(problem));
      this.log(problem);
    }
  }

  /** Re-evaluates skipped plugins (their dependencies may be back) and activates. */
  private async activatePending(): Promise<void> {
    for (const record of this.records.values()) {
      if (record.state === 'skipped') {
        record.state = 'registered';
      }
    }
    await this.activateAll();
  }

  private dependencyProblem(record: PluginRecord): string | null {
    for (const dependency of record.plugin.manifest.dependencies ?? []) {
      const required = this.records.get(dependency);
      if (!required) {
        return `it depends on '${dependency}', which is not installed.`;
      }
      if (required.state !== 'active') {
        return `its dependency '${dependency}' is ${required.state}.`;
      }
    }
    return null;
  }

  /** Dependency-ordered ids of every registered plugin. Throws on cycles. */
  private sorted(): string[] {
    const order: string[] = [];
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (id: string): void => {
      const record = this.records.get(id);
      if (done.has(id) || !record) {
        return; // a missing dependency is reported by dependencyProblem
      }
      if (visiting.has(id)) {
        throw new Error(`Plugin dependency cycle involving '${id}'.`);
      }
      visiting.add(id);
      for (const dependency of record.plugin.manifest.dependencies ?? []) {
        visit(dependency);
      }
      visiting.delete(id);
      done.add(id);
      order.push(id);
    };
    for (const id of this.records.keys()) {
      visit(id);
    }
    return order;
  }

  private async activate(record: PluginRecord): Promise<void> {
    const { id } = record.plugin.manifest;
    const context: PluginContext = {
      shell: typeof this.shell === 'function' ? this.shell(id) : this.shell,
      services: this.services,
      subscriptions: [],
      settings: createPluginSettings(id),
    };
    this.contexts.set(id, context);
    const activation = Promise.resolve().then(() => record.plugin.activate(context));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`activate() did not finish within ${this.activationTimeoutMs} ms.`)),
        this.activationTimeoutMs,
      );
    });
    try {
      await Promise.race([activation, timeout]);
      this.activationOrder.push(id);
      this.setState(record, 'active');
    } catch (error) {
      this.disposeSubscriptions(context.subscriptions);
      this.setState(record, 'failed', error);
      this.log(`Plugin '${id}' failed to activate.`, error);
      // A timed-out activate may still finish later: undo what it registers then.
      activation.then(
        () => this.disposeSubscriptions(context.subscriptions),
        () => this.disposeSubscriptions(context.subscriptions),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Deactivates the active plugins depending on `id` (they become skipped), then `id`. */
  private async deactivateTree(id: string, state: PluginState): Promise<void> {
    const affected = new Set([id]);
    const dependents: string[] = [];
    for (const active of this.activationOrder) {
      const dependencies = this.records.get(active)!.plugin.manifest.dependencies ?? [];
      if (dependencies.some((dependency) => affected.has(dependency))) {
        affected.add(active);
        dependents.push(active);
      }
    }
    for (const dependent of dependents.reverse()) {
      await this.deactivateOne(
        dependent,
        'skipped',
        new Error(`its dependency '${id}' was turned off.`),
      );
    }
    const record = this.require(id);
    if (this.activationOrder.includes(id)) {
      await this.deactivateOne(id, state);
    } else {
      this.setState(record, state);
    }
  }

  private async deactivateOne(id: string, state: PluginState, error?: unknown): Promise<void> {
    const record = this.records.get(id)!;
    const context = this.contexts.get(id);
    try {
      await record.plugin.deactivate?.();
    } catch (caught) {
      this.log(`Plugin '${id}' failed to deactivate.`, caught);
    }
    if (context) {
      this.disposeSubscriptions(context.subscriptions);
    }
    this.activationOrder = this.activationOrder.filter((active) => active !== id);
    this.setState(record, state, error);
  }

  private disposeSubscriptions(subscriptions: Disposable[]): void {
    for (const subscription of [...subscriptions].reverse()) {
      try {
        subscription.dispose();
      } catch (error) {
        this.log('Error disposing a plugin subscription.', error);
      }
    }
    subscriptions.length = 0;
  }
}
