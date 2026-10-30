import { version as reactVersion } from 'react';
import { describe, expect, it } from 'vitest';

import * as pluginApi from '@flamapy/ide-plugin-api';
import { PLUGIN_API_VERSION, SHARED_MODULES, satisfies } from '@flamapy/ide-plugin-api';

import pluginApiPackage from '../../packages/ide-plugin-api/package.json';

// The import map (vite.config.js) points each shared specifier at public/shared/<name>.js.
const shims = import.meta.glob<string>('/public/shared/*.js', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function shimFor(specifier: string): string | undefined {
  return shims[`/public/shared/${specifier.replace(/^@/, '').replaceAll('/', '-')}.js`];
}

describe('modules shared with remote plugins', () => {
  it('has a shim for every shared specifier', () => {
    for (const specifier of Object.keys(SHARED_MODULES)) {
      expect(shimFor(specifier), specifier).toBeDefined();
    }
  });

  it('re-exports every runtime export of @flamapy/ide-plugin-api from its shim', () => {
    const shim = shimFor('@flamapy/ide-plugin-api')!;
    const exported = /export const \{([^}]+)\}/.exec(shim)![1]!
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    expect(exported.sort()).toEqual(Object.keys(pluginApi).sort());
  });

  it('provides the versions it promises', () => {
    expect(satisfies(reactVersion, SHARED_MODULES.react)).toBe(true);
    expect(pluginApiPackage.version).toBe(PLUGIN_API_VERSION);
  });
});
