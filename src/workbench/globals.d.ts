// Shared-module bridge for remotely loaded plugins: the shell publishes its own React
// (and the plugin API) here, and the import-map shims in public/shared/ re-export from
// it, so a remote ESM plugin bundle never carries a second React copy.
declare global {
  // eslint-disable-next-line no-var
  var __flamapyShared:
    | {
        react: typeof import('react');
        reactDom: typeof import('react-dom');
        jsxRuntime: unknown;
        pluginApi: unknown;
      }
    | undefined;
}

export {};
