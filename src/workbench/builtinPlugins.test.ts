import { describe, expect, it } from 'vitest';

import { validateManifest } from '@flamapy/ide-plugin-api';

import { builtinPlugins } from './builtinPlugins';

describe('built-in plugins', () => {
  it.each(builtinPlugins.map((plugin) => [plugin.manifest.id, plugin] as const))(
    '%s has a valid, attributed manifest',
    (_id, plugin) => {
      expect(validateManifest(plugin.manifest)).toEqual([]);
      expect(plugin.manifest.description).toBeTruthy();
      expect(plugin.manifest.repository).toBeTruthy();
      // Versioned from its package.json; the bundled plugins started at v3 with the plugin API.
      expect(Number(plugin.manifest.version.split('.')[0])).toBeGreaterThanOrEqual(3);
    },
  );
});
