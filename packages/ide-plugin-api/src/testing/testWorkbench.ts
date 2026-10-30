import { StrictMode, act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { validateManifest } from '../manifest';
import type { PluginRecord } from '../pluginHost';
import type {
  DocumentChange,
  DocumentStore,
  FlamapyPlugin,
  OperationResult,
  PluginContext,
  ServiceRegistry,
  ShellApi,
} from '../types';
import { createWorkbench, type Workbench } from '../workbench/createWorkbench';
import { installDomPolyfills } from './polyfills';

export interface TestWorkbenchOptions {
  /** Initial UVL text of the shell document. */
  document?: string;
}

export interface RenderedView {
  id: string;
  /** The element the view's component is rendered into (attached to `document.body`). */
  container: HTMLElement;
}

export interface TestWorkbench {
  /** The real headless workbench the IDE runs, for anything the helpers don't cover. */
  workbench: Workbench;
  shell: ShellApi;
  services: ServiceRegistry;
  document: DocumentStore;
  /** Every document change since the workbench was created, oldest first. */
  history: DocumentChange[];
  /** Everything passed to `shell.output.show`, oldest first. */
  outputs: { label: string; result: unknown }[];
  /** Every progress update reported by operations run with `runOperation`, oldest first. */
  progress: { message?: string; fraction?: number }[];
  /** Every modal opened with `shell.modals.open`, oldest first. */
  modals: ((close: () => void) => ReactNode)[];
  /** The active view id; starts at `'source'` like the IDE. */
  activeView(): string | null;
  /**
   * Registers the plugins and activates them in dependency order. Rejects, with the
   * reason, if a manifest is invalid or any of them does not end up `active`.
   */
  activate(...plugins: FlamapyPlugin[]): Promise<PluginRecord[]>;
  /**
   * Opens a view the way the IDE does (`shell.views.open`, so `onBeforeOpen` gates it),
   * renders its component in `<StrictMode>` and then fires `onDidChangeActive`. Rejects
   * when the view is unknown or its gate refuses. Needs a DOM (jsdom) environment.
   */
  openView(id: string): Promise<RenderedView>;
  /**
   * Runs code that changes what views show (document edits, clicks, commands) inside
   * React's `act`, and resolves once the views have re-rendered.
   */
  update(change: () => unknown): Promise<void>;
  /**
   * Runs a contributed operation the way the shell does after its input form: rejects if
   * `args` misses a required input or has a key no input declares. Pass `signal` to
   * test cancellation.
   */
  runOperation(
    id: string,
    args?: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<OperationResult | void>;
  /**
   * Unmounts every view and deactivates every plugin, then rejects if a view, sidebar
   * panel, toolbar menu, status-bar item or command is still registered: everything a
   * plugin registers must be disposed (push it into `ctx.subscriptions`).
   */
  dispose(): Promise<void>;
}

/** A minimal plugin standing in for a dependency, e.g. `stubPlugin('flamapy.engine', ...)`. */
export function stubPlugin(
  id: string,
  activate: (ctx: PluginContext) => void | Promise<void> = () => {},
): FlamapyPlugin {
  return { manifest: { id, name: `${id} (stub)`, version: '0.0.0' }, activate };
}

function describeRecord(record: PluginRecord): string {
  const reason = record.error instanceof Error ? `: ${record.error.message}` : '';
  return `Plugin '${record.plugin.manifest.id}' is ${record.state}${reason}`;
}

/**
 * A workbench for plugin tests: the IDE's real shell core with a minimal renderer for
 * views, plus recordings of what the plugin did (document history, outputs, modals).
 */
export function createTestWorkbench(options: TestWorkbenchOptions = {}): TestWorkbench {
  installDomPolyfills();
  const workbench = createWorkbench(options.document ?? '');
  const history: DocumentChange[] = [];
  const outputs: { label: string; result: unknown }[] = [];
  const modals: ((close: () => void) => ReactNode)[] = [];
  const progress: { message?: string; fraction?: number }[] = [];
  const mounted = new Map<string, { root: Root; container: HTMLElement }>();
  let active: string | null = 'source';

  workbench.documents.onDidChange((change) => void history.push(change));

  function mount(id: string): void {
    const view = workbench.stores.views.get(id);
    if (!view || mounted.has(id)) {
      return;
    }
    const container = document.createElement('div');
    container.dataset.viewId = id;
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(createElement(StrictMode, null, createElement(view.component))));
    mounted.set(id, { root, container });
  }

  function unmount(id: string): void {
    const entry = mounted.get(id);
    if (!entry) {
      return;
    }
    act(() => entry.root.unmount());
    entry.container.remove();
    mounted.delete(id);
  }

  workbench.delegates.showOutput = (label, result) => void outputs.push({ label, result });
  workbench.delegates.openModal = (render) => void modals.push(render);
  workbench.delegates.getActiveView = () => active;
  // Like the IDE: switch, render, and only then tell listeners (after render).
  workbench.delegates.setActiveView = (id) => {
    if (id === active) {
      return;
    }
    if (active !== null && !workbench.stores.views.get(active)?.keepMounted) {
      unmount(active);
    }
    active = id;
    mount(id);
    act(() => workbench.notifyActiveViewChanged(id));
  };

  return {
    workbench,
    shell: workbench.shell,
    services: workbench.services,
    document: workbench.documents,
    history,
    outputs,
    modals,
    progress,
    activeView: () => active,

    async activate(...plugins) {
      for (const plugin of plugins) {
        const problems = validateManifest(plugin.manifest);
        if (problems.length > 0) {
          throw new Error(
            `Plugin '${String(plugin.manifest?.id)}' has an invalid manifest: ${problems.join('; ')}.`,
          );
        }
        workbench.host.register(plugin);
      }
      await workbench.host.activateAll();
      const records = plugins.map((plugin) => workbench.host.get(plugin.manifest.id)!);
      const inactive = records.filter((record) => record.state !== 'active');
      if (inactive.length > 0) {
        throw new Error(inactive.map(describeRecord).join('\n'));
      }
      return records;
    },

    async openView(id) {
      const view = workbench.stores.views.get(id);
      if (!view) {
        throw new Error(`View '${id}' is not registered.`);
      }
      const before = outputs.length;
      if (!(await workbench.shell.views.open(id))) {
        const gate = outputs.slice(before).find((output) => output.label === view.title);
        throw new Error(
          `View '${id}' refused to open${gate ? `: ${String(gate.result)}` : ''}.`,
        );
      }
      return { id, container: mounted.get(id)!.container };
    },

    async runOperation(id, args = {}, options = {}) {
      const operation = workbench.stores.operations.get(id);
      if (!operation) {
        throw new Error(`Operation '${id}' is not registered.`);
      }
      const declared = new Set((operation.inputs ?? []).map((input) => input.name));
      const unknown = Object.keys(args).filter((name) => !declared.has(name));
      const missing = (operation.inputs ?? [])
        .filter((input) => input.required && (args[input.name] ?? '') === '')
        .map((input) => input.name);
      if (unknown.length > 0 || missing.length > 0) {
        throw new Error(
          `Operation '${id}': ` +
            [
              unknown.length > 0 ? `no input named ${unknown.join(', ')}` : '',
              missing.length > 0 ? `missing required ${missing.join(', ')}` : '',
            ]
              .filter(Boolean)
              .join('; ') +
            '.',
        );
      }
      let result: OperationResult | void = undefined;
      await act(async () => {
        result = await operation.run(args, {
          signal: options.signal ?? new AbortController().signal,
          progress: (update) => void progress.push(update),
        });
      });
      return result;
    },

    async update(change) {
      await act(async () => {
        await change();
      });
    },

    async dispose() {
      for (const id of [...mounted.keys()]) {
        unmount(id);
      }
      await workbench.host.deactivateAll();
      const { views, sidebarPanels, toolbarMenus, menuItems, operations, statusBarItems } =
        workbench.stores;
      const leftovers = [
        ...views.getSnapshot().map((item) => `view '${item.id}'`),
        ...sidebarPanels.getSnapshot().map((item) => `sidebar panel '${item.id}'`),
        ...toolbarMenus.getSnapshot().map((item) => `toolbar menu '${item.id}'`),
        ...menuItems.getSnapshot().map((item) => `menu item '${item.id}'`),
        ...operations.getSnapshot().map((item) => `operation '${item.id}'`),
        ...statusBarItems.getSnapshot().map((item) => `status-bar item '${item.id}'`),
        ...workbench.commands.ids().map((id) => `command '${id}'`),
      ];
      if (leftovers.length > 0) {
        throw new Error(
          `Still registered after deactivation (push each Disposable into ctx.subscriptions): ` +
            `${leftovers.join(', ')}.`,
        );
      }
    },
  };
}
