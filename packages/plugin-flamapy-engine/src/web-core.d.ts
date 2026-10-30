// Minimal typings for the (JavaScript) @flamapy/web-core package — only the surface the
// engine plugin consumes.
declare module '@flamapy/web-core' {
  export interface WorkerClientState {
    isLoaded: boolean;
    pluginsConfig: unknown;
    pluginCatalog: unknown;
  }
  export interface WorkerClient {
    start(): void;
    getState(): WorkerClientState;
    onStateChange(listener: (state: WorkerClientState) => void): () => void;
    call(action: string, data?: unknown): Promise<unknown>;
    installPlugin(data: {
      wheelRefs?: string[];
      pyodidePackages?: string[];
    }): Promise<unknown>;
    interrupt(): boolean;
    restart(): void;
    terminate(): void;
  }
  export function createWorkerClient(options?: {
    workerUrl?: string;
    createWorker?: (url: string) => Worker;
    pluginChoices?: () => Record<string, boolean>;
  }): WorkerClient;

  export const WASM: string;
  export const REST: string;
  export function loadBackend(): string;
  export function saveBackend(backend: string): void;
  export function loadRestUrl(): string;
  export function saveRestUrl(url: string): void;
  export function executeRestOperation(options: {
    baseUrl: string;
    method: string;
    modelText: string;
    args?: Record<string, unknown>;
  }): Promise<unknown>;
  export function executeRestOperationWithConfig(options: {
    baseUrl: string;
    method: string;
    modelText: string;
    configMapping: Record<string, unknown>;
    args?: Record<string, unknown>;
  }): Promise<unknown>;

  export function solverOptionsFromCatalog(catalog: unknown): Array<{ value: string; label: string }>;
  export function installedBackends(catalog: unknown): string[];
  export function structuralOperationsFromCatalog(catalog: unknown): unknown[];
  export function analysisOperationsForSolver(catalog: unknown, solver: string): unknown[];
}
