// Turns the plugin capability catalog emitted by the Pyodide bridge
// (public/flamapy/flamapy_ide.py get_plugin_catalog) into the operation lists the
// toolbar renders. The bridge is the single source of truth for *which backends*
// implement *which operations*; this module only layers on the IDE's presentation
// (nice labels, input prompts, menu order) and the one legacy operation that has a
// bespoke modal instead of a facade method.
//
// Design: a third-party plugin installed at runtime must surface without an IDE
// edit. So an analysis operation is shown when EITHER it is in the curated UI map
// below (the built-in surface, kept byte-identical to the pre-catalog table) OR it
// is contributed by a backend that is not one of the boot-bundled defaults — i.e.
// it came from an installed extra plugin. Framework operations that exist but were
// never exposed in the IDE (product_distribution, language_level, …) therefore stay
// hidden for the default backends, yet a new plugin's novel operations appear.

// Backends bundled and enabled at boot (public/flamapy/plugins.conf.json). Their
// operation surface is curated; only operations in OPERATION_UI show for them.
const DEFAULT_BACKENDS = new Set(["sat", "bdd", "z3"]);

// Presentation for the built-in operations, keyed by facade method name. `input`
// mirrors the extra-argument contract executeAction expects:
// { kind: "feature"|"integer", arg, prompt, min? }. Order here is menu order.
const OPERATION_UI = {
  // Structural (no backend, always available)
  metrics: { label: "Metrics" },
  atomic_sets: { label: "Atomic sets" },
  variation_points: { label: "Variation points" },
  leaf_features: { label: "Leaf features" },
  average_branching_factor: { label: "Average branching factor" },
  count_leafs: { label: "Leaf count" },
  max_depth: { label: "Max depth" },
  estimated_number_of_configurations: { label: "Estimated configurations" },
  feature_ancestors: {
    label: "Feature ancestors",
    input: { kind: "feature", arg: "feature_name", prompt: "Select a feature" },
  },

  // Analysis (backend-implemented)
  satisfiable: { label: "Satisfiable" },
  configurations: { label: "Configurations" },
  configurations_number: { label: "Number of configurations" },
  dead_features: { label: "Dead features" },
  core_features: { label: "Core features" },
  false_optional_features: { label: "False optional features" },
  sampling: {
    label: "Sampling",
    input: { kind: "integer", arg: "size", prompt: "Sample size", min: 1 },
  },
  backbone: { label: "Backbone" },
  unique_features: { label: "Unique features" },
  variant_features: { label: "Variant features" },
  pure_optional_features: { label: "Pure optional features" },
  homogeneity: { label: "Homogeneity" },
  variability: { label: "Variability" },
  configurations_with_n_features: {
    label: "Configurations with N features",
    input: { kind: "integer", arg: "n", prompt: "Number of selected features", min: 0 },
  },
  all_feature_bounds: { label: "Feature bounds (all)" },
  feature_bounds: {
    label: "Feature bounds",
    input: { kind: "feature", arg: "variable_name", prompt: "Select a feature" },
  },
  minimum_configuration: { label: "Minimum configuration" },
  t_wise_sampling: {
    label: "T-wise sampling",
    input: { kind: "integer", arg: "t", prompt: "t (interaction strength)", min: 1 },
  },
};

// Menu order for the built-in operations (any operation not listed sorts after,
// by label). Separate lists so structural and analysis menus each stay ordered.
const STRUCTURAL_ORDER = [
  "metrics", "atomic_sets", "variation_points", "leaf_features",
  "average_branching_factor", "count_leafs", "max_depth",
  "estimated_number_of_configurations", "feature_ancestors",
];
const ANALYSIS_ORDER = [
  "satisfiable", "configurations", "configurations_number", "dead_features",
  "core_features", "false_optional_features", "sampling", "backbone",
  "unique_features", "variant_features", "pure_optional_features", "homogeneity",
  "variability", "configurations_with_n_features", "all_feature_bounds",
  "feature_bounds", "minimum_configuration", "t_wise_sampling",
];

// Attribute optimization is not a facade method: it opens a dedicated modal
// (executeAction branches on engine === "legacy"). SAT does single-objective
// MaxSAT, Z3 multi-objective; backendAware is derived from its two backends.
const LEGACY_ANALYSIS = [
  {
    value: "AttributeOptimization",
    label: "Attribute optimization",
    engine: "legacy",
    backends: ["sat", "z3"],
  },
];

function humanize(name) {
  const s = name.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Convert a catalog operation's inputs (0..1 used by the UI) into the singular
// `input` object executeAction consumes. The curated `ui.input` wins; otherwise it
// is derived best-effort from the descriptor (feature vs numeric argument).
function inputFor(op, ui) {
  if (ui?.input) return ui.input;
  const first = op.inputs?.[0];
  if (!first) return undefined;
  return {
    kind: first.kind === "feature" ? "feature" : "integer",
    arg: first.name,
    prompt: humanize(first.name),
  };
}

function toAction(op) {
  const ui = OPERATION_UI[op.method];
  const backends = op.backends || [];
  const input = inputFor(op, ui);
  return {
    method: op.method,
    label: ui?.label ?? op.label ?? humanize(op.method),
    backends,
    backendAware: backends.length > 1,
    ...(input ? { input } : {}),
  };
}

function orderIndex(order, method) {
  const i = order.indexOf(method);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

function sortByOrder(actions, order) {
  return [...actions].sort((a, b) => {
    const ia = orderIndex(order, a.method);
    const ib = orderIndex(order, b.method);
    return ia !== ib ? ia - ib : a.label.localeCompare(b.label);
  });
}

// Solver tabs, one per installed solver backend, in catalog order.
export function solverOptionsFromCatalog(catalog) {
  const plugins = catalog?.plugins || [];
  return plugins.map((p) => ({ value: p.backend, label: p.backend.toUpperCase() }));
}

// Backend tokens present in the catalog (drives which solver tabs / metrics show).
export function installedBackends(catalog) {
  return (catalog?.plugins || []).map((p) => p.backend);
}

// Structural (no-backend) operations menu.
export function structuralOperationsFromCatalog(catalog) {
  const ops = (catalog?.operations || []).filter(
    (op) => op.structural && OPERATION_UI[op.method]
  );
  return sortByOrder(ops.map(toAction), STRUCTURAL_ORDER);
}

// Analysis operations available for the selected solver backend. Shows built-in
// operations (curated) plus any operation contributed by a non-default backend, so
// runtime-installed plugins surface their operations automatically.
export function analysisOperationsForSolver(catalog, solver) {
  if (!solver) return [];
  const ops = (catalog?.operations || []).filter((op) => {
    if (op.structural || !op.backends?.includes(solver)) return false;
    const curated = Boolean(OPERATION_UI[op.method]);
    const fromExtra = op.backends.some((b) => !DEFAULT_BACKENDS.has(b));
    return curated || fromExtra;
  });
  const actions = sortByOrder(ops.map(toAction), ANALYSIS_ORDER);
  const legacy = LEGACY_ANALYSIS.filter((op) => op.backends.includes(solver)).map((op) => ({
    ...op,
    backendAware: op.backends.length > 1,
  }));
  return [...actions, ...legacy];
}
