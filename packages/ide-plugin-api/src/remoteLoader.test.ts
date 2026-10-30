import { describe, expect, it } from 'vitest';

import { isValidRemotePluginModule, loadRemotePlugin } from './remoteLoader';

describe('remote plugin loader', () => {
  it('refuses to load when the experimental flag is off', async () => {
    await expect(
      loadRemotePlugin('https://example.com/plugin.js', { enabled: false }),
    ).rejects.toThrow(/experimental\.remotePlugins/);
  });

  it('rejects malformed URLs', async () => {
    await expect(loadRemotePlugin('::not a url::', { enabled: true })).rejects.toThrow(
      /Invalid remote plugin URL/,
    );
  });

  it('validates the module shape', () => {
    expect(isValidRemotePluginModule(undefined)).toBe(false);
    expect(isValidRemotePluginModule({})).toBe(false);
    expect(isValidRemotePluginModule({ manifest: { id: 'x' } })).toBe(false);
    expect(
      isValidRemotePluginModule({
        manifest: { id: 'x', name: 'X', version: '1.0.0' },
        activate: () => {},
      }),
    ).toBe(true);
    expect(
      isValidRemotePluginModule({
        manifest: { id: '', name: 'X', version: '1.0.0' },
        activate: () => {},
      }),
    ).toBe(false);
  });

  it('loads a data-URL module that satisfies the contract', async () => {
    const source = `export default {
      manifest: { id: 'remote.hello', name: 'Hello', version: '1.0.0', engines: { pluginApi: '^1.0.0' } },
      activate() {},
    }`;
    const url = `data:text/javascript;base64,${btoa(source)}`;
    const plugin = await loadRemotePlugin(url, { enabled: true });
    expect(plugin.manifest.id).toBe('remote.hello');
  });

  it('rejects a module without the plugin default export', async () => {
    const url = `data:text/javascript;base64,${btoa('export const x = 1')}`;
    await expect(loadRemotePlugin(url, { enabled: true })).rejects.toThrow(
      /does not default-export/,
    );
  });

  it('rejects a remote plugin that does not declare engines.pluginApi', async () => {
    const source = `export default {
      manifest: { id: 'remote.old', name: 'Old', version: '1.0.0' },
      activate() {},
    }`;
    const url = `data:text/javascript;base64,${btoa(source)}`;
    await expect(loadRemotePlugin(url, { enabled: true })).rejects.toThrow(
      /'remote\.old' has an invalid manifest: engines\.pluginApi is required/,
    );
  });
});
