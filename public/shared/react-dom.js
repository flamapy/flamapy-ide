// Shared-module shim: the shell's react-dom for remote plugins (see shared/react.js).
const ReactDOM = globalThis.__flamapyShared?.reactDom;
if (!ReactDOM) {
  throw new Error("flamapy shared modules are not initialized (react-dom)");
}
export default ReactDOM;
export const { createPortal, flushSync, version } = ReactDOM;
