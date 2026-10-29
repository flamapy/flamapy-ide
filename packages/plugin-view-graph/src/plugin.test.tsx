// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createTestWorkbench, stubPlugin } from '@flamapy/ide-plugin-api/testing';
import { Analysis, type AnalysisService } from '@flamapy/plugin-flamapy-engine';

import { constraintsFrom, graphViewPlugin, GRAPH_VIEW_ID } from './plugin';

function fakeAnalysis(): AnalysisService {
  return {
    validation: { valid: true },
    onValidationChange: () => ({ dispose() {} }),
    validateNow: async () => ({ valid: true }),
    ensureValidated: async () => ({ valid: true }),
    getFeatureTree: async () => ({ name: 'Root', children: [] }),
    getFeatures: async () => [],
    getNumericalAttributes: async () => [],
    runOperation: async () => ({ kind: 'text', value: '' }),
    runOperationData: async () => ({ display: null, data: null }),
    runOperationWithConfig: async () => null,
    exportModel: async () => '',
    describeError: () => '',
    computeBackend: 'wasm',
    restApiUrl: '',
    setComputeBackend() {},
    setRestApiUrl() {},
    onComputeBackendChange: () => ({ dispose() {} }),
    selectedSolver: 'sat',
    setSelectedSolver() {},
    onSelectedSolverChange: () => ({ dispose() {} }),
  };
}

describe('graph view plugin', () => {
  it('registers the gated graph view and its component renders', async () => {
    const wb = createTestWorkbench({ document: 'features\n\tRoot\nconstraints\n\tRoot => Root' });
    // Stub engine plugin providing a fake Analysis service.
    const engine = stubPlugin('flamapy.engine', (ctx) => {
      ctx.subscriptions.push(ctx.services.provide(Analysis, fakeAnalysis()));
    });
    await wb.activate(engine, graphViewPlugin);

    const view = await wb.openView(GRAPH_VIEW_ID);
    await wb.update(() => {}); // let the async getFeatureTree resolve
    expect(view.container.querySelector('svg')).not.toBeNull();
    await wb.dispose();
  });

  it('constraintsFrom extracts the constraints block lines', () => {
    expect(constraintsFrom('features\n\tA')).toBeNull();
    expect(constraintsFrom('features\n\tA\nconstraints\n\tA => B\n\n\t!C\n')).toEqual([
      'A => B',
      '!C',
    ]);
  });
});
