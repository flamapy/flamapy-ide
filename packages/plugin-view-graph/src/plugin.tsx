import { useEffect, useState } from 'react';
import type { FlamapyPlugin, PluginContext } from '@flamapy/ide-plugin-api';
import {
  Analysis,
  validModelGate,
  type AnalysisService,
} from '@flamapy/plugin-flamapy-engine';
// Import the component file directly (not the package barrel): the barrel pulls monaco,
// which node cannot load in tests, and remote bundles should not carry the whole UI kit.
// @ts-expect-error web-ui is untyped JSX
import FeatureModelVisualization from '@flamapy/web-ui/src/FeatureModelVisualization.jsx';

export const GRAPH_VIEW_ID = 'flamapy.view.graph';

/** The `constraints` block lines, straight from the UVL text (rendered under the tree). */
export function constraintsFrom(code: string): string[] | null {
  const startIndex = code.indexOf('constraints');
  if (startIndex === -1) return null;
  return code
    .substring(startIndex)
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function makeGraphView(ctx: PluginContext, analysis: AnalysisService) {
  return function GraphView() {
    const [featureTree, setFeatureTree] = useState<unknown>(null);
    const [constraints, setConstraints] = useState<string[] | null>(null);

    // The view opens behind the valid-model gate, so the tree fetch is safe here; it
    // refreshes whenever validation succeeds again while the view stays open.
    useEffect(() => {
      let cancelled = false;
      const load = () => {
        if (analysis.validation && !analysis.validation.valid) return;
        analysis
          .getFeatureTree()
          .then((tree) => {
            if (!cancelled) {
              setFeatureTree(tree);
              setConstraints(constraintsFrom(ctx.shell.documents.getText()));
            }
          })
          .catch(() => {});
      };
      load();
      const subscription = analysis.onValidationChange(load);
      return () => {
        cancelled = true;
        subscription.dispose();
      };
    }, []);

    if (!featureTree) {
      return (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
          Building the feature tree…
        </div>
      );
    }
    return <FeatureModelVisualization treeData={featureTree} constraints={constraints} />;
  };
}

/** The feature-model graph (react-d3-tree) as a workbench view plugin. */
export const graphViewPlugin: FlamapyPlugin = {
  manifest: {
    id: 'flamapy.view.graph.plugin',
    name: 'Feature Model Graph',
    version: '3.0.0',
    description:
      'Draws the feature tree and its cross-tree constraints as an interactive graph.',
    authors: [{ name: 'flamapy team', url: 'https://flamapy.github.io' }],
    repository: 'https://github.com/flamapy/flamapy-ide',
    homepage: 'https://flamapy.github.io',
    license: 'LGPL-3.0',
    dependencies: ['flamapy.engine'],
  },
  activate(ctx: PluginContext): void {
    const analysis = ctx.services.get(Analysis);
    ctx.subscriptions.push(
      ctx.shell.views.register({
        id: GRAPH_VIEW_ID,
        title: 'Graph',
        order: 10,
        component: makeGraphView(ctx, analysis),
        onBeforeOpen: validModelGate(
          analysis,
          'The model is not valid. Fix syntax errors before visualizing.',
        ),
      }),
    );
  },
};
