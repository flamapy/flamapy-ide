import { describe, expect, it } from 'vitest';

import { withContributedItems } from './menuContributions';

const run = () => {};
const names: Record<string, string> = { 'acme.a': 'Acme A', 'acme.b': 'Acme B' };
const pluginName = (id?: string) => names[id ?? ''] ?? 'Plugins';

describe('withContributedItems', () => {
  it('appends plugin items after a divider, under each plugin name, in order', () => {
    const options = withContributedItems(
      [{ label: 'Core features', value: 'core' }],
      [
        { id: 'a.2', menu: 'analysis', label: 'Second', run, order: 2, pluginId: 'acme.a' },
        { id: 'b.1', menu: 'analysis', label: 'From B', run, pluginId: 'acme.b' },
        { id: 'a.1', menu: 'analysis', label: 'First', run, order: 1, pluginId: 'acme.a', title: 'tip' },
        { id: 'x', menu: 'export', label: 'Elsewhere', run, pluginId: 'acme.a' },
      ],
      'analysis',
      { pluginName },
    );
    expect(options.map((option) => option.type ?? option.label)).toEqual([
      'Core features', 'divider', 'section', 'First', 'Second', 'section', 'From B',
    ]);
    expect(options.filter((option) => option.type === 'section').map((option) => option.label)).toEqual([
      'Acme A', 'Acme B',
    ]);
    expect(options[3]).toMatchObject({ key: 'a.1', title: 'tip', contributedItem: { id: 'a.1' } });
  });

  it('shows solver-specific analysis items only for those solvers', () => {
    const items = [
      { id: 'bdd.only', menu: 'analysis' as const, label: 'BDD only', run, backends: ['bdd'] },
    ];
    expect(withContributedItems([], items, 'analysis', { pluginName, selectedSolver: 'sat' })).toEqual([]);
    expect(
      withContributedItems([], items, 'analysis', { pluginName, selectedSolver: 'bdd' }).map(
        (option) => option.label,
      ),
    ).toEqual(['Plugins', 'BDD only']);
  });
});
