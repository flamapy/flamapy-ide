import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });
});

import type { WorkerClient, WorkerClientState } from '@flamapy/web-core';
import { createWorkerServices } from './workerService';

function fakeClient() {
  let state: WorkerClientState = { isLoaded: false, pluginsConfig: null, pluginCatalog: null };
  const listeners = new Set<(state: WorkerClientState) => void>();
  const installs: unknown[] = [];
  const restarts: number[] = [];
  const client: WorkerClient = {
    start() {},
    getState: () => state,
    onStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    call: async () => null,
    async installPlugin(data) {
      installs.push(data);
      return null;
    },
    interrupt: () => false,
    restart() {
      restarts.push(Date.now());
    },
    terminate() {},
  };
  return {
    client,
    installs,
    restarts,
    emit(next: Partial<WorkerClientState>) {
      state = { ...state, ...next };
      for (const listener of [...listeners]) listener(state);
    },
  };
}

describe('worker services', () => {
  it('re-applies remembered Python plugin installs when the worker loads', async () => {
    storage.set(
      'flamapy-ide-installed-plugins',
      JSON.stringify([{ wheelRefs: ['a.whl'], key: 'sharpsat' }]),
    );
    const { client, installs, emit } = fakeClient();
    createWorkerServices(client);
    emit({ isLoaded: true });
    await Promise.resolve(); // let the async re-apply run
    expect(installs).toEqual([{ wheelRefs: ['a.whl'], pyodidePackages: undefined }]);
  });

  it('re-applies again after a restart cycle (fresh worker has only bundled defaults)', async () => {
    storage.set('flamapy-ide-installed-plugins', JSON.stringify([{ wheelRefs: ['a.whl'] }]));
    const { client, installs, emit } = fakeClient();
    createWorkerServices(client);
    emit({ isLoaded: true });
    await Promise.resolve();
    emit({ isLoaded: false }); // restart
    emit({ isLoaded: true });
    await Promise.resolve();
    expect(installs).toHaveLength(2);
  });

  it('installPythonPlugin persists new descriptors once (deduplicated by signature)', async () => {
    const { client, emit } = fakeClient();
    const services = createWorkerServices(client);
    emit({ isLoaded: true });
    await services.worker.installPythonPlugin({ wheelRefs: ['x.whl'], key: 'x' });
    await services.worker.installPythonPlugin({ wheelRefs: ['x.whl'], key: 'x' });
    const remembered = JSON.parse(storage.get('flamapy-ide-installed-plugins')!);
    expect(remembered).toHaveLength(1);
  });

  it('exposes catalog changes to subscribers', () => {
    const { client, emit } = fakeClient();
    const services = createWorkerServices(client);
    const listener = vi.fn();
    services.catalog.onDidChange(listener);
    emit({ pluginCatalog: { plugins: [], operations: [] } });
    expect(listener).toHaveBeenCalledOnce();
    expect(services.catalog.catalog).toEqual({ plugins: [], operations: [] });
  });

  describe('flamapy plugins (preinstalled and extras alike)', () => {
    const config = {
      core: { wheels: [] },
      plugins: [
        { key: 'sat', label: 'SAT', backend: 'sat', description: 'd', preinstalled: true, available: true, wheels: ['flamapy_sat-2.6.0.whl'], pyodidePackages: ['python-sat'] },
        { key: 'z3', label: 'Z3', backend: 'z3', description: 'd', preinstalled: true, available: true, wheels: ['flamapy_z3-2.6.0.whl'] },
        { key: 'sdd', label: 'SDD', backend: 'sdd', description: 'd', preinstalled: false, available: true, wheels: ['pysdd.whl', 'flamapy_sdd.whl'] },
        { key: 'dnnf', label: 'd-DNNF', backend: 'dnnf', description: 'd', preinstalled: false, available: false, wheels: [] },
      ],
      bootedPlugins: ['sat', 'z3'],
    };
    const catalog = { plugins: [{ backend: 'sat' }, { backend: 'z3' }], operations: [] };

    it('lists every plugin with whether it is installed and loaded', () => {
      const { client, emit } = fakeClient();
      const services = createWorkerServices(client);
      expect(services.worker.flamapyPlugins()).toEqual([]);
      emit({ isLoaded: true, pluginsConfig: config, pluginCatalog: catalog });
      expect(
        services.worker.flamapyPlugins().map(({ key, installed, loaded, preinstalled, available }) => ({
          key, installed, loaded, preinstalled, available,
        })),
      ).toEqual([
        { key: 'sat', installed: true, loaded: true, preinstalled: true, available: true },
        { key: 'z3', installed: true, loaded: true, preinstalled: true, available: true },
        { key: 'sdd', installed: false, loaded: false, preinstalled: false, available: true },
        { key: 'dnnf', installed: false, loaded: false, preinstalled: false, available: false },
      ]);
    });

    it('removes a preinstalled plugin by restarting the engine without it', async () => {
      const { client, emit, restarts } = fakeClient();
      const services = createWorkerServices(client);
      emit({ isLoaded: true, pluginsConfig: config, pluginCatalog: catalog });
      await services.worker.removeFlamapyPlugin('z3');
      expect(JSON.parse(storage.get('flamapy-ide-flamapy-plugins')!)).toEqual({ z3: false });
      expect(restarts).toHaveLength(1);
      expect(services.worker.flamapyPlugins().find((plugin) => plugin.key === 'z3')?.installed).toBe(false);
    });

    it('installs an extra now, from its served wheels, and remembers it', async () => {
      const { client, emit, installs } = fakeClient();
      const services = createWorkerServices(client);
      emit({ isLoaded: true, pluginsConfig: config, pluginCatalog: catalog });
      await services.worker.installFlamapyPlugin('sdd');
      expect(installs.at(-1)).toEqual({
        wheelRefs: ['flamapy/pysdd.whl', 'flamapy/flamapy_sdd.whl'],
        pyodidePackages: undefined,
      });
      expect(JSON.parse(storage.get('flamapy-ide-flamapy-plugins')!)).toEqual({ sdd: true });
      await expect(services.worker.installFlamapyPlugin('dnnf')).rejects.toThrow(/browser/);
    });

    it('migrates extras remembered the old way into choices, keeping URL wheels as they are', async () => {
      storage.set(
        'flamapy-ide-installed-plugins',
        JSON.stringify([
          { wheelRefs: ['flamapy/pysdd.whl', 'flamapy/flamapy_sdd.whl'], key: 'sdd' },
          { wheelRefs: ['https://example.org/fmcooler.whl'], key: 'fmcooler' },
        ]),
      );
      const { client, emit, installs } = fakeClient();
      createWorkerServices(client);
      emit({ isLoaded: true, pluginsConfig: config, pluginCatalog: catalog });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(JSON.parse(storage.get('flamapy-ide-flamapy-plugins')!)).toEqual({ sdd: true });
      expect(JSON.parse(storage.get('flamapy-ide-installed-plugins')!)).toEqual([
        { wheelRefs: ['https://example.org/fmcooler.whl'], key: 'fmcooler' },
      ]);
      // sdd did not boot this time (old storage), so it is installed now; fmcooler re-applied.
      expect(installs).toEqual([
        { wheelRefs: ['flamapy/pysdd.whl', 'flamapy/flamapy_sdd.whl'], pyodidePackages: undefined },
        { wheelRefs: ['https://example.org/fmcooler.whl'], pyodidePackages: undefined },
      ]);
    });

    it('forgets a wheel installed from a URL and restarts without it', async () => {
      storage.set('flamapy-ide-installed-plugins', JSON.stringify([{ wheelRefs: ['https://x/a.whl'] }]));
      const { client, restarts } = fakeClient();
      const services = createWorkerServices(client);
      expect(services.worker.urlPythonPlugins()).toHaveLength(1);
      await services.worker.removePythonPlugin({ wheelRefs: ['https://x/a.whl'] });
      expect(services.worker.urlPythonPlugins()).toEqual([]);
      expect(restarts).toHaveLength(1);
    });
  });
});
