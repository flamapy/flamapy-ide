/**
 * The flamapy-ide plugin contract.
 *
 * A plugin is `{ manifest, activate }`. The manifest is identity-only (id, name, version,
 * dependencies); every contribution — views, toolbar menus, status-bar items, commands,
 * services — is registered imperatively inside `activate(ctx)` and undone by disposing
 * what the registration returned. There is no declarative contribution schema: all
 * plugins activate at workbench startup, and contributions derived from runtime state
 * (e.g. the Python operation catalog) register and dispose dynamically.
 */
import type { ComponentType, ReactNode } from 'react';

export interface Disposable {
  dispose(): void;
}

export interface PluginManifest {
  /** Globally unique, stable id, e.g. `flamapy.engine` or `acme.my-tool`. */
  id: string;
  name: string;
  version: string;
  /** Plugin ids that must activate before this one. */
  dependencies?: string[];
  /**
   * The IDE plugin API semver range the plugin was built against, e.g. `'^1.0.0'`. The host
   * marks a plugin whose range excludes `PLUGIN_API_VERSION` as `incompatible` instead
   * of activating it. Required for remote plugins; built-in plugins are type-checked
   * with the IDE and may omit it.
   */
  engines?: { pluginApi?: string };

  // Attribution: shown wherever the IDE lists plugins, so the work behind a plugin is
  // credited, linkable and citable. All optional; fill in what applies.

  /** One or two sentences on what the plugin adds to the IDE. */
  description?: string;
  authors?: PluginAuthor[];
  /** Source code URL (https), e.g. the GitHub repository. */
  repository?: string;
  /** Project or tool page (https), if it differs from the repository. */
  homepage?: string;
  /** SPDX license identifier, e.g. `MIT` or `LGPL-3.0-or-later`. */
  license?: string;
  /**
   * The tool's logo, roughly square: an `https:` URL or a `data:` URI. Remote plugins can
   * use `new URL('./logo.svg', import.meta.url).href`; bundled plugins can inline it.
   */
  logo?: string;
  /** How to cite the work behind the plugin: a paper, or a software DOI. */
  citation?: PluginCitation;
}

export interface PluginAuthor {
  name: string;
  affiliation?: string;
  /** Personal or group page (https). */
  url?: string;
  /** ORCID iD, e.g. `0000-0002-1825-0097`. */
  orcid?: string;
}

export interface PluginCitation {
  /** Human-readable reference, e.g. `Doe, J. (2026). MyTool: ... In SPLC '26.` */
  text: string;
  /** Bare DOI, e.g. `10.1145/1234567.1234568`. */
  doi?: string;
  url?: string;
  bibtex?: string;
}

export interface FlamapyPlugin {
  manifest: PluginManifest;
  activate(ctx: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

export interface PluginContext {
  shell: ShellApi;
  services: ServiceRegistry;
  /** Disposed automatically (in reverse order) when the plugin deactivates. */
  subscriptions: Disposable[];
  /** localStorage-backed key/value settings, namespaced by the plugin id. */
  settings: PluginSettings;
}

export interface PluginSettings {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
}

// ---------------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------------

/**
 * A branded service key: carries the service's interface type so `registry.get(Id)`
 * returns it fully typed. Create with `serviceId<MyService>('my.service.id')`.
 */
export type ServiceId<T> = string & { readonly __serviceType?: T };

export function serviceId<T>(id: string): ServiceId<T> {
  return id as ServiceId<T>;
}

export interface ServiceRegistry {
  provide<T>(id: ServiceId<T>, implementation: T): Disposable;
  /** Throws if the service is not (yet) provided. */
  get<T>(id: ServiceId<T>): T;
  tryGet<T>(id: ServiceId<T>): T | undefined;
  /** Resolves immediately if provided, otherwise when `provide` is first called. */
  whenAvailable<T>(id: ServiceId<T>): Promise<T>;
}

// ---------------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------------

export interface DocumentChange {
  text: string;
  version: number;
  /** Who produced the change: 'editor', 'import', 'collab', a plugin's id, ... */
  origin: string;
}

/** The shell-owned UVL document. Single instance today; the API leaves room for more. */
export interface DocumentStore {
  getText(): string;
  readonly version: number;
  readonly dirty: boolean;
  setText(text: string, origin: string): void;
  markSaved(): void;
  onDidChange(listener: (change: DocumentChange) => void): Disposable;
}

// ---------------------------------------------------------------------------------
// Shell contributions
// ---------------------------------------------------------------------------------

export interface ViewDescriptor {
  /** Unique view id, e.g. `flamapy.view.graph`. Also the tab identity. */
  id: string;
  title: string;
  /** Icon element rendered in the tab strip / activity bar (optional). */
  icon?: ReactNode;
  /** The main-panel component. Services arrive via the plugin's activate closure. */
  component: ComponentType;
  /** Dynamic views appear as a tab only while open (e.g. Pareto front). */
  dynamic?: boolean;
  /** Keep the component mounted (hidden) when another view is active (e.g. monaco). */
  keepMounted?: boolean;
  /** Gate opening (e.g. "model must be valid"). Rejecting keeps the current view. */
  onBeforeOpen?(): Promise<{ ok: boolean; message?: string }>;
  /** Sort order in the tab strip; lower first. Defaults to registration order. */
  order?: number;
}

/**
 * A side panel. Each panel gets a button in the activity bar; each side shows one panel at
 * a time. The shell draws the frame (header with the title, move and close buttons, and a
 * resizable width): `component` renders the content only, filling the frame.
 */
export interface SidebarPanelDescriptor {
  id: string;
  /** Shown in the panel header and as the activity-bar tooltip. */
  title: string;
  /** Where the panel opens by default. Users can move it to the other side. */
  side: 'left' | 'right';
  /** The activity-bar icon, about 20 px (e.g. an inline SVG); default: the title's initials. */
  icon?: ReactNode;
  component: ComponentType;
  /** Order in the activity bar, within its side; lower first. */
  order?: number;
}

export interface ToolbarActionDescriptor {
  id: string;
  label: string;
  /** Executed on click. Prefer `commands.execute` for cross-plugin actions. */
  run(): void | Promise<void>;
  disabled?: boolean;
  title?: string;
}

export interface ToolbarMenuDescriptor {
  id: string;
  label: string;
  actions: ToolbarActionDescriptor[];
  order?: number;
}

/** The built-in toolbar menus plugins can add items to. */
export type ShellMenuId = 'structural' | 'analysis' | 'export';

/**
 * An item a plugin adds to one of the built-in toolbar menus. The shell lists plugin
 * items after the built-in ones, under the contributing plugin's name.
 */
export interface MenuItemDescriptor {
  /** Unique item id, e.g. `acme.tool.optimize`. */
  id: string;
  menu: ShellMenuId;
  label: string;
  /** Tooltip. */
  title?: string;
  run(): void | Promise<void>;
  disabled?: boolean;
  /** Sort order among this plugin's items; lower first. */
  order?: number;
  /**
   * `analysis` menu only: show the item only while one of these solvers (backend tokens
   * such as `sat`, `bdd`) is selected. Omitted: always shown.
   */
  backends?: string[];
}

// ---------------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------------

interface InputBase {
  /** Key of the value in the `args` passed to `run`. */
  name: string;
  /** Field label in the shell's input form. */
  label: string;
  /** Default: false (the form accepts an empty value). */
  required?: boolean;
}

/**
 * One input of an operation. The shell renders a form field per input: a number field,
 * a text field, a checkbox, a feature or attribute picker (filled from the current
 * model), or a choice list.
 */
export type InputSpec =
  | (InputBase & { kind: 'integer' | 'number'; min?: number; max?: number; default?: number })
  | (InputBase & { kind: 'string'; default?: string })
  | (InputBase & { kind: 'boolean'; default?: boolean })
  /** A feature of the model (`string`), or several (`string[]`). */
  | (InputBase & { kind: 'feature' | 'features' })
  /** A numerical attribute of the model (`string`), or several (`string[]`). */
  | (InputBase & { kind: 'attribute' | 'attributes' })
  | (InputBase & { kind: 'enum'; options: { value: string; label: string }[]; default?: string });

/** A configuration in an operation result. */
export interface ResultConfiguration {
  /** Selected features; a typed feature as `name = value`. */
  selected: string[];
  deselected?: string[];
  /** Extra facts shown with it, e.g. `{ objective: 0.09 }`. */
  meta?: Record<string, unknown>;
}

/**
 * What an operation hands back for the shell to show in the output panel. flamapy's own
 * operations are shown with the same views (lists of features as tables, sampling as
 * configurations, ...).
 */
export type OperationResult =
  | { kind: 'text'; value: string }
  | { kind: 'json'; value: unknown }
  | { kind: 'table'; columns: string[]; rows: unknown[][] }
  | ({ kind: 'configuration' } & ResultConfiguration)
  | { kind: 'configurations'; configurations: ResultConfiguration[] };

export interface OperationRunContext {
  /** Aborted when the user presses Stop. */
  signal: AbortSignal;
  /** Shown while the operation runs; `fraction` in [0, 1]. */
  progress(update: { message?: string; fraction?: number }): void;
}

/**
 * An operation a plugin adds to a built-in menu. Unlike a plain menu item, the shell runs
 * it: checks the model is valid, collects `inputs` with its form, shows progress and the
 * Stop button, and renders the result.
 */
export interface OperationContribution {
  /** Unique id, e.g. `acme.tool.optimize`. */
  id: string;
  menu: ShellMenuId;
  label: string;
  /** Tooltip. */
  title?: string;
  order?: number;
  /** `analysis` menu only: the solvers it is shown for (see `MenuItemDescriptor`). */
  backends?: string[];
  inputs?: InputSpec[];
  /** Only run on a valid model. Default: true. */
  requiresValidModel?: boolean;
  run(
    args: Record<string, unknown>,
    ctx: OperationRunContext,
  ): OperationResult | void | Promise<OperationResult | void>;
}

/** A contribution as the shell stores it: stamped with the contributing plugin's id. */
export type Contributed<T> = T & { pluginId?: string };

export interface StatusBarItemDescriptor {
  id: string;
  /** Rendered as-is in the status bar. */
  component: ComponentType;
  side: 'left' | 'right';
  order?: number;
}

export interface Marker {
  message: string;
  severity: 'error' | 'warning' | 'info';
  line?: number;
  column?: number;
}

export interface FileHandlerDescriptor {
  /** Extensions without the dot, e.g. ['afm', 'xml', 'gfm.json']. */
  extensions: string[];
  /** Convert foreign content to UVL text (may call engine services). */
  importToUVL(content: string, extension: string): Promise<string>;
}

export interface ShellApi {
  documents: DocumentStore;
  views: {
    register(view: ViewDescriptor): Disposable;
    open(id: string): Promise<boolean>;
    close(id: string): void;
    activeViewId(): string | null;
    onDidChangeActive(listener: (id: string | null) => void): Disposable;
  };
  sidebar: {
    register(panel: SidebarPanelDescriptor): Disposable;
    /** Show a registered panel on its side (e.g. when your view opens). */
    show(id: string): void;
  };
  toolbar: {
    /** A separate toolbar group of the plugin's own, after the built-in menus. */
    registerMenu(menu: ToolbarMenuDescriptor): Disposable;
  };
  menus: {
    /** Add an item to a built-in toolbar menu (Structural, Analysis, Export). */
    registerItem(item: MenuItemDescriptor): Disposable;
  };
  operations: {
    /** Add an operation the shell runs (inputs form, progress, Stop, result) to a menu. */
    register(operation: OperationContribution): Disposable;
  };
  statusBar: {
    registerItem(item: StatusBarItemDescriptor): Disposable;
  };
  commands: {
    register(id: string, handler: (args?: unknown) => unknown): Disposable;
    execute(id: string, args?: unknown): Promise<unknown>;
  };
  output: {
    /** Show an operation result in the bottom panel. */
    show(label: string, result: unknown): void;
  };
  problems: {
    /** Replace this source's markers (e.g. validation diagnostics). */
    set(source: string, markers: Marker[]): void;
  };
  modals: {
    open(render: (close: () => void) => ReactNode): void;
  };
  fileHandlers: {
    register(handler: FileHandlerDescriptor): Disposable;
  };
}
