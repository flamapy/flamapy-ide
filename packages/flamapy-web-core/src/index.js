// The execution core shared by the flamapy IDE and future hosts (VS Code webview).
// The Pyodide runtime assets themselves (webworker.js, flamapy_ide.py, wheels) still
// live in the consuming app's public/ directory — the wheel-update pipeline writes
// there; they become package assets when the second consumer (apps/vscode) lands.
export { createWorkerClient } from "./workerClient";
export { useWorkerClient } from "./useWorkerClient";
export * from "./computeBackend";
export * from "./operationCatalog";
