/**
 * The engine plugin's service surface. View plugins (and the shell, during migration)
 * consume these through the service registry — none of them touch the Pyodide worker or
 * the REST client directly.
 */
import { serviceId, type Disposable, type OperationResult } from '@flamapy/ide-plugin-api';

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

  /**
   * The flamapy plugins the IDE knows (plugins.conf.json): the preinstalled solvers and
   * the installable extras, all handled the same way. Empty until the engine has loaded.
   */
  flamapyPlugins(): FlamapyPluginInfo[];
  /** Install a known flamapy plugin now, and keep it installed in future sessions. */
  installFlamapyPlugin(key: string): Promise<void>;
  /**
   * Remove a flamapy plugin (preinstalled or not) and remember it. Python modules can't
   * be unloaded, so the engine restarts without it.
   */
  removeFlamapyPlugin(key: string): Promise<void>;

  /** Install a Python wheel plugin from a URL at runtime and persist it for future sessions. */
  installPythonPlugin(descriptor: PythonPluginDescriptor): Promise<void>;
  /** The wheels installed with `installPythonPlugin`, oldest first. */
  urlPythonPlugins(): PythonPluginDescriptor[];
  /** Forget a wheel installed from a URL; the engine restarts without it. */
  removePythonPlugin(descriptor: PythonPluginDescriptor): Promise<void>;
}

/** A flamapy plugin from plugins.conf.json, with its state in this IDE. */
export interface FlamapyPluginInfo {
  key: string;
  label: string;
  /** The solver backend token it adds, e.g. `sat`. */
  backend: string;
  description: string;
  /** Installed out of the box (the user can still remove it). */
  preinstalled: boolean;
  /** False when no Pyodide build exists yet: listed, not installable. */
  available: boolean;
  note?: string;
  /** Source code of the plugin (https). */
  repository?: string;
  /** Version of the plugin's own wheel (e.g. `2.6.0`), when the served file name has one. */
  version?: string;
  /** Installed, by the user's choice or by default: boots with the engine. */
  installed: boolean;
  /** Loaded in the running engine (its backend is in the catalog). */
  loaded: boolean;
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
  /**
   * Run a catalog operation on the current model (WASM or REST per the setting) and get
   * its result as the shell shows it (a table, configurations, text, ...).
   */
  runOperation(action: OperationAction): Promise<OperationResult>;
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
