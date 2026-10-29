import {
  createWorkerClient,
  installedBackends as backendsOf,
  type WorkerClient,
} from '@flamapy/web-core';
import type { Disposable } from '@flamapy/ide-plugin-api';

import type {
  CatalogService,
  EngineWorkerService,
  PythonPluginDescriptor,
} from './services';

// Runtime-installed Python plugins are remembered so they are re-applied on the next
// load (a fresh Pyodide worker starts with only the bundled defaults). The key predates
// v3 — existing users' installed plugins must keep working.
const INSTALLED_PLUGINS_KEY = 'flamapy-ide-installed-plugins';

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
export function createWorkerServices(client: WorkerClient = createWorkerClient()): WorkerServices {
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
