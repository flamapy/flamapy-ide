# Authoring flamapy-ide plugins

flamapy-ide is a web IDE for **UVL feature models and their automated analysis with
flamapy**. Plugins let researchers in software product lines, variability and
configuration bring their tools into the same place: a new view of the model, an analysis,
a configurator, an importer. The goal is a common home for that research, not a
general-purpose extensible IDE: the contract stays small, and the IDE keeps doing what it
is for (editing UVL, reasoning with flamapy).

Since v3 the IDE is a plugin workbench. The shell owns the editor, the tabs, the layout,
the UVL **document** and the plugin host. Everything else is a plugin: the flamapy
analysis engine, every visualization and the configurator.

## The contract

The contract is the `@flamapy/ide-plugin-api` package (`packages/ide-plugin-api` in this
repo). An IDE plugin is a manifest plus an imperative `activate`:

```ts
import type { FlamapyPlugin } from "@flamapy/ide-plugin-api";

export const myPlugin: FlamapyPlugin = {
  manifest: {
    id: "acme.my-tool",               // globally unique, stable
    name: "My Tool",
    version: "1.0.0",
    engines: { pluginApi: "^1.0.0" }, // the IDE plugin API range you build against
    dependencies: ["flamapy.engine"], // activated before you (optional)
    // attribution: see below
  },
  activate(ctx) {
    // Register contributions; push what they return into ctx.subscriptions
    // and it is disposed automatically (in reverse order) on deactivation.
  },
};
```

There are no declarative contribution points: everything is registered inside
`activate(ctx)` and returns a `Disposable`. Registering and disposing at runtime is
supported: the charts plugin registers its BDD-only views only while a bdd backend is
installed, following the runtime catalog.

### Versioning

`PLUGIN_API_VERSION` (currently `1.0.0`) follows semver. A minor release only adds API;
a major release may break plugins and is announced first.

Declare the range you build against in `manifest.engines.pluginApi`, e.g. `"^1.0.0"`.
When the IDE's version is outside that range, the host doesn't activate the plugin.
Instead it records it as `incompatible`, with a message saying which version is
required, and skips the plugins that depend on it. The rest of the IDE keeps working.

`engines.pluginApi` is **required for remote plugins**. Built-in plugins are
type-checked together with the IDE, so they may leave it out.

### Attribution

Your plugin carries your work, and the manifest is where it gets credit. Wherever the
IDE lists plugins, it shows these fields, so people can find, check and cite the tool
behind them. They are all optional; fill in what applies.

```ts
manifest: {
  // ...id, name, version, engines
  description: "Optimises configurations with simulated annealing.",
  authors: [
    { name: "Ada Researcher", affiliation: "University of Somewhere",
      url: "https://example.org/ada", orcid: "0000-0002-1825-0097" },
  ],
  repository: "https://github.com/acme/my-tool",   // source code
  homepage: "https://acme.example.org/my-tool",     // if different from the repository
  license: "MIT",                                    // SPDX identifier
  logo: "data:image/svg+xml;base64,...",             // https: URL or data:image/ URI
  citation: {
    text: "Researcher, A. (2026). My Tool: ... In Proceedings of SPLC '26.",
    doi: "10.1145/1234567.1234568",
    bibtex: "@inproceedings{mytool2026, ...}",
  },
},
```

- **Logo:** use a roughly square SVG or PNG. A remote plugin can point next to its
  bundle with `new URL("./logo.svg", import.meta.url).href`. A bundled plugin can inline
  it as a `data:` URI.
- **Checking your manifest:** `validateManifest(manifest)` returns a list of problems,
  empty when the manifest is valid. The test kit runs it for you.

All of this is shown in the IDE's **Plugins** view (the puzzle icon in the activity bar):
one card per plugin with its logo, authors (with ORCID links), source code and website
links, license and a *How to cite* section with copy buttons, next to its state.

### Lifecycle

Users can turn any plugin off and on from the Plugins view; the choice is remembered.
Remote plugins can also be reloaded (picking up a new build) and removed, and a failed
plugin can be retried.

- Turning a plugin off runs its `deactivate()` and disposes its `ctx.subscriptions`.
  Plugins that depend on it stop too (`skipped`) and come back when it is turned on.
- `activate` must finish within 10 seconds, or the plugin is marked `failed`.
- A plugin whose dependency isn't installed is `skipped`, with the reason shown on its
  card; it doesn't break the IDE.
- **Module state survives deactivation:** ES modules can't be unloaded. Reset
  module-level state (such as a zustand store) in `activate`.

## What `ctx` gives you

- **`ctx.shell.documents`:** the UVL document, the single source of truth for the model
  text. It offers `getText()`, `setText(text, origin)` and `onDidChange`. Tag your writes
  with your own `origin` string, and ignore your own echo in `onDidChange`.
- **`ctx.shell.views`:** main-panel views.
  - `register({ id, title, component, dynamic?, keepMounted?, order?, onBeforeOpen? })`
    adds a view. Views render inside an error boundary, so a crash shows a fallback and
    never takes down the shell.
  - `onBeforeOpen` is a **gate**, not a lifecycle hook. It runs on every `open(id)`, and
    returning `{ ok: false, message }` keeps the current view and shows the message. Use
    it for preconditions such as "the model must be valid".
  - `close(id)` only does something when `id` is the active view: the IDE then falls back
    to the `source` (editor) view.
  - `onDidChangeActive` fires **after** the newly active view has rendered, never
    synchronously inside `open()`.
- **`ctx.shell.menus` / `operations`:** add to the built-in toolbar menus (see
  [Menus and operations](#menus-and-operations)).
- **`ctx.shell.sidebar`:** side panels.
  - `register({ id, title, side, icon?, component, order? })` adds a panel with its own
    activity-bar button (`icon`, about 20 px; default: the title's initials).
  - Each side shows **one panel at a time**: the user picks it with the activity bar and
    can close the side. `side` is only the default: users can move a panel to the other
    side, and resize it. Their choices are remembered.
  - The shell draws the frame (header with the title, move and close buttons, width):
    your `component` renders the content only.
  - `show(id)` brings your panel up on its side, e.g. when your view opens.
- **`ctx.shell.toolbar` / `statusBar`:** a toolbar group of your own (captioned with your
  plugin's name), and status items.
- **`ctx.shell.commands`:** the cross-plugin command bus, with `register(id, handler)`
  and `execute(id, args)`. For example, the engine's optimization action executes
  `flamapy.charts.showParetoFront`.
- **`ctx.shell.output` / `problems` / `modals` / `fileHandlers`:** the bottom output
  panel, diagnostic markers per source, the modal stack, and importers for foreign file
  extensions.
- **`ctx.services`:** the typed service registry (see below).
- **`ctx.settings`:** localStorage-backed key/value settings, namespaced by plugin id.

### The model belongs to flamapy

Parsing, validating and reasoning about the feature model is flamapy's job, and it runs
in the engine plugin (Pyodide in the browser, or the REST backend). Ask the engine
instead of re-implementing UVL semantics in JavaScript. A second parser drifts from
flamapy's, and the model then means different things in different views.

The engine provides these services. They are public API: import the ids and types from
`@flamapy/plugin-flamapy-engine`.

| Service id | Constant | What it does |
|---|---|---|
| `flamapy.engine.worker` | `EngineWorker` | Pyodide calls, interrupt/restart, runtime Python-wheel installs |
| `flamapy.engine.catalog` | `Catalog` | Capability catalog: installed backends, operations, solvers |
| `flamapy.engine.analysis` | `Analysis` | Validation keyed to document versions, feature tree, operation dispatch (WASM/REST) |
| `flamapy.engine.configurator` | `Configurator` | Interactive configuration |

## Menus and operations

The toolbar has three built-in menus: **Structural**, **Automated analysis** and
**Export & share** (`'structural' | 'analysis' | 'export'`). Plugins add to them; their
entries are listed after the built-in ones, under the plugin's name.

**A menu item** runs your own code: you handle any dialog and output yourself.

```ts
ctx.subscriptions.push(
  ctx.shell.menus.registerItem({
    id: "acme.tool.about",
    menu: "structural",
    label: "About My Tool",
    run: () => ctx.shell.output.show("My Tool", "…"),
  }),
);
```

**An operation** is run by the shell, which handles the inputs form, progress and Stop
for you, then renders what you return. Declare the inputs, and return a result:

```ts
ctx.subscriptions.push(
  ctx.shell.operations.register({
    id: "acme.tool.optimize",
    menu: "analysis",
    label: "Optimise configuration…",
    backends: ["sat"],                  // analysis only: shown for these solvers
    inputs: [
      { name: "criteria", kind: "attributes", label: "Criteria", required: true },
      { name: "goal", kind: "enum", label: "Goal", default: "min",
        options: [{ value: "min", label: "Minimise" }, { value: "max", label: "Maximise" }] },
      { name: "reads", kind: "integer", label: "Reads", min: 1, default: 100 },
    ],
    async run(args, { signal, progress }) {
      progress({ message: "Annealing", fraction: 0.5 });
      // ... stop early when signal.aborted (the user pressed Stop)
      return { kind: "configuration", selected: ["Root", "GPS"], meta: { objective: 0.09 } };
    },
  }),
);
```

- **Input kinds:** `integer`, `number`, `string`, `boolean`, `enum`, `feature` /
  `features` and `attribute` / `attributes`. The feature and attribute pickers are
  filled from the current model by the engine.
- **Results:** `text`, `json`, `table` (`columns`, `rows`), `configuration`
  (`selected`, `deselected?`, `meta?`) or `configurations` (a list of those). flamapy's
  own operations are shown with the same views. Return nothing if you showed the result
  yourself.
- **Valid model:** the shell only runs the operation on a valid model, unless you set
  `requiresValidModel: false`.
- **Calling flamapy:** `Analysis.runOperationData(action)` runs a catalog operation and
  returns `{ display, data }`, where `data` is the raw result as plain JSON.

A **flamapy plugin** (Python) needs none of this: its operations come from its
`OperationDescriptor`s, and every `Input` becomes a field of the same form.

## Ways to ship a plugin

Both ways use the same contract and the same `FlamapyPlugin` object.

1. **Built-in (first-party).** An npm workspace in `packages/plugin-*` of this repo,
   registered in `src/workbench/builtinPlugins.ts`. This is how the IDE's own plugins
   (engine, views, configurator) ship; `packages/plugin-view-graph` is the minimal
   example.
2. **Remote plugin (third-party).** Your plugin lives in **your own repository**, next to
   your tool: your code, history, releases and credit stay yours, and nothing in this
   repo changes. You build an ESM file that *default-exports* the plugin and serve it
   from any URL. In the Plugins view (puzzle icon), users allow loading plugins from a
   URL (experimental) and load yours; it is remembered across sessions.
   - **Externals:** build with exactly the `SHARED_MODULES` specifiers as externals:
     `react`, `react-dom`, `react/jsx-runtime` and `@flamapy/ide-plugin-api`. The IDE's
     import map resolves them to the shell's own instances. Bundle everything else,
     including your CSS (inject it from `activate` and remove it on dispose).
   - **Chunks:** the bundle doesn't have to be a single file. An ESM entry with relative
     lazy chunks and assets works, because they resolve against the entry's URL.
   - **CORS:** serve with CORS headers. The page runs with `COEP: credentialless`.
   - **Types and tests:** depend on `@flamapy/ide-plugin-api` as a `devDependency` and use
     `import type`; the test kit below runs your plugin and checks your built bundle.
   - **Python:** a plugin that needs a new analysis can pair with a flamapy plugin wheel
     and install it at runtime through the engine's `EngineWorker` service
     (`installPythonPlugin`). Its operations then show up in the engine's catalog.
   - **Example:** `examples/remote-hello-plugin/` is the reference, with no build step.

**One React.** The IDE guarantees a single React instance. Built-in plugins share it
through Vite's `resolve.dedupe`, and remote plugins through the import map. Never bundle
React: a second copy breaks hooks.

## Testing your plugin

`@flamapy/ide-plugin-api/testing` runs your plugin against the IDE's real shell core (the
same `createWorkbench` the IDE renders), in Vitest or Jest with jsdom:

```ts
// @vitest-environment jsdom
import { expect, it } from "vitest";
import { createTestWorkbench, stubPlugin } from "@flamapy/ide-plugin-api/testing";
import { Analysis } from "@flamapy/plugin-flamapy-engine";
import { myPlugin } from "./plugin";

it("draws the model and cleans up after itself", async () => {
  const wb = createTestWorkbench({ document: "features\n\tRoot\n" });
  const engine = stubPlugin("flamapy.engine", (ctx) => {
    ctx.subscriptions.push(ctx.services.provide(Analysis, fakeAnalysis()));
  });
  await wb.activate(engine, myPlugin);   // rejects with the reason unless both are active

  const view = await wb.openView("acme.my-tool.view"); // gated, rendered in StrictMode
  expect(view.container.textContent).toContain("Root");

  await wb.update(() => wb.document.setText("features\n\tOther\n", "editor"));
  expect(view.container.textContent).toContain("Other");
  expect(wb.history.map((change) => change.origin)).toEqual(["editor"]);

  await expect(wb.runOperation("acme.my-tool.count", { size: 2 })).resolves.toEqual({
    kind: "json", value: 2,
  });

  await wb.dispose(); // rejects if anything you registered outlives deactivation
});
```

- **`activate(...plugins)`** validates each manifest and checks API compatibility.
- **`openView(id)`** goes through `onBeforeOpen`, renders the view, then fires
  `onDidChangeActive`, in the same order as the IDE.
- **`update(fn)`** runs document edits, clicks or commands and waits for views to
  re-render.
- **`runOperation(id, args)`** runs a contributed operation like the shell does after
  its form, and returns the result. It rejects on a missing required input or an
  argument no input declares; pass `{ signal }` to test Stop.
- **Recordings:** `history`, `outputs`, `modals` and `progress` record what the plugin
  did.
- **Polyfills:** jsdom's gaps that views commonly hit are filled in for you:
  `ResizeObserver`, `DOMMatrixReadOnly`, `matchMedia`, canvas text measuring and SVG
  sizes.
- **Remote bundles:** `assertRemoteBundle(source, module)` checks a built bundle the way
  the IDE loads it. It flags bare imports the import map can't resolve, a bundled React,
  and a missing default export or invalid manifest, then returns the plugin so you can
  activate it. `examples/remote-hello-plugin/hello-plugin.test.js` shows how.

## Rules of thumb

- **The document is the source of truth** for the model. Never keep a divergent copy:
  hydrate from the document, follow foreign edits through `onDidChange`, and commit your
  edits back with your origin tag.
- **Gate views that need a valid model** with `onBeforeOpen` and the engine's
  `ensureValidated()`, or reuse `validModelGate` from the engine package.
- **Don't import the `@flamapy/web-ui` barrel** from a plugin. Import component files
  directly, because the barrel pulls in Monaco.
- **Everything you register must land in `ctx.subscriptions`** unless you dispose of it
  yourself. `dispose()` in the test kit checks this; users turning your plugin off
  depend on it.
