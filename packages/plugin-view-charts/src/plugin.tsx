import { createElement, useEffect, useState, type ComponentType } from 'react';
import type { Disposable, FlamapyPlugin, PluginContext } from '@flamapy/ide-plugin-api';
import {
  Analysis,
  Catalog,
  EngineWorker,
  validModelGate,
  type AnalysisService,
  type EngineWorkerService,
} from '@flamapy/plugin-flamapy-engine';
// Direct file imports: the web-ui barrel pulls monaco (untestable in node) and remote
// bundles should not carry the whole UI kit.
// @ts-expect-error untyped JSX
import ProductDistributionChart from '@flamapy/web-ui/src/ProductDistributionChart.jsx';
// @ts-expect-error untyped JSX
import FeatureInclusionProbabilitiesChart from '@flamapy/web-ui/src/FeatureInclusionProbabilitiesChart.jsx';
// @ts-expect-error untyped JSX
import ParetoFrontChart from '@flamapy/web-ui/src/ParetoFrontChart.jsx';
// @ts-expect-error untyped JSX
import AttributeOptimizationModal from './ui/AttributeOptimizationModal.jsx';

export const CONFIG_DIST_VIEW_ID = 'flamapy.view.configdist';
export const FIP_VIEW_ID = 'flamapy.view.fip';
export const PARETO_VIEW_ID = 'flamapy.view.paretofront';

/** Command: show the Pareto-front view with the given optimization result. */
export const SHOW_PARETO_FRONT = 'flamapy.charts.showParetoFront';
/** Command: run the attribute-optimization flow (modal → execute → Pareto view). */
export const START_OPTIMIZATION = 'flamapy.optimization.start';

function makeFetchedChartView(options: {
  ctx: PluginContext;
  worker: EngineWorkerService;
  action: string;
  label: string;
  chart: ComponentType<{ data: unknown }>;
}) {
  const { ctx, worker, action, label, chart } = options;
  return function FetchedChartView() {
    const [data, setData] = useState<unknown>(null);

    // Recomputed on every open (the view is not keepMounted), matching the legacy flow.
    useEffect(() => {
      let cancelled = false;
      ctx.shell.output.show(label, 'Computing...');
      worker
        .call(action)
        .then((result) => {
          if (cancelled) return;
          setData(result);
          ctx.shell.output.show(label, 'Done');
        })
        .catch((error) => {
          if (!cancelled) ctx.shell.output.show(`${label} Error`, (error as Error).message);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    if (data === null) {
      return (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
          Computing…
        </div>
      );
    }
    return createElement(chart, { data });
  };
}

interface OptimizationGoal {
  selected: boolean;
  goal: string;
}

function makeOptimizationModal(options: {
  attributes: unknown;
  onExecute(goals: Array<{ attribute: string; goal: string }>): void;
  onCancel(): void;
}) {
  const { attributes, onExecute, onCancel } = options;
  return function OptimizationModalHost() {
    const [goals, setGoals] = useState<Record<string, OptimizationGoal>>({});
    return createElement(AttributeOptimizationModal, {
      attributes,
      goals,
      onToggle: (attribute: string, isChecked: boolean) =>
        setGoals((previous) => ({
          ...previous,
          [attribute]: { selected: isChecked, goal: previous[attribute]?.goal || 'Minimize' },
        })),
      onGoalChange: (attribute: string, newGoal: string) =>
        setGoals((previous) => ({
          ...previous,
          [attribute]: { ...previous[attribute]!, goal: newGoal },
        })),
      onExecute: () =>
        onExecute(
          Object.entries(goals)
            .filter(([, data]) => data.selected)
            .map(([attribute, data]) => ({ attribute, goal: data.goal })),
        ),
      onCancel,
    });
  };
}

/**
 * The BDD-gated metric charts plus the Pareto front of attribute optimization.
 *
 * configdist/fip register only while a bdd backend is installed (catalog-driven
 * register/dispose — installing flamapy-bdd at runtime surfaces the tabs live). The
 * Pareto view is dynamic: it appears when the optimization command (or any plugin)
 * executes SHOW_PARETO_FRONT with a result.
 */
export const chartsViewPlugin: FlamapyPlugin = {
  manifest: {
    id: 'flamapy.view.charts.plugin',
    name: 'Analysis Charts',
    version: '3.0.0',
    description:
      'Charts of analysis results: configuration distribution, feature inclusion probabilities and the Pareto front of attribute optimisations.',
    authors: [{ name: 'flamapy team', url: 'https://flamapy.github.io' }],
    repository: 'https://github.com/flamapy/flamapy-ide',
    homepage: 'https://flamapy.github.io',
    license: 'LGPL-3.0',
    dependencies: ['flamapy.engine'],
  },

  activate(ctx: PluginContext): void {
    const worker = ctx.services.get(EngineWorker);
    const catalog = ctx.services.get(Catalog);
    const analysis = ctx.services.get(Analysis);

    // --- BDD-gated chart views -----------------------------------------------------
    let bddViews: Disposable[] | null = null;
    const syncBddViews = () => {
      const hasBdd = catalog.installedBackends().includes('bdd');
      if (hasBdd && !bddViews) {
        bddViews = [
          ctx.shell.views.register({
            id: CONFIG_DIST_VIEW_ID,
            title: 'Config. Distribution',
            order: 20,
            component: makeFetchedChartView({
              ctx, worker,
              action: 'getConfigurationDistribution',
              label: 'Configuration Distribution',
              chart: ProductDistributionChart,
            }),
            onBeforeOpen: validModelGate(
              analysis,
              'The model is not valid. Fix syntax errors before computing distribution.',
            ),
          }),
          ctx.shell.views.register({
            id: FIP_VIEW_ID,
            title: 'Feature Prob.',
            order: 21,
            component: makeFetchedChartView({
              ctx, worker,
              action: 'getFeatureInclusionProbabilities',
              label: 'Feature Inclusion Probability',
              chart: FeatureInclusionProbabilitiesChart,
            }),
            onBeforeOpen: validModelGate(
              analysis,
              'The model is not valid. Fix syntax errors before computing probabilities.',
            ),
          }),
        ];
      } else if (!hasBdd && bddViews) {
        // Falls back to the source view if one of these was active.
        ctx.shell.views.close(CONFIG_DIST_VIEW_ID);
        ctx.shell.views.close(FIP_VIEW_ID);
        for (const registration of bddViews) registration.dispose();
        bddViews = null;
      }
    };
    syncBddViews();
    ctx.subscriptions.push(catalog.onDidChange(syncBddViews));
    ctx.subscriptions.push({
      dispose() {
        for (const registration of bddViews ?? []) registration.dispose();
      },
    });

    // --- Pareto front (dynamic view + commands) -------------------------------------
    let paretoData: unknown = null;
    function ParetoView() {
      return createElement(ParetoFrontChart, { data: paretoData });
    }
    ctx.subscriptions.push(
      ctx.shell.views.register({
        id: PARETO_VIEW_ID,
        title: 'Pareto Front',
        dynamic: true,
        component: ParetoView,
      }),
    );

    ctx.subscriptions.push(
      ctx.shell.commands.register(SHOW_PARETO_FRONT, (result) => {
        paretoData = result;
        void ctx.shell.views.open(PARETO_VIEW_ID);
      }),
    );

    // The Analysis menu entry, for the solvers that implement attribute optimization
    // (SAT: single-objective MaxSAT, Z3: multi-objective). Listed only while this plugin
    // is active, so it never points at a missing command.
    ctx.subscriptions.push(
      ctx.shell.menus.registerItem({
        id: 'flamapy.charts.attributeOptimization',
        menu: 'analysis',
        label: 'Attribute optimization',
        title: 'Optimise numerical feature attributes; shows the Pareto front',
        backends: ['sat', 'z3'],
        run: async () => {
          await ctx.shell.commands.execute(START_OPTIMIZATION, { backend: analysis.selectedSolver });
        },
      }),
    );

    ctx.subscriptions.push(
      ctx.shell.commands.register(START_OPTIMIZATION, async (args) => {
        const backend = ((args as { backend?: string }) ?? {}).backend || 'z3';
        const validation = await analysis.ensureValidated();
        if (!validation?.valid) {
          ctx.shell.output.show(
            'Attribute Optimization',
            'Error: the model is not valid. Fix syntax errors and retry.',
          );
          return;
        }
        let attributes: unknown;
        try {
          attributes = await analysis.getNumericalAttributes();
        } catch (error) {
          ctx.shell.output.show('Attribute extraction error', (error as Error).message);
          return;
        }
        ctx.shell.modals.open((close) => {
          const Modal = makeOptimizationModal({
            attributes,
            onCancel: close,
            onExecute: (goals) => {
              close();
              if (goals.length === 0) {
                ctx.shell.output.show(
                  'Optimization Error',
                  'No attributes selected for optimization.',
                );
                return;
              }
              ctx.shell.output.show('Attribute Optimization', 'Executing operation');
              worker
                .call('executeAttributeOptimization', { goals, backend })
                .then((result) => {
                  const typed = result as { label: string; result: { results_str: unknown } };
                  ctx.shell.output.show(typed.label, typed.result.results_str);
                  void ctx.shell.commands.execute(SHOW_PARETO_FRONT, typed.result);
                })
                .catch((error) =>
                  ctx.shell.output.show('Attribute Optimization', analysis.describeError(error)),
                );
            },
          });
          return createElement(Modal);
        });
      }),
    );
  },
};
