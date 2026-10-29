import { createElement, useEffect, useState } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import type { FlamapyPlugin, PluginContext } from '@flamapy/ide-plugin-api';
import {
  Analysis,
  EngineWorker,
  validModelGate,
  type AnalysisService,
  type OperationAction,
} from '@flamapy/plugin-flamapy-engine';
// Direct file imports (the web-ui barrel pulls monaco).
// @ts-expect-error untyped JSX
import Wizard from '@flamapy/web-ui/src/Wizard.jsx';
// @ts-expect-error untyped JSX
import FeatureTree from '@flamapy/web-ui/src/FeatureTree.jsx';

export const CONFIGURATOR_VIEW_ID = 'flamapy.view.configurator';
export const CONFIG_SIDEBAR_ID = 'flamapy.sidebar.configuration';

const configuratorIcon = createElement(
  'svg',
  { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', 'aria-hidden': true },
  createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    d: 'M4 6h16M4 12h10M4 18h7',
  }),
);

// Configuration-input operations — run from the configuration panel against the tree's
// current selection (a {feature: value} mapping). A `method` entry runs that mapping
// through the facade; a `value` entry drives a UI-only flow (wizard, download).
const CONFIG_OPERATIONS = [
  { label: 'Valid configuration', method: 'satisfiable_configuration' },
  { label: 'Filter', method: 'filter' },
  { label: 'Commonality', method: 'commonality' },
  { label: 'Diagnosis', method: 'diagnosis' },
  { label: 'Conflict', method: 'conflict' },
  { label: 'Interactive Configuration', value: 'configurator' },
  { label: 'Download Configurator', value: 'downloadConfigurator' },
];

/**
 * Interactive configuration: the wizard (a dynamic tab driven by the engine's
 * configurator session) and the configuration tree sidebar whose operations run against
 * the tree's current selection. The wizard's answer history highlights decisions in the
 * sidebar tree — shared through a tiny plugin-local observable.
 */
export const configuratorPlugin: FlamapyPlugin = {
  manifest: {
    id: 'flamapy.configurator.plugin',
    name: 'Interactive Configurator',
    version: '3.0.0',
    description:
      'Build a configuration step by step: flamapy answers each selection and propagates its consequences.',
    authors: [{ name: 'flamapy team', url: 'https://flamapy.github.io' }],
    repository: 'https://github.com/flamapy/flamapy-ide',
    homepage: 'https://flamapy.github.io',
    license: 'LGPL-3.0',
    dependencies: ['flamapy.engine'],
  },

  activate(ctx: PluginContext): void {
    const worker = ctx.services.get(EngineWorker);
    const analysis: AnalysisService = ctx.services.get(Analysis);

    // Wizard answer history, mirrored into the sidebar tree.
    let history: unknown = null;
    const historyListeners = new Set<() => void>();
    const setHistory = (next: unknown) => {
      history = next;
      for (const listener of [...historyListeners]) listener();
    };

    function WizardView() {
      return createElement(Wizard, {
        call: (action: string, data?: unknown) => worker.call(action, data),
        setHistory,
      });
    }

    ctx.subscriptions.push(
      ctx.shell.views.register({
        id: CONFIGURATOR_VIEW_ID,
        title: 'Configurator',
        dynamic: true,
        component: WizardView,
        onBeforeOpen: validModelGate(
          analysis,
          'The model is not valid. Fix syntax errors before configuring.',
        ),
      }),
    );

    async function runConfigOperation(
      action: (typeof CONFIG_OPERATIONS)[number],
      configuration: Record<string, unknown>,
    ): Promise<void> {
      const validation = await analysis.ensureValidated();
      if (!validation?.valid) {
        ctx.shell.output.show(
          action.label,
          'Error: the model is not valid. Fix syntax errors and retry.',
        );
        return;
      }
      if (action.method) {
        ctx.shell.output.show(action.label, 'Executing operation');
        try {
          const result = await analysis.runOperationWithConfig(
            action as OperationAction,
            configuration,
          );
          ctx.shell.output.show(action.label, result);
        } catch (error) {
          ctx.shell.output.show(action.label, analysis.describeError(error));
        }
      } else if (action.value === 'configurator') {
        void ctx.shell.views.open(CONFIGURATOR_VIEW_ID);
      } else if (action.value === 'downloadConfigurator') {
        await downloadConfiguratorZip();
      }
    }

    // Bundle the standalone flamapy.conf configurator with the current model.
    async function downloadConfiguratorZip(): Promise<void> {
      const zip = new JSZip();
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/flamapy.conf.zip`);
        if (!response.ok) throw new Error('Failed to load base.zip');
        const baseZip = await JSZip.loadAsync(await (await response.blob()).arrayBuffer());
        baseZip.forEach((relativePath, file) => zip.file(relativePath, file.async('arraybuffer')));
        const featureModel = new File(
          [ctx.shell.documents.getText()],
          'FeatureModel.uvl',
          { type: 'text/plain' },
        );
        zip.file(`models/${featureModel.name}`, featureModel);
        saveAs(await zip.generateAsync({ type: 'blob' }), 'configurator.zip');
      } catch (error) {
        console.error('Error processing ZIP:', error); // eslint-disable-line no-console
        ctx.shell.output.show(
          'Download Configurator',
          `Failed to generate the configurator ZIP: ${(error as Error).message}`,
        );
      }
    }

    function ConfigurationSidebar() {
      const [featureTree, setFeatureTree] = useState<unknown>(null);
      const [historyState, setHistoryState] = useState<unknown>(history);

      useEffect(() => {
        const listener = () => setHistoryState(history);
        historyListeners.add(listener);
        return () => void historyListeners.delete(listener);
      }, []);

      // The tree mirrors the last successfully validated model.
      useEffect(() => {
        let cancelled = false;
        const load = () => {
          if (!analysis.validation?.valid) return;
          analysis
            .getFeatureTree()
            .then((tree) => !cancelled && setFeatureTree(tree))
            .catch(() => {});
        };
        load();
        const subscription = analysis.onValidationChange(load);
        return () => {
          cancelled = true;
          subscription.dispose();
        };
      }, []);

      return createElement(FeatureTree, {
        treeData: featureTree,
        executeAction: runConfigOperation,
        operations: CONFIG_OPERATIONS,
        history: historyState,
      });
    }

    ctx.subscriptions.push(
      ctx.shell.sidebar.register({
        id: CONFIG_SIDEBAR_ID,
        title: 'Configurator',
        side: 'left',
        icon: configuratorIcon,
        component: ConfigurationSidebar,
      }),
    );
    // The configurator's panel accompanies its wizard view.
    ctx.subscriptions.push(
      ctx.shell.views.onDidChangeActive((id) => {
        if (id === CONFIGURATOR_VIEW_ID) {
          ctx.shell.sidebar.show(CONFIG_SIDEBAR_ID);
        }
      }),
    );
  },
};
