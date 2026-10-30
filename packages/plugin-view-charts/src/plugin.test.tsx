// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { createTestWorkbench, stubPlugin } from '@flamapy/ide-plugin-api/testing';
import { Analysis, Catalog, EngineWorker } from '@flamapy/plugin-flamapy-engine';

import { chartsViewPlugin } from './plugin';

const ITEM_ID = 'flamapy.charts.attributeOptimization';

function engineStub(selectedSolver: string) {
  const analysis = {
    selectedSolver,
    ensureValidated: vi.fn(async () => ({ valid: true })),
    getNumericalAttributes: vi.fn(async () => ['Price', 'Kcal']),
  };
  const plugin = stubPlugin('flamapy.engine', (ctx) => {
    ctx.subscriptions.push(
      ctx.services.provide(EngineWorker, { call: async () => null } as never),
      ctx.services.provide(Catalog, {
        installedBackends: () => [],
        onDidChange: () => ({ dispose() {} }),
      } as never),
      ctx.services.provide(Analysis, analysis as never),
    );
  });
  return { plugin, analysis };
}

describe('charts plugin: attribute optimization', () => {
  it('contributes its Analysis menu entry for SAT and Z3, and runs it for the selected solver', async () => {
    const wb = createTestWorkbench({ document: 'features\n\tRoot\n' });
    const { plugin, analysis } = engineStub('sat');
    await wb.activate(plugin, chartsViewPlugin);

    const item = wb.workbench.stores.menuItems.get(ITEM_ID);
    expect(item).toMatchObject({
      menu: 'analysis',
      label: 'Attribute optimization',
      backends: ['sat', 'z3'],
      pluginId: 'flamapy.view.charts.plugin',
    });

    await wb.update(() => item!.run());
    expect(analysis.ensureValidated).toHaveBeenCalled();
    expect(analysis.getNumericalAttributes).toHaveBeenCalled();
    expect(wb.modals).toHaveLength(1); // the optimization goals dialog

    await wb.dispose();
  });

  it('removes the entry when the plugin is turned off, so it never points at a missing command', async () => {
    const wb = createTestWorkbench();
    await wb.activate(engineStub('z3').plugin, chartsViewPlugin);
    await wb.workbench.host.setEnabled('flamapy.view.charts.plugin', false);
    expect(wb.workbench.stores.menuItems.get(ITEM_ID)).toBeUndefined();
    expect(wb.workbench.commands.ids()).not.toContain('flamapy.optimization.start');
    await wb.dispose();
  });
});
