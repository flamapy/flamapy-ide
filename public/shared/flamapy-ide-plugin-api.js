// Shared-module shim: the shell's @flamapy/ide-plugin-api for remote plugins
// (see shared/react.js). Types are erased; these are the runtime exports.
const api = globalThis.__flamapyShared?.pluginApi;
if (!api) {
  throw new Error("flamapy shared modules are not initialized (@flamapy/ide-plugin-api)");
}
// Keep in sync with packages/ide-plugin-api/src/index.ts (sharedModules.test.ts checks it).
export const {
  PLUGIN_API_VERSION,
  PluginHost,
  SHARED_MODULES,
  compatibilityProblem,
  createContributionStore,
  createDocumentStore,
  createPluginSettings,
  createServiceRegistry,
  createWorkbench,
  isValidRange,
  isValidRemotePluginModule,
  loadRemotePlugin,
  satisfies,
  serviceId,
  validateManifest,
} = api;
