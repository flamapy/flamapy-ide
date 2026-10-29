/**
 * `@flamapy/ide-plugin-api/testing`: helpers for testing a plugin against the IDE's real
 * shell core in a test runner (Vitest/Jest with jsdom). Not loaded by the IDE itself.
 */
export { createTestWorkbench, stubPlugin } from './testWorkbench';
export type { RenderedView, TestWorkbench, TestWorkbenchOptions } from './testWorkbench';
export { assertRemoteBundle } from './remoteBundle';
export { installDomPolyfills } from './polyfills';
