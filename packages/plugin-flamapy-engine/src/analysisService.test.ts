import { beforeEach, describe, expect, it, vi } from 'vitest';

// localStorage-backed persistence helpers run in node during tests.
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });
});

import { createDocumentStore } from '@flamapy/ide-plugin-api';
import { createAnalysisService } from './analysisService';
import type { EngineWorkerService } from './services';

function fakeWorker(overrides: Partial<EngineWorkerService> = {}): {
  worker: EngineWorkerService;
  calls: Array<{ action: string; data: unknown }>;
} {
  const calls: Array<{ action: string; data: unknown }> = [];
  const worker: EngineWorkerService = {
    isLoaded: true,
    onStateChange: () => ({ dispose() {} }),
    async call(action, data) {
      calls.push({ action, data });
      if (action === 'validateModel') {
        return { valid: true };
      }
      if (action === 'executeFacadeOperation') {
        return { result: JSON.stringify({ ok: true, echo: data }) };
      }
      return null;
    },
    interrupt: () => false,
    restart() {},
    flamapyPlugins: () => [],
    async installFlamapyPlugin() {},
    async removeFlamapyPlugin() {},
    async installPythonPlugin() {},
    urlPythonPlugins: () => [],
    async removePythonPlugin() {},
    ...overrides,
  };
  return { worker, calls };
}

describe('analysis service validation staleness', () => {
  it('ensureValidated reuses the result while the document version is unchanged', async () => {
    const documents = createDocumentStore('features\n\tA');
    const { worker, calls } = fakeWorker();
    const analysis = createAnalysisService({ worker, documents });

    await analysis.ensureValidated();
    await analysis.ensureValidated();
    expect(calls.filter((entry) => entry.action === 'validateModel')).toHaveLength(1);

    documents.setText('features\n\tB', 'editor');
    await analysis.ensureValidated();
    expect(calls.filter((entry) => entry.action === 'validateModel')).toHaveLength(2);
  });

  it('coalesces concurrent ensureValidated callers into one run', async () => {
    const documents = createDocumentStore('x');
    const { worker, calls } = fakeWorker();
    const analysis = createAnalysisService({ worker, documents });
    await Promise.all([analysis.ensureValidated(), analysis.ensureValidated()]);
    expect(calls.filter((entry) => entry.action === 'validateModel')).toHaveLength(1);
  });

  it('reports transport failures through onError and returns null', async () => {
    const documents = createDocumentStore('x');
    const { worker } = fakeWorker({
      call: async () => {
        throw new Error('worker died');
      },
    });
    const onError = vi.fn();
    const analysis = createAnalysisService({ worker, documents, onError });
    expect(await analysis.validateNow()).toBeNull();
    expect(onError).toHaveBeenCalledWith('Validation error', expect.stringContaining('worker died'));
  });
});

describe('analysis service dispatch', () => {
  it('forwards the selected solver only to backend-aware operations', async () => {
    const documents = createDocumentStore('x');
    const { worker, calls } = fakeWorker();
    const analysis = createAnalysisService({ worker, documents });
    analysis.setSelectedSolver('bdd');

    await analysis.runOperation({ label: 'A', method: 'satisfiable', backendAware: true });
    await analysis.runOperation({ label: 'B', method: 'atomic_sets' });

    const [aware, unaware] = calls.filter((entry) => entry.action === 'executeFacadeOperation');
    expect((aware!.data as { args: { backend: string } }).args.backend).toBe('bdd');
    expect((unaware!.data as { args?: unknown }).args ?? {}).toEqual({});
    // The output panel shows the result with the shell's views (OperationResult).
    expect((aware!.data as { asView?: boolean }).asView).toBe(true);
  });

  it('describeError maps KeyboardInterrupt to a friendly message', () => {
    const documents = createDocumentStore('x');
    const { worker } = fakeWorker();
    const analysis = createAnalysisService({ worker, documents });
    expect(analysis.describeError(new Error('KeyboardInterrupt'))).toBe('Operation interrupted.');
  });
});
