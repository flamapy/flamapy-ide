/**
 * The engine plugin's service surface. View plugins (and the shell, during migration)
 * consume these through the service registry — none of them touch the Pyodide worker or
 * the REST client directly.
 */
import { serviceId, type Disposable } from '@flamapy/ide-plugin-api';

// ---------------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------------

export interface EngineWorkerService {
  readonly isLoaded: boolean;
  onStateChange(listener: () => void): Disposable;
  call(action: string, data?: unknown): Promise<unknown>;
  /** Raise KeyboardInterrupt in the running operation; false = no SAB, use restart(). */
  interrupt(): boolean;
  restart(): void;
  /** Install a Python wheel plugin at runtime and persist it for future sessions. */
  installPythonPlugin(descriptor: PythonPluginDescriptor): Promise<void>;
}

export interface PythonPluginDescriptor {
  wheelRefs?: string[];
  pyodidePackages?: string[];
  key?: string;
  label?: string;
}

export const EngineWorker = serviceId<EngineWorkerService>('flamapy.engine.worker');

// ---------------------------------------------------------------------------------
// Capability catalog
// ---------------------------------------------------------------------------------

export interface CatalogService {
  /** The raw capability catalog the Python bridge reports (null while loading). */
  readonly catalog: unknown;
  installedBackends(): string[];
  onDidChange(listener: () => void): Disposable;
}

export const Catalog = serviceId<CatalogService>('flamapy.engine.catalog');

// ---------------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[] | string;
  [key: string]: unknown;
}

export interface OperationAction {
  label: string;
  method?: string;
  backendAware?: boolean;
  args?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AnalysisService {
  /** Result for the document text it was computed against (null = not yet validated). */
  readonly validation: ValidationResult | null;
  onValidationChange(listener: () => void): Disposable;
  /** Validate the current document text now (bypasses the debounce). */
  validateNow(): Promise<ValidationResult | null>;
  /**
   * The validation for the *current* document text: reuses the last result when the
   * document has not changed since, otherwise revalidates first.
   */
  ensureValidated(): Promise<ValidationResult | null>;

  getFeatureTree(): Promise<unknown>;
  getFeatures(): Promise<string[]>;
  getNumericalAttributes(): Promise<unknown>;

  /**
   * Run a catalog operation on the current model and get both its display text and its
   * raw result as plain JSON (`data`). For IDE plugins that compute on flamapy results.
   */
  runOperationData(action: OperationAction): Promise<{ display: unknown; data: unknown }>;
  /** Run a catalog operation on the current model (WASM or REST per the setting). */
  runOperation(action: OperationAction): Promise<unknown>;
  runOperationWithConfig(
    action: OperationAction,
    configuration: Record<string, unknown>,
  ): Promise<unknown>;
  /** Serialize the current model to another format (afm, json, sxfm, ...). */
  exportModel(format: string): Promise<string>;

  /** Turn a worker/REST failure into a user-actionable message. */
  describeError(error: unknown): string;

  /** Compute backend selection (in-browser WASM vs remote flamapy-rest). */
  readonly computeBackend: string;
  readonly restApiUrl: string;
  setComputeBackend(backend: string): void;
  setRestApiUrl(url: string): void;
  onComputeBackendChange(listener: () => void): Disposable;

  /** The solver the analysis menus target; backend-aware operations forward it. */
  readonly selectedSolver: string;
  setSelectedSolver(solver: string): void;
  onSelectedSolverChange(listener: () => void): Disposable;
}

export const Analysis = serviceId<AnalysisService>('flamapy.engine.analysis');

// ---------------------------------------------------------------------------------
// Configurator sessions (the wizard drives these)
// ---------------------------------------------------------------------------------

export interface ConfiguratorService {
  start(): Promise<unknown>;
  answerQuestion(answer: unknown): Promise<unknown>;
  undoAnswer(): Promise<unknown>;
}

export const Configurator = serviceId<ConfiguratorService>('flamapy.engine.configurator');

// ---------------------------------------------------------------------------------
// Well-known engine commands (registered on the shell command bus)
// ---------------------------------------------------------------------------------

export const OPEN_BACKEND_SETTINGS = 'flamapy.engine.openBackendSettings';
export const OPEN_PLUGIN_MANAGER = 'flamapy.engine.openPluginManager';
