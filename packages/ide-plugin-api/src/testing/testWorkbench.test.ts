// @vitest-environment jsdom
import { createElement, useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { serviceId, type FlamapyPlugin } from '../types';
import { createTestWorkbench, stubPlugin } from './testWorkbench';

const Greeting = serviceId<{ text: string }>('test.greeting');

function GreetingView() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return createElement('p', null, ready ? 'hello from the view' : 'loading');
}

const viewPlugin: FlamapyPlugin = {
  manifest: { id: 'test.view', name: 'View', version: '1.0.0', dependencies: ['test.dep'] },
  activate(ctx) {
    const greeting = ctx.services.get(Greeting);
    ctx.subscriptions.push(
      ctx.shell.views.register({ id: 'test.view.main', title: 'Main', component: GreetingView }),
      ctx.shell.views.register({
        id: 'test.view.gated',
        title: 'Gated',
        component: GreetingView,
        onBeforeOpen: async () => ({ ok: false, message: 'model is void' }),
      }),
      ctx.shell.commands.register('test.view.write', () =>
        ctx.shell.documents.setText(greeting.text, 'test.view'),
      ),
    );
  },
};

const depPlugin = stubPlugin('test.dep', (ctx) => {
  ctx.subscriptions.push(ctx.services.provide(Greeting, { text: 'features\n\tHello\n' }));
});

describe('createTestWorkbench', () => {
  it('activates with stubbed dependencies, renders views and records document edits', async () => {
    const wb = createTestWorkbench({ document: 'features\n\tRoot\n' });
    await wb.activate(depPlugin, viewPlugin);
    expect(wb.activeView()).toBe('source');

    const seen: (string | null)[] = [];
    wb.shell.views.onDidChangeActive((id) => void seen.push(id));
    const view = await wb.openView('test.view.main');
    expect(view.container.textContent).toBe('hello from the view');
    expect(wb.activeView()).toBe('test.view.main');
    expect(seen).toEqual(['test.view.main']);

    await wb.update(() => wb.shell.commands.execute('test.view.write'));
    expect(wb.history.map((change) => change.origin)).toEqual(['test.view']);
    expect(wb.document.getText()).toBe('features\n\tHello\n');

    await wb.dispose();
    expect(view.container.isConnected).toBe(false);
  });

  it('rejects when a gate refuses, with the gate message', async () => {
    const wb = createTestWorkbench();
    await wb.activate(depPlugin, viewPlugin);
    await expect(wb.openView('test.view.gated')).rejects.toThrow(
      "View 'test.view.gated' refused to open: model is void.",
    );
    await expect(wb.openView('nope')).rejects.toThrow(/not registered/);
    await wb.dispose();
  });

  it('rejects a plugin that does not activate, with the reason', async () => {
    const wb = createTestWorkbench();
    await expect(wb.activate(viewPlugin)).rejects.toThrow(/depends on 'test\.dep'/);

    const broken = stubPlugin('test.broken', () => {
      throw new Error('boom');
    });
    await expect(createTestWorkbench().activate(broken)).rejects.toThrow(
      "Plugin 'test.broken' is failed: boom",
    );
    const future: FlamapyPlugin = {
      manifest: { id: 'test.future', name: 'F', version: '1.0.0', engines: { pluginApi: '^9.0.0' } },
      activate() {},
    };
    await expect(createTestWorkbench().activate(future)).rejects.toThrow(/is incompatible/);
  });

  it('rejects an invalid manifest before registering it', async () => {
    const invalid = { manifest: { id: 'x', name: 'X', version: '' }, activate() {} };
    await expect(createTestWorkbench().activate(invalid)).rejects.toThrow(
      "Plugin 'x' has an invalid manifest: version must be a non-empty string.",
    );
  });

  it('flags contributions that outlive deactivation', async () => {
    const leaky: FlamapyPlugin = {
      manifest: { id: 'test.leaky', name: 'Leaky', version: '1.0.0' },
      activate(ctx) {
        ctx.shell.commands.register('test.leaky.command', () => {}); // not in subscriptions
        ctx.subscriptions.push(ctx.shell.commands.register('test.leaky.ok', () => {}));
      },
    };
    const wb = createTestWorkbench();
    await wb.activate(leaky);
    await expect(wb.dispose()).rejects.toThrow(/command 'test\.leaky\.command'\.$/);
  });

  it('runs contributed operations with their inputs, progress and cancellation', async () => {
    const operations = stubPlugin('test.ops', (ctx) => {
      ctx.subscriptions.push(
        ctx.shell.operations.register({
          id: 'test.ops.count',
          menu: 'analysis',
          label: 'Count',
          inputs: [{ name: 'times', kind: 'integer', label: 'Times', required: true }],
          async run(args, run) {
            run.progress({ message: 'counting', fraction: 0.5 });
            if (run.signal.aborted) throw new Error('stopped');
            return { kind: 'json', value: { times: args.times } };
          },
        }),
      );
    });
    const wb = createTestWorkbench();
    await wb.activate(operations);
    expect(wb.workbench.stores.operations.get('test.ops.count')?.pluginId).toBe('test.ops');

    await expect(wb.runOperation('test.ops.count', { times: 2 })).resolves.toEqual({
      kind: 'json',
      value: { times: 2 },
    });
    expect(wb.progress).toEqual([{ message: 'counting', fraction: 0.5 }]);
    await expect(wb.runOperation('test.ops.count', {})).rejects.toThrow(/missing required times/);
    await expect(wb.runOperation('test.ops.count', { times: 1, typo: 1 })).rejects.toThrow(
      /no input named typo/,
    );
    const stop = new AbortController();
    stop.abort();
    await expect(
      wb.runOperation('test.ops.count', { times: 1 }, { signal: stop.signal }),
    ).rejects.toThrow('stopped');
    await wb.dispose();
  });
});
