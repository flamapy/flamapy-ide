import { describe, expect, it, vi } from 'vitest';

import { PluginHost } from './pluginHost';
import { createServiceRegistry } from './serviceRegistry';
import type { FlamapyPlugin, ShellApi } from './types';

const shell = {} as ShellApi; // the host never dereferences it itself

function makeHost(log = vi.fn(), activationTimeoutMs?: number) {
  return { host: new PluginHost(shell, createServiceRegistry(), { log, activationTimeoutMs }), log };
}

function plugin(
  id: string,
  options: {
    dependencies?: string[];
    activate?: FlamapyPlugin['activate'];
    deactivate?: FlamapyPlugin['deactivate'];
  } = {},
): FlamapyPlugin {
  return {
    manifest: { id, name: id, version: '0.0.0', dependencies: options.dependencies },
    activate: options.activate ?? (() => {}),
    deactivate: options.deactivate,
  };
}

describe('PluginHost activation', () => {
  it('activates dependencies before dependents regardless of registration order', async () => {
    const { host } = makeHost();
    const order: string[] = [];
    host.register(plugin('c', { dependencies: ['b'], activate: () => void order.push('c') }));
    host.register(plugin('a', { activate: () => void order.push('a') }));
    host.register(plugin('b', { dependencies: ['a'], activate: () => void order.push('b') }));
    await host.activateAll();
    expect(order).toEqual(['a', 'b', 'c']);
    expect(host.list().every((record) => record.state === 'active')).toBe(true);
  });

  it('throws on dependency cycles', async () => {
    const { host } = makeHost();
    host.register(plugin('a', { dependencies: ['b'] }));
    host.register(plugin('b', { dependencies: ['a'] }));
    await expect(host.activateAll()).rejects.toThrow(/cycle/);
  });

  it('skips a plugin whose dependency is not installed, with the reason', async () => {
    const { host } = makeHost();
    host.register(plugin('a', { dependencies: ['ghost'] }));
    await host.activateAll();
    expect(host.get('a')?.state).toBe('skipped');
    expect(String(host.get('a')?.error)).toMatch(/depends on 'ghost', which is not installed/);
  });

  it('marks a plugin whose activate hangs as failed after the timeout', async () => {
    const { host } = makeHost(vi.fn(), 20);
    const late = vi.fn();
    let finish = () => {};
    host.register(
      plugin('slow', {
        activate: (ctx) =>
          new Promise<void>((resolve) => {
            finish = () => {
              ctx.subscriptions.push({ dispose: late });
              resolve();
            };
          }),
      }),
    );
    host.register(plugin('next'));
    await host.activateAll();
    expect(host.get('slow')?.state).toBe('failed');
    expect(String(host.get('slow')?.error)).toMatch(/did not finish within 20 ms/);
    expect(host.get('next')?.state).toBe('active');
    // What the hung activate registers when it finally completes is undone.
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(late).toHaveBeenCalledOnce();
  });

  it('rejects duplicate plugin ids', () => {
    const { host } = makeHost();
    host.register(plugin('a'));
    expect(() => host.register(plugin('a'))).toThrow(/already registered/);
  });

  it('isolates an activation failure and skips its dependents', async () => {
    const { host, log } = makeHost();
    host.register(
      plugin('broken', {
        activate: () => {
          throw new Error('boom');
        },
      }),
    );
    host.register(plugin('dependent', { dependencies: ['broken'] }));
    host.register(plugin('bystander'));
    await host.activateAll();
    expect(host.get('broken')?.state).toBe('failed');
    expect(host.get('dependent')?.state).toBe('skipped');
    expect(host.get('bystander')?.state).toBe('active');
    expect(log).toHaveBeenCalled();
  });

  it('disposes the failed plugin partial subscriptions', async () => {
    const { host } = makeHost();
    const dispose = vi.fn();
    host.register(
      plugin('broken', {
        activate: (ctx) => {
          ctx.subscriptions.push({ dispose });
          throw new Error('boom');
        },
      }),
    );
    await host.activateAll();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('records an incompatible plugin instead of activating it, and skips its dependents', async () => {
    const { host, log } = makeHost();
    const activate = vi.fn();
    host.register({
      manifest: { id: 'future', name: 'Future', version: '1.0.0', engines: { pluginApi: '^2.0.0' } },
      activate,
    });
    host.register(plugin('dependent', { dependencies: ['future'] }));
    host.register({
      manifest: { id: 'current', name: 'Current', version: '1.0.0', engines: { pluginApi: '^1.0.0' } },
      activate: () => {},
    });
    await host.activateAll();
    expect(activate).not.toHaveBeenCalled();
    expect(host.get('future')?.state).toBe('incompatible');
    expect(String(host.get('future')?.error)).toMatch(/requires plugin API \^2\.0\.0/);
    expect(host.get('dependent')?.state).toBe('skipped');
    expect(host.get('current')?.state).toBe('active');
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/requires plugin API/));
  });

  it('activateOne registers and activates late plugins (remote loading path)', async () => {
    const { host } = makeHost();
    host.register(plugin('base'));
    await host.activateAll();
    const record = await host.activateOne(plugin('late', { dependencies: ['base'] }));
    expect(record.state).toBe('active');
  });
});

describe('PluginHost deactivation', () => {
  it('deactivates in reverse order and disposes subscriptions newest-first', async () => {
    const { host } = makeHost();
    const events: string[] = [];
    for (const id of ['a', 'b']) {
      host.register(
        plugin(id, {
          dependencies: id === 'b' ? ['a'] : undefined,
          activate: (ctx) => {
            ctx.subscriptions.push({ dispose: () => void events.push(`${id}.sub1`) });
            ctx.subscriptions.push({ dispose: () => void events.push(`${id}.sub2`) });
          },
          deactivate: () => void events.push(`${id}.deactivate`),
        }),
      );
    }
    await host.activateAll();
    await host.deactivateAll();
    expect(events).toEqual([
      'b.deactivate', 'b.sub2', 'b.sub1',
      'a.deactivate', 'a.sub2', 'a.sub1',
    ]);
    expect(host.list().every((record) => record.state === 'deactivated')).toBe(true);
  });
});

describe('PluginHost runtime lifecycle', () => {
  function tracked(id: string, events: string[], dependencies?: string[]): FlamapyPlugin {
    return plugin(id, {
      dependencies,
      activate: (ctx) => {
        events.push(`+${id}`);
        ctx.subscriptions.push({ dispose: () => void events.push(`-${id}`) });
      },
    });
  }

  it('disables a plugin with its dependents and brings them back on enable', async () => {
    const { host } = makeHost();
    const events: string[] = [];
    host.register(tracked('base', events));
    host.register(tracked('view', events, ['base']));
    host.register(tracked('other', events));
    await host.activateAll();
    events.length = 0;

    await host.setEnabled('base', false);
    expect(events).toEqual(['-view', '-base']);
    expect(host.get('base')?.state).toBe('disabled');
    expect(host.get('view')?.state).toBe('skipped');
    expect(host.get('other')?.state).toBe('active');
    expect(host.isEnabled('base')).toBe(false);

    events.length = 0;
    await host.setEnabled('base', true);
    expect(events).toEqual(['+base', '+view']);
    expect(host.list().every((record) => record.state === 'active')).toBe(true);
  });

  it('starts disabled plugins as disabled, using the enablement store', async () => {
    const enablement = { isEnabled: (id: string) => id !== 'off', setEnabled: vi.fn() };
    const host = new PluginHost(shell, createServiceRegistry(), { enablement, log: vi.fn() });
    host.register(plugin('off'));
    host.register(plugin('needs-off', { dependencies: ['off'] }));
    await host.activateAll();
    expect(host.get('off')?.state).toBe('disabled');
    expect(host.get('needs-off')?.state).toBe('skipped');
    await host.setEnabled('off', true);
    expect(enablement.setEnabled).toHaveBeenCalledWith('off', true);
  });

  it('reloads a plugin, swapping in a new build', async () => {
    const { host } = makeHost();
    const events: string[] = [];
    host.register(tracked('remote', events));
    host.register(tracked('dependent', events, ['remote']));
    await host.activateAll();
    events.length = 0;

    const v2: FlamapyPlugin = {
      manifest: { id: 'remote', name: 'Remote', version: '2.0.0' },
      activate: () => void events.push('+remote@2'),
    };
    const record = await host.reload('remote', v2);
    expect(events).toEqual(['-dependent', '-remote', '+remote@2', '+dependent']);
    expect(record.plugin.manifest.version).toBe('2.0.0');
    expect(record.state).toBe('active');
    await expect(host.reload('remote', plugin('other'))).rejects.toThrow(/Cannot reload/);
  });

  it('retries a failed plugin on reload', async () => {
    const { host } = makeHost();
    let attempts = 0;
    host.register(
      plugin('flaky', {
        activate: () => {
          attempts += 1;
          if (attempts === 1) throw new Error('first time');
        },
      }),
    );
    await host.activateAll();
    expect(host.get('flaky')?.state).toBe('failed');
    expect((await host.reload('flaky')).state).toBe('active');
  });

  it('unregisters a plugin; its dependents are skipped', async () => {
    const { host } = makeHost();
    const events: string[] = [];
    host.register(tracked('remote', events), { source: { kind: 'remote', url: 'https://x/p.js' } });
    host.register(tracked('dependent', events, ['remote']));
    await host.activateAll();
    expect(host.get('remote')?.source).toEqual({ kind: 'remote', url: 'https://x/p.js' });
    expect(host.get('dependent')?.source).toEqual({ kind: 'builtin' });

    await host.unregister('remote');
    expect(host.get('remote')).toBeUndefined();
    expect(host.get('dependent')?.state).toBe('skipped');
    expect(String(host.get('dependent')?.error)).toMatch(/not installed/);
  });

  it('reports every state change', async () => {
    const { host } = makeHost();
    const seen: string[] = [];
    host.onDidChange((record) => void seen.push(`${record.plugin.manifest.id}:${record.state}`));
    host.register(plugin('a'));
    await host.activateAll();
    await host.setEnabled('a', false);
    expect(seen).toEqual(['a:registered', 'a:active', 'a:disabled']);
  });
});
