// Turns the plugin capability catalog emitted by the Pyodide bridge
// (public/flamapy/flamapy_ide.py get_plugin_catalog) into the operation lists the
// toolbar renders. The bridge is the single source of truth for *which backends*
// implement *which operations*; this module only layers on the IDE's presentation
// (nice labels, input prompts, menu order). Attribute optimization, which has a
// dedicated dialog instead of a facade method, is contributed to the Analysis menu by
// the plugin that implements it (plugin-view-charts), so it is listed only while that
// plugin is active.
//
// Design: a third-party plugin installed at runtime must surface without an IDE
// edit. So an analysis operation is shown when EITHER it is in the curated UI map
// below (the built-in surface, kept byte-identical to the pre-catalog table) OR it
// is contributed by a backend outside CURATED_BACKENDS. Framework operations that exist
// but were never exposed in the IDE (product_distribution, language_level, …) therefore
// stay hidden for the curated backends, yet any other plugin's operations appear.

// flamapy's core solvers, whose operation surface is curated: only operations in
// OPERATION_UI show for them. This is presentation only: how a plugin is installed
// (preinstalled or not, see plugins.conf.template.json) plays no part.
const CURATED_BACKENDS = new Set(["sat", "bdd", "z3"]);

// Presentation for the built-in operations, keyed by facade method name. `inputs` are
// InputSpecs (see @flamapy/ide-plugin-api): the fields of the shell's input form. A
// curated entry's inputs replace the ones the bridge derives. Order here is menu order.
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
    inputs: [{ name: "feature_name", kind: "feature", label: "Select a feature", required: true }],
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
    inputs: [{ name: "size", kind: "integer", label: "Sample size", min: 1, default: 1, required: true }],
  },
  backbone: { label: "Backbone" },
  unique_features: { label: "Unique features" },
  variant_features: { label: "Variant features" },
  pure_optional_features: { label: "Pure optional features" },
  homogeneity: { label: "Homogeneity" },
  variability: { label: "Variability" },
  configurations_with_n_features: {
    label: "Configurations with N features",
    inputs: [
      { name: "n", kind: "integer", label: "Number of selected features", min: 0, default: 0, required: true },
    ],
  },
  all_feature_bounds: { label: "Feature bounds (all)" },
  feature_bounds: {
    label: "Feature bounds",
    inputs: [{ name: "variable_name", kind: "feature", label: "Select a feature", required: true }],
  },
  minimum_configuration: { label: "Minimum configuration" },
  t_wise_sampling: {
    label: "T-wise sampling",
    inputs: [
      { name: "t", kind: "integer", label: "t (interaction strength)", min: 1, default: 1, required: true },
    ],
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

function humanize(name) {
  const s = name.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const INPUT_KINDS = new Set([
  "integer", "number", "string", "boolean", "feature", "features", "attribute", "attributes", "enum",
]);

// The input form fields of a catalog operation: the curated ones, or every input the
// bridge reports (an older bridge's "scalar" kind becomes a text field).
function inputsFor(op, ui) {
  if (ui?.inputs) return ui.inputs;
  return (op.inputs || []).map((input) => ({
    ...input,
    kind: INPUT_KINDS.has(input.kind) ? input.kind : "string",
    label: input.label ?? humanize(input.name),
    required: Boolean(input.required),
  }));
}

function toAction(op) {
  const ui = OPERATION_UI[op.method];
  const backends = op.backends || [];
  const inputs = inputsFor(op, ui);
  return {
    method: op.method,
    label: ui?.label ?? op.label ?? humanize(op.method),
    backends,
    backendAware: backends.length > 1,
    ...(op.doc ? { title: op.doc } : {}),
    ...(inputs.length > 0 ? { inputs } : {}),
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
    const fromExtra = op.backends.some((b) => !CURATED_BACKENDS.has(b));
    return curated || fromExtra;
  });
  return sortByOrder(ops.map(toAction), ANALYSIS_ORDER);
}
