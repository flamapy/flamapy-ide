import {
  createWorkerClient,
  installedBackends as backendsOf,
  type WorkerClient,
} from '@flamapy/web-core';
import type { Disposable } from '@flamapy/ide-plugin-api';

import type {
  CatalogService,
  EngineWorkerService,
  FlamapyPluginInfo,
  PythonPluginDescriptor,
} from './services';

// Wheels installed from a URL are remembered so they are re-applied on the next load. The
// key predates v3 — existing users' installed plugins must keep working.
const INSTALLED_PLUGINS_KEY = 'flamapy-ide-installed-plugins';
// The user's decisions about the known flamapy plugins (plugins.conf.json): key ->
// installed. A plugin without a decision follows its `preinstalled` flag. The worker
// boots exactly the resulting set (see public/flamapy/flamapy.js bootPlugins).
const PLUGIN_CHOICES_KEY = 'flamapy-ide-flamapy-plugins';

/** A plugin entry of the served plugins.conf.json. */
interface ConfigPlugin {
  key: string;
  label: string;
  backend: string;
  description: string;
  preinstalled?: boolean;
  available?: boolean;
  note?: string;
  repository?: string;
  wheels: string[];
  pyodidePackages?: string[];
}

function configPlugins(config: unknown): ConfigPlugin[] {
  const plugins = (config as { plugins?: unknown } | null)?.plugins;
  return Array.isArray(plugins) ? (plugins as ConfigPlugin[]) : [];
}

export function loadPluginChoices(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(PLUGIN_CHOICES_KEY);
    const choices = raw ? JSON.parse(raw) : {};
    return choices && typeof choices === 'object' && !Array.isArray(choices) ? choices : {};
  } catch {
    return {};
  }
}

function savePluginChoice(key: string, installed: boolean): void {
  localStorage.setItem(
    PLUGIN_CHOICES_KEY,
    JSON.stringify({ ...loadPluginChoices(), [key]: installed }),
  );
}

// A served wheel ("flamapy/<file>") or an absolute URL as is (as in flamapy.js).
function wheelRef(wheel: string): string {
  return wheel.includes('://') ? wheel : `flamapy/${wheel}`;
}

// Wheel file names are `<distribution>-<version>[-<tags>].whl` (PEP 427).
function wheelFileVersion(ref: string): string | undefined {
  const file = ref.split(/[?#]/)[0]!.split('/').pop() ?? '';
  return /^[^-]+-(\d[^-]*?)(?:-.*)?\.whl$/i.exec(file)?.[1];
}

/**
 * The version of a plugin from its wheels: that of its own flamapy wheel (its dependency
 * wheels, e.g. pysdd, have versions of their own), else of the first wheel.
 */
export function wheelVersion(refs: string[]): string | undefined {
  const own = refs.find((ref) => /^flamapy/i.test(ref.split('/').pop() ?? '')) ?? refs[0];
  return own ? wheelFileVersion(own) : undefined;
}

export function loadInstalledPlugins(): PythonPluginDescriptor[] {
  try {
    const raw = localStorage.getItem(INSTALLED_PLUGINS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveInstalledPlugins(list: PythonPluginDescriptor[]): void {
  localStorage.setItem(INSTALLED_PLUGINS_KEY, JSON.stringify(list));
}

function pluginSignature(descriptor: PythonPluginDescriptor): string {
  return descriptor.key || (descriptor.wheelRefs || []).join('|');
}

export interface WorkerServices {
  worker: EngineWorkerService;
  catalog: CatalogService;
  dispose(): void;
}

/**
 * Builds the worker + catalog services over the framework-free web-core client.
 * Also owns the "re-apply remembered Python plugin installs on every boot" behavior.
 */
export function createWorkerServices(
  client: WorkerClient = createWorkerClient({ pluginChoices: loadPluginChoices }),
): WorkerServices {
  const stateListeners = new Set<() => void>();
  const catalogListeners = new Set<() => void>();
  let lastLoaded = client.getState().isLoaded;
  let lastCatalog = client.getState().pluginCatalog;
  let reapplied = false;

  const unsubscribe = client.onStateChange((state) => {
    if (state.isLoaded !== lastLoaded) {
      lastLoaded = state.isLoaded;
      if (!state.isLoaded) {
        reapplied = false; // a restart resets the worker to the bundled defaults
      }
      for (const listener of [...stateListeners]) listener();
    }
    if (state.pluginCatalog !== lastCatalog) {
      lastCatalog = state.pluginCatalog;
      for (const listener of [...catalogListeners]) listener();
    }
    if (state.isLoaded && !reapplied) {
      reapplied = true;
      void reapplyInstalledPlugins();
    }
  });

  async function reapplyInstalledPlugins(): Promise<void> {
    // Before v3 the extras (sdd, #SAT) were remembered as URL-style descriptors with
    // their key: turn those into choices, so they boot like every other flamapy plugin.
    const known = new Set(configPlugins(client.getState().pluginsConfig).map((plugin) => plugin.key));
    const remembered = loadInstalledPlugins();
    const migrated = remembered.filter((descriptor) => descriptor.key && known.has(descriptor.key));
    if (migrated.length > 0) {
      for (const descriptor of migrated) {
        savePluginChoice(descriptor.key!, true);
      }
      saveInstalledPlugins(remembered.filter((descriptor) => !migrated.includes(descriptor)));
      const booted = new Set(
        ((client.getState().pluginsConfig as { bootedPlugins?: string[] } | null)?.bootedPlugins) ?? [],
      );
      for (const descriptor of migrated) {
        if (!booted.has(descriptor.key!)) {
          await installKnown(descriptor.key!).catch((error) =>
            console.error('Failed to install plugin', descriptor.key, error), // eslint-disable-line no-console
          );
        }
      }
    }
    for (const descriptor of loadInstalledPlugins()) {
      try {
        await client.installPlugin({
          wheelRefs: descriptor.wheelRefs,
          pyodidePackages: descriptor.pyodidePackages,
        });
      } catch (error) {
        console.error('Failed to re-install plugin', descriptor, error); // eslint-disable-line no-console
      }
    }
  }

  async function installKnown(key: string): Promise<void> {
    const plugin = configPlugins(client.getState().pluginsConfig).find((entry) => entry.key === key);
    if (!plugin) {
      throw new Error(`Unknown flamapy plugin '${key}'.`);
    }
    if (plugin.available === false) {
      throw new Error(`${plugin.label} can't run in the browser yet.`);
    }
    await client.installPlugin({
      wheelRefs: plugin.wheels.map(wheelRef),
      pyodidePackages: plugin.pyodidePackages,
    });
  }

  const worker: EngineWorkerService = {
    get isLoaded() {
      return client.getState().isLoaded;
    },
    onStateChange(listener): Disposable {
      stateListeners.add(listener);
      return { dispose: () => void stateListeners.delete(listener) };
    },
    call: (action, data) => client.call(action, data),
    interrupt: () => client.interrupt(),
    restart: () => client.restart(),
    flamapyPlugins(): FlamapyPluginInfo[] {
      const choices = loadPluginChoices();
      const loaded = new Set(backendsOf(client.getState().pluginCatalog));
      return configPlugins(client.getState().pluginsConfig).map((plugin) => ({
        key: plugin.key,
        label: plugin.label,
        backend: plugin.backend,
        description: plugin.description,
        preinstalled: plugin.preinstalled === true,
        available: plugin.available !== false,
        note: plugin.note,
        repository: plugin.repository,
        version: wheelVersion(plugin.wheels),
        installed: plugin.available !== false && (choices[plugin.key] ?? plugin.preinstalled === true),
        loaded: loaded.has(plugin.backend),
      }));
    },
    async installFlamapyPlugin(key) {
      await installKnown(key);
      savePluginChoice(key, true);
    },
    async removeFlamapyPlugin(key) {
      savePluginChoice(key, false);
      client.restart();
    },
    urlPythonPlugins: () => loadInstalledPlugins(),
    async removePythonPlugin(descriptor) {
      const signature = pluginSignature(descriptor);
      saveInstalledPlugins(
        loadInstalledPlugins().filter((entry) => pluginSignature(entry) !== signature),
      );
      client.restart();
    },
    async installPythonPlugin(descriptor) {
      await client.installPlugin({
        wheelRefs: descriptor.wheelRefs,
        pyodidePackages: descriptor.pyodidePackages,
      });
      const list = loadInstalledPlugins();
      const signature = pluginSignature(descriptor);
      if (!list.some((entry) => pluginSignature(entry) === signature)) {
        saveInstalledPlugins([...list, descriptor]);
      }
    },
  };

  const catalog: CatalogService = {
    get catalog() {
      return client.getState().pluginCatalog;
    },
    installedBackends() {
      return backendsOf(client.getState().pluginCatalog);
    },
    onDidChange(listener): Disposable {
      catalogListeners.add(listener);
      return { dispose: () => void catalogListeners.delete(listener) };
    },
  };

  client.start();

  return {
    worker,
    catalog,
    dispose() {
      unsubscribe();
      client.terminate();
    },
  };
}
