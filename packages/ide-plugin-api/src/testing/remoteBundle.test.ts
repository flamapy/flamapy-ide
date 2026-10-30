import { describe, expect, it } from 'vitest';

import { assertRemoteBundle } from './remoteBundle';

const plugin = {
  manifest: { id: 'remote.x', name: 'X', version: '1.0.0', engines: { pluginApi: '^1.0.0' } },
  activate() {},
};

describe('assertRemoteBundle', () => {
  it('accepts shared, relative and URL imports and returns the plugin', () => {
    const source = [
      'import{jsx as e}from"react/jsx-runtime";',
      "import { useState } from 'react';",
      'import "./styles.css";',
      'const chunk = () => import("./chunk-abc.js");',
      'import x from "https://cdn.example.org/lib.js";',
      // A library's error message, not an import:
      'throw new Error(`add import \'@xyflow/${pkg}/dist/style.css\'`);',
    ].join('\n');
    expect(assertRemoteBundle(source, { default: plugin })).toBe(plugin);
  });

  it('lists every problem at once', () => {
    const source = [
      'import { create } from "zustand";',
      'import fs from "node:fs";',
      'var x = { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {} };',
    ].join('\n');
    const withoutEngines = { ...plugin, manifest: { id: 'remote.x', name: 'X', version: '1.0.0' } };
    let message = '';
    try {
      assertRemoteBundle(source, { default: withoutEngines });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/imports 'zustand', which the IDE does not provide/);
    expect(message).toMatch(/imports 'node:fs'/);
    expect(message).toMatch(/bundles its own copy of React/);
    expect(message).toMatch(/engines\.pluginApi is required for remote plugins/);
  });

  it('rejects a module without the plugin default export or with an unsupported range', () => {
    expect(() => assertRemoteBundle('', {})).toThrow(/does not default-export/);
    const future = { ...plugin, manifest: { ...plugin.manifest, engines: { pluginApi: '^2.0.0' } } };
    expect(() => assertRemoteBundle('', { default: future })).toThrow(
      /requires plugin API \^2\.0\.0, but this IDE provides 1\.0\.0/,
    );
  });
});
