// Shared-module shim: the shell's JSX runtime for remote plugins (see shared/react.js).
const runtime = globalThis.__flamapyShared?.jsxRuntime;
if (!runtime) {
  throw new Error("flamapy shared modules are not initialized (react/jsx-runtime)");
}
export const { jsx, jsxs, Fragment } = runtime;
