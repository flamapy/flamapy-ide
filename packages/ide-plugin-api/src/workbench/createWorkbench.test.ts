import { describe, expect, it, vi } from 'vitest';

import { createWorkbench } from './createWorkbench';

function makeView(id: string, overrides: Record<string, unknown> = {}) {
  return { id, title: id, component: () => null, ...overrides };
}

describe('workbench shell', () => {
  it('views.open runs the onBeforeOpen guard and only switches when it passes', async () => {
    const workbench = createWorkbench();
    let active: string | null = 'source';
    workbench.delegates.setActiveView = (id) => void (active = id);
    workbench.delegates.getActiveView = () => active;
    const output = vi.fn();
    workbench.delegates.showOutput = output;

    workbench.shell.views.register(
      makeView('gated', { onBeforeOpen: async () => ({ ok: false, message: 'model invalid' }) }),
    );
    workbench.shell.views.register(makeView('open'));

    expect(await workbench.shell.views.open('gated')).toBe(false);
    expect(active).toBe('source');
    expect(output).toHaveBeenCalledWith('gated', 'model invalid');

    expect(await workbench.shell.views.open('open')).toBe(true);
    expect(active).toBe('open');

    expect(await workbench.shell.views.open('unknown')).toBe(false);
  });

  it('views.close falls back to the source view only when closing the active view', () => {
    const workbench = createWorkbench();
    let active: string | null = 'a';
    workbench.delegates.setActiveView = (id) => void (active = id);
    workbench.delegates.getActiveView = () => active;
    workbench.shell.views.close('b');
    expect(active).toBe('a');
    workbench.shell.views.close('a');
    expect(active).toBe('source');
  });

  it('commands round-trip and reject duplicates/missing ids', async () => {
    const workbench = createWorkbench();
    workbench.shell.commands.register('double', (args) => (args as number) * 2);
    await expect(workbench.shell.commands.execute('double', 21)).resolves.toBe(42);
    expect(() => workbench.shell.commands.register('double', () => 0)).toThrow(/already/);
    await expect(workbench.shell.commands.execute('nope')).rejects.toThrow(/not registered/);
  });

  it('problems.set replaces a source wholesale and notifies subscribers', () => {
    const workbench = createWorkbench();
    const listener = vi.fn();
    workbench.problems.subscribe(listener);
    workbench.shell.problems.set('validation', [{ message: 'bad', severity: 'error' }]);
    workbench.shell.problems.set('validation', []);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(workbench.problems.get().get('validation')).toEqual([]);
  });

  it('fileHandlers resolves the longest extension match', () => {
    const workbench = createWorkbench();
    const generic = { extensions: ['json'], importToUVL: async () => 'g' };
    const specific = { extensions: ['gfm.json'], importToUVL: async () => 's' };
    workbench.shell.fileHandlers.register(generic);
    workbench.shell.fileHandlers.register(specific);
    expect(workbench.fileHandlers.forExtension('gfm.json')).toBe(specific);
    expect(workbench.fileHandlers.forExtension('json')).toBe(generic);
    expect(workbench.fileHandlers.forExtension('xyz')).toBeUndefined();
  });

  it('sidebar.show reveals registered panels only', () => {
    const workbench = createWorkbench();
    const shown: string[] = [];
    workbench.delegates.showSidebarPanel = (id) => void shown.push(id);
    workbench.shell.sidebar.register({ id: 'outline', title: 'Outline', side: 'left', component: () => null });
    workbench.shell.sidebar.show('outline');
    workbench.shell.sidebar.show('missing');
    expect(shown).toEqual(['outline']);
  });
});
