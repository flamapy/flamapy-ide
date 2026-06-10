import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatFacadeResult,
  executeRestOperation,
  executeRestOperationWithConfig,
} from "./computeBackend";

// formatFacadeResult is a JS port of _serialize_facade_result in
// public/flamapy/flamapy_ide.py — these tests pin the behaviours that must
// stay in sync so REST and WASM results render identically.
describe("formatFacadeResult", () => {
  it("explains a null result instead of rendering 'null'", () => {
    expect(formatFacadeResult(null)).toMatch(/could not be computed/);
    expect(formatFacadeResult(undefined)).toMatch(/could not be computed/);
  });

  it("passes scalars through unchanged", () => {
    expect(formatFacadeResult(true)).toBe(true);
    expect(formatFacadeResult(42)).toBe(42);
    expect(formatFacadeResult("UVL")).toBe("UVL");
    expect(formatFacadeResult(0.5)).toBe(0.5);
  });

  it("renders arrays of scalars with Python-style literals", () => {
    expect(formatFacadeResult(["A", true, false, null])).toEqual([
      "A",
      "True",
      "False",
      "None",
    ]);
  });

  it("renders nested arrays (atomic sets) as comma-joined lines", () => {
    expect(formatFacadeResult([["A", "B"], ["C"]])).toEqual(["A, B", "C"]);
  });

  it("renders Configuration objects as their selected feature names", () => {
    const configurations = [
      { elements: { A: true, B: false, C: true }, is_full: true },
      { elements: { A: true }, is_full: false },
    ];
    expect(formatFacadeResult(configurations)).toEqual(["A, C", "A"]);
  });

  it("renders plain objects as 'key: value' lines", () => {
    expect(formatFacadeResult({ A: 0.5, B: true })).toEqual([
      "A: 0.5",
      "B: True",
    ]);
  });
});

describe("REST transport", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockResponse(body, { status = 200 } = {}) {
    fetch.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  it("POSTs the model to the operations endpoint, stripping trailing slashes", async () => {
    mockResponse(true);
    const result = await executeRestOperation({
      baseUrl: "https://rest.example.org//",
      method: "satisfiable",
      modelText: "features\n\tA",
    });

    expect(result).toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://rest.example.org/api/v1/operations/satisfiable");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const model = init.body.get("model");
    expect(await model.text()).toBe("features\n\tA");
  });

  it("maps facade kwargs to flamapy-rest field names", async () => {
    mockResponse([]);
    await executeRestOperation({
      baseUrl: "https://rest.example.org",
      method: "feature_ancestors",
      modelText: "m",
      args: { feature_name: "A", backend: "sat" },
    });

    const form = fetch.mock.calls[0][1].body;
    // legacy rename: feature_name -> feature
    expect(form.get("feature")).toBe("A");
    expect(form.get("feature_name")).toBeNull();
    expect(form.get("backend")).toBe("sat");
  });

  it("uploads the configuration mapping as a .csvconf file", async () => {
    mockResponse(true);
    await executeRestOperationWithConfig({
      baseUrl: "https://rest.example.org",
      method: "satisfiable_configuration",
      modelText: "m",
      configMapping: { A: true, B: false },
    });

    const form = fetch.mock.calls[0][1].body;
    const file = form.get("configuration");
    expect(await file.text()).toBe("A,true\nB,false");
  });

  it("treats a 404 as a null facade result (renders the explanation)", async () => {
    mockResponse({ error: "not computable" }, { status: 404 });
    const result = await executeRestOperation({
      baseUrl: "https://rest.example.org",
      method: "dead_features",
      modelText: "m",
    });
    expect(result).toMatch(/could not be computed/);
  });

  it("surfaces server errors with status and message", async () => {
    mockResponse({ error: "bad model" }, { status: 400 });
    await expect(
      executeRestOperation({
        baseUrl: "https://rest.example.org",
        method: "satisfiable",
        modelText: "m",
      })
    ).rejects.toThrow(/400.*bad model/);
  });

  it("explains network failures with the URL and a CORS hint", async () => {
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      executeRestOperation({
        baseUrl: "https://unreachable.example.org",
        method: "satisfiable",
        modelText: "m",
      })
    ).rejects.toThrow(/unreachable\.example\.org.*CORS/s);
  });
});
