// Compute backend selection: run analysis operations either in-browser (WASM /
// Pyodide, the default) or against a remote flamapy-rest API. Only the facade
// analysis operations are offloaded to REST; everything else (editing,
// validation, tree, import/export, charts, configurator) always runs in WASM,
// so this is a hybrid — WASM is still loaded when REST is selected.

export const WASM = "wasm";
export const REST = "rest";

export const DEFAULT_REST_URL =
  import.meta.env.VITE_REST_API_URL || "https://rest.flamapy.org";

const BACKEND_KEY = "flamapy-ide.computeBackend";
const URL_KEY = "flamapy-ide.restApiUrl";

// flamapy-rest mounts every operation under this blueprint prefix; the
// configurable URL is the server root and we append the API path + method.
const API_PREFIX = "/api/v1/operations";

export function loadBackend() {
  return localStorage.getItem(BACKEND_KEY) === REST ? REST : WASM;
}

export function saveBackend(backend) {
  localStorage.setItem(BACKEND_KEY, backend === REST ? REST : WASM);
}

export function loadRestUrl() {
  return localStorage.getItem(URL_KEY) || DEFAULT_REST_URL;
}

export function saveRestUrl(url) {
  localStorage.setItem(URL_KEY, url || DEFAULT_REST_URL);
}

// flamapy-rest derives the multipart field name from the facade parameter name:
// a `*_path` parameter is sent as an uploaded file under its stripped name
// (configuration_path -> configuration), and a couple of legacy renames apply.
const LEGACY_FIELD = { feature_name: "feature" };

function fieldName(param) {
  if (param.endsWith("_path")) return param.slice(0, -"_path".length);
  return LEGACY_FIELD[param] ?? param;
}

// --- result formatting -----------------------------------------------------
// The REST API returns the raw facade result; the WASM bridge instead returns
// the output of flamapy_ide.py's _serialize_facade_result. We port that logic
// here so the Output panel renders REST results identically.

function pyStr(value) {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

function displayItem(item) {
  if (Array.isArray(item)) return item.map(pyStr).join(", ");
  if (item && typeof item === "object") {
    // Configuration objects (returned by configurations/sampling/filter)
    // serialize as {elements: {feature: value}, is_full}; render them like
    // Configuration.__str__ does in flamapy — the selected feature names.
    if (item.elements && typeof item.elements === "object") {
      return Object.entries(item.elements)
        .filter(([, value]) => value)
        .map(([feature]) => feature)
        .join(", ");
    }
    return Object.entries(item)
      .map(([k, v]) => `${k}: ${pyStr(v)}`)
      .join(", ");
  }
  return pyStr(item);
}

export function formatFacadeResult(raw) {
  if (raw === null || raw === undefined) {
    return (
      "The operation could not be computed. The required plugin may be " +
      "unavailable or the operation may not be supported for this model."
    );
  }
  if (
    typeof raw === "boolean" ||
    typeof raw === "number" ||
    typeof raw === "string"
  ) {
    return raw;
  }
  if (Array.isArray(raw)) return raw.map(displayItem);
  if (typeof raw === "object") {
    return Object.entries(raw).map(([k, v]) => `${k}: ${displayItem(v)}`);
  }
  return String(raw);
}

// --- REST transport --------------------------------------------------------

async function postOperation(baseUrl, method, modelText, fields, files) {
  const form = new FormData();
  form.append("model", new Blob([modelText], { type: "text/plain" }), "model.uvl");
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== "") {
      form.append(key, String(value));
    }
  }
  for (const [key, file] of Object.entries(files || {})) {
    form.append(
      key,
      new Blob([file.content], { type: "text/plain" }),
      file.filename
    );
  }

  const url = `${baseUrl.replace(/\/+$/, "")}${API_PREFIX}/${method}`;
  let response;
  try {
    response = await fetch(url, { method: "POST", body: form });
  } catch (err) {
    throw new Error(
      `Could not reach the REST API at ${baseUrl} (${err.message}). ` +
        "Check the URL, your connection, and that the server allows this origin (CORS)."
    );
  }

  const body = await response.text();
  // A null facade result is surfaced by flamapy-rest as 404 {"error": ...};
  // treat it the same as the WASM "could not be computed" path.
  if (response.status === 404) return null;
  if (!response.ok) {
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed.error || parsed.message || body;
    } catch {
      /* keep raw body */
    }
    throw new Error(`REST API error ${response.status}: ${message}`);
  }
  return JSON.parse(body);
}

// Run a plain analysis operation (scalar args only) against the REST API.
export async function executeRestOperation({ baseUrl, method, modelText, args = {} }) {
  const fields = {};
  for (const [key, value] of Object.entries(args)) fields[fieldName(key)] = value;
  const raw = await postOperation(baseUrl, method, modelText, fields, {});
  return formatFacadeResult(raw);
}

// Run a configuration-driven operation; the {feature: value} selection is sent
// as a .csvconf upload (feature,value per row — booleans parsed server-side).
export async function executeRestOperationWithConfig({
  baseUrl,
  method,
  modelText,
  configMapping,
  args = {},
}) {
  const fields = {};
  for (const [key, value] of Object.entries(args)) fields[fieldName(key)] = value;
  const csv = Object.entries(configMapping || {})
    .map(([feature, value]) => `${feature},${value}`)
    .join("\n");
  const files = { configuration: { content: csv, filename: "configuration.csvconf" } };
  const raw = await postOperation(baseUrl, method, modelText, fields, files);
  return formatFacadeResult(raw);
}
