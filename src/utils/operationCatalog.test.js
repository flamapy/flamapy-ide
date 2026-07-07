import { describe, it, expect } from "vitest";
import {
  solverOptionsFromCatalog,
  installedBackends,
  structuralOperationsFromCatalog,
  analysisOperationsForSolver,
} from "./operationCatalog";

// A catalog shaped like get_plugin_catalog() in public/flamapy/flamapy_ide.py.
// Defaults sat/bdd/z3 plus a runtime-installed extra backend "sdd".
const catalog = {
  plugins: [
    { backend: "sat", name: "pysat_metamodel", extension: "pysat" },
    { backend: "bdd", name: "bdd_metamodel", extension: "bdd" },
    { backend: "z3", name: "z3_metamodel", extension: "z3" },
    { backend: "sdd", name: "sdd_metamodel", extension: "sdd" },
  ],
  operations: [
    { method: "metrics", operation: "Metrics", structural: true, backends: [], inputs: [] },
    { method: "atomic_sets", operation: "AtomicSets", structural: true, backends: [], inputs: [] },
    { method: "satisfiable", operation: "Satisfiable", structural: false, backends: ["sat", "bdd", "z3", "sdd"], inputs: [] },
    { method: "backbone", operation: "Backbone", structural: false, backends: ["sat"], inputs: [] },
    { method: "unique_features", operation: "UniqueFeatures", structural: false, backends: ["bdd"], inputs: [] },
    { method: "sampling", operation: "Sampling", structural: false, backends: ["sat", "bdd"],
      inputs: [{ name: "size", kind: "integer", required: true }] },
    // A framework operation that is NOT in the curated UI and is only on default
    // backends: must stay hidden (kept off the menu, as in the pre-catalog IDE).
    { method: "product_distribution", operation: "BDDProductDistribution", structural: false, backends: ["bdd"], inputs: [] },
    // A novel operation contributed only by the installed extra backend: must show.
    { method: "sdd_special", operation: "SddSpecial", structural: false, backends: ["sdd"], inputs: [] },
  ],
};

describe("solverOptionsFromCatalog", () => {
  it("makes one uppercase tab per installed backend", () => {
    expect(solverOptionsFromCatalog(catalog)).toEqual([
      { value: "sat", label: "SAT" },
      { value: "bdd", label: "BDD" },
      { value: "z3", label: "Z3" },
      { value: "sdd", label: "SDD" },
    ]);
  });

  it("is empty for a missing catalog", () => {
    expect(solverOptionsFromCatalog(null)).toEqual([]);
  });
});

describe("installedBackends", () => {
  it("lists the backend tokens", () => {
    expect(installedBackends(catalog)).toEqual(["sat", "bdd", "z3", "sdd"]);
  });
});

describe("structuralOperationsFromCatalog", () => {
  it("returns curated structural ops in menu order", () => {
    const ops = structuralOperationsFromCatalog(catalog);
    expect(ops.map((o) => o.method)).toEqual(["metrics", "atomic_sets"]);
    expect(ops.every((o) => !o.backendAware)).toBe(true);
  });
});

describe("analysisOperationsForSolver", () => {
  it("derives backendAware from the backend count", () => {
    const sat = analysisOperationsForSolver(catalog, "sat");
    expect(sat.find((o) => o.method === "satisfiable").backendAware).toBe(true);
    expect(sat.find((o) => o.method === "backbone").backendAware).toBe(false);
  });

  it("filters operations to the selected backend", () => {
    const bdd = analysisOperationsForSolver(catalog, "bdd").map((o) => o.method);
    expect(bdd).toContain("unique_features");
    expect(bdd).not.toContain("backbone");
  });

  it("hides framework operations that are not curated and only on default backends", () => {
    const bdd = analysisOperationsForSolver(catalog, "bdd").map((o) => o.method);
    expect(bdd).not.toContain("product_distribution");
  });

  it("surfaces a novel operation from a runtime-installed extra backend", () => {
    const sdd = analysisOperationsForSolver(catalog, "sdd").map((o) => o.method);
    expect(sdd).toContain("sdd_special"); // not curated, but from a non-default backend
    expect(sdd).toContain("satisfiable"); // curated op the extra also implements
  });

  it("carries the curated input contract onto the action", () => {
    const sampling = analysisOperationsForSolver(catalog, "sat").find((o) => o.method === "sampling");
    expect(sampling.input).toEqual({ kind: "integer", arg: "size", prompt: "Sample size", min: 1 });
  });

  it("appends the legacy attribute-optimization entry for sat and z3 only", () => {
    expect(analysisOperationsForSolver(catalog, "sat").some((o) => o.value === "AttributeOptimization")).toBe(true);
    expect(analysisOperationsForSolver(catalog, "z3").some((o) => o.value === "AttributeOptimization")).toBe(true);
    expect(analysisOperationsForSolver(catalog, "bdd").some((o) => o.value === "AttributeOptimization")).toBe(false);
  });

  it("returns nothing when no solver is selected", () => {
    expect(analysisOperationsForSolver(catalog, null)).toEqual([]);
  });
});
