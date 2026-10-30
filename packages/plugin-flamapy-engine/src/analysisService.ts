import {
  REST,
  executeRestOperation,
  executeRestOperationWithConfig,
  loadBackend,
  loadRestUrl,
  saveBackend,
  saveRestUrl,
} from '@flamapy/web-core';
import type { Disposable, DocumentStore, OperationResult } from '@flamapy/ide-plugin-api';

import type {
  AnalysisService,
  EngineWorkerService,
  OperationAction,
  ValidationResult,
} from './services';

// The REST API returns display text (a value, or a list of lines): a one-column table for
// lists, text otherwise.
function restResultView(label: string, display: unknown): OperationResult {
  return Array.isArray(display)
    ? { kind: 'table', columns: [label], rows: display.map((line) => [line]) }
    : { kind: 'text', value: String(display) };
}

function listenerSet(): { add(l: () => void): Disposable; fire(): void } {
  const listeners = new Set<() => void>();
  return {
    add(listener) {
      listeners.add(listener);
      return { dispose: () => void listeners.delete(listener) };
    },
    fire() {
      for (const listener of [...listeners]) listener();
    },
  };
}

/**
 * Validation, operation dispatch (in-browser WASM or remote flamapy-rest) and the
 * compute-backend/solver selection — extracted from the legacy EditorPage orchestration.
 *
 * Staleness contract (was `lastValidatedCodeRef`): every validation records the document
 * version it ran against; `ensureValidated` revalidates only when the document moved.
 */
export function createAnalysisService(options: {
  worker: EngineWorkerService;
  documents: DocumentStore;
  /** Called when validation fails at the transport level (worker crash etc.). */
  onError?(label: string, message: string): void;
}): AnalysisService & { dispose(): void } {
  const { worker, documents, onError } = options;

  let validation: ValidationResult | null = null;
  let validatedVersion = -1;
  let inflight: Promise<ValidationResult | null> | null = null;
  const validationListeners = listenerSet();

  let computeBackend = loadBackend();
  let restApiUrl = loadRestUrl();
  const computeListeners = listenerSet();

  let selectedSolver = 'sat';
  const solverListeners = listenerSet();

  async function validateNow(): Promise<ValidationResult | null> {
    if (!worker.isLoaded) {
      return null;
    }
    const version = documents.version;
    const text = documents.getText();
    try {
      const result = (await worker.call('validateModel', text)) as ValidationResult;
      validation = result;
      validatedVersion = version;
      validationListeners.fire();
      return result;
    } catch (error) {
      onError?.(
        'Validation error',
        `An exception occurred validating the model: ${(error as Error).message}. ` +
          'Try restarting Flamapy.',
      );
      return null;
    }
  }

  // Forward the selected solver only to backend-aware operations, merged with any
  // argument already collected for the operation.
  function argsFor(action: OperationAction): Record<string, unknown> {
    return action.backendAware
      ? { ...(action.args || {}), backend: selectedSolver }
      : action.args || {};
  }

  function runRest(action: OperationAction, args: Record<string, unknown>): Promise<unknown> {
    return executeRestOperation({
      baseUrl: restApiUrl,
      method: action.method as string,
      modelText: documents.getText(),
      args,
    });
  }

  function describeError(error: unknown): string {
    const message = (error as Error)?.message || '';
    if (message.includes('KeyboardInterrupt')) {
      return 'Operation interrupted.';
    }
    if (computeBackend === REST) {
      return `Remote API error: ${message}`;
    }
    return message ? `Error: ${message}` : 'An exception occurred. Check the model definition.';
  }

  return {
    get validation() {
      return validation;
    },
    onValidationChange: (listener) => validationListeners.add(listener),
    validateNow,
    async ensureValidated() {
      if (validation && validatedVersion === documents.version) {
        return validation;
      }
      // Coalesce concurrent callers onto one validation run.
      if (!inflight) {
        inflight = validateNow().finally(() => {
          inflight = null;
        });
      }
      return inflight;
    },

    getFeatureTree: () => worker.call('getFeatureTree'),
    getFeatures: () => worker.call('getFeatures') as Promise<string[]>,
    getNumericalAttributes: () => worker.call('getNumericalAttributes'),

    async runOperation(action: OperationAction) {
      const args = argsFor(action);
      if (computeBackend === REST) {
        return restResultView(action.label, await runRest(action, args));
      }
      const response = (await worker.call('executeFacadeOperation', {
        ...action,
        args,
        asView: true,
      })) as { result: string };
      return JSON.parse(response.result) as OperationResult;
    },

    async runOperationData(action: OperationAction) {
      const args = argsFor(action);
      if (computeBackend === REST) {
        // The REST API returns the result itself: it is both what to show and the data.
        const result = await runRest(action, args);
        return { display: result, data: result };
      }
      const response = (await worker.call('executeFacadeOperation', {
        ...action,
        args,
        withData: true,
      })) as { result: string };
      return JSON.parse(response.result) as { display: unknown; data: unknown };
    },

    async runOperationWithConfig(action, configuration) {
      if (computeBackend === REST) {
        return executeRestOperationWithConfig({
          baseUrl: restApiUrl,
          method: action.method as string,
          modelText: documents.getText(),
          configMapping: configuration,
          args: action.args || {},
        });
      }
      const configs = { configuration_path: configuration };
      const response = (await worker.call('executeFacadeOperationWithConfig', {
        action,
        configs,
      })) as { result: string };
      return JSON.parse(response.result);
    },

    exportModel: (format) => worker.call('downloadFile', { value: format }) as Promise<string>,

    describeError,

    get computeBackend() {
      return computeBackend;
    },
    get restApiUrl() {
      return restApiUrl;
    },
    setComputeBackend(backend) {
      computeBackend = backend;
      saveBackend(backend);
      computeListeners.fire();
    },
    setRestApiUrl(url) {
      restApiUrl = url;
      saveRestUrl(url);
      computeListeners.fire();
    },
    onComputeBackendChange: (listener) => computeListeners.add(listener),

    get selectedSolver() {
      return selectedSolver;
    },
    setSelectedSolver(solver) {
      if (solver === selectedSolver) return;
      selectedSolver = solver;
      solverListeners.fire();
    },
    onSelectedSolverChange: (listener) => solverListeners.add(listener),

    dispose() {},
  };
}
