import { createElement, useState } from 'react';
import type { Disposable, FlamapyPlugin, PluginContext } from '@flamapy/ide-plugin-api';
import {
  Analysis,
  Catalog,
  EngineWorker,
  type AnalysisService,
} from '@flamapy/plugin-flamapy-engine';
// Direct file imports (the web-ui barrel pulls monaco).
// @ts-expect-error untyped JSX
import FeatureFlowMap from '@flamapy/web-ui/src/FeatureFlowMap.jsx';
// @ts-expect-error untyped JSX
import AttributeSelectionModal from './ui/AttributeSelectionModal.jsx';

export const FLOW_MAP_VIEW_ID = 'flamapy.view.ffm';

function makeAttributeModal(options: {
  attributes: unknown;
  onConfirm(attribute: string): void;
  onCancel(): void;
}) {
  return function AttributeModalHost() {
    const [selected, setSelected] = useState<string | null>(null);
    return createElement(AttributeSelectionModal, {
      attributes: options.attributes,
      selected,
      onSelect: setSelected,
      onConfirm: () => selected && options.onConfirm(selected),
      onCancel: options.onCancel,
    });
  };
}

/**
 * The feature flow map (d3) over a numerical attribute. Opening the tab first asks which
 * attribute to flow over (modal), computes the map, then switches to the view — the
 * legacy EditorPage flow, expressed through the view gate + a one-shot skip flag.
 */
export const flowMapViewPlugin: FlamapyPlugin = {
  manifest: {
    id: 'flamapy.view.flowmap.plugin',
    name: 'Feature Flow Map',
    version: '3.0.0',
    description:
      'Maps a numerical feature attribute over the feature tree, showing where its values sit.',
    authors: [{ name: 'flamapy team', url: 'https://flamapy.github.io' }],
    repository: 'https://github.com/flamapy/flamapy-ide',
    homepage: 'https://flamapy.github.io',
    license: 'LGPL-3.0',
    dependencies: ['flamapy.engine'],
  },

  activate(ctx: PluginContext): void {
    const worker = ctx.services.get(EngineWorker);
    const catalog = ctx.services.get(Catalog);
    const analysis: AnalysisService = ctx.services.get(Analysis);

    let data: unknown = null;
    // Set right before the programmatic open() that follows a computed flow map, so the
    // gate lets that open through without re-prompting for an attribute.
    let openComputed = false;

    function FlowMapView() {
      return createElement(FeatureFlowMap, { data });
    }

    async function promptAndCompute(): Promise<void> {
      const validation = await analysis.ensureValidated();
      if (!validation?.valid) {
        ctx.shell.output.show(
          'Feature Flow Map',
          'The model is not valid. Fix syntax errors before computing the feature flow map.',
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
        const Modal = makeAttributeModal({
          attributes,
          onCancel: close,
          onConfirm: (attribute) => {
            close();
            ctx.shell.output.show('Feature Flow Map', 'Executing operation');
            worker
              .call('getFeatureFlowMap', attribute)
              .then((result) => {
                data = result;
                ctx.shell.output.show('Feature Flow Map', 'Done');
                openComputed = true;
                void ctx.shell.views.open(FLOW_MAP_VIEW_ID);
              })
              .catch((error) =>
                ctx.shell.output.show('Feature Flow Map', analysis.describeError(error)),
              );
          },
        });
        return createElement(Modal);
      });
    }

    let registration: Disposable | null = null;
    const syncView = () => {
      const hasBdd = catalog.installedBackends().includes('bdd');
      if (hasBdd && !registration) {
        registration = ctx.shell.views.register({
          id: FLOW_MAP_VIEW_ID,
          title: 'Feature Flow Map',
          order: 30,
          component: FlowMapView,
          async onBeforeOpen() {
            if (openComputed) {
              openComputed = false;
              return { ok: true };
            }
            void promptAndCompute();
            return { ok: false }; // stay put; the confirm handler re-opens with data
          },
        });
      } else if (!hasBdd && registration) {
        ctx.shell.views.close(FLOW_MAP_VIEW_ID);
        registration.dispose();
        registration = null;
      }
    };
    syncView();
    ctx.subscriptions.push(catalog.onDidChange(syncView));
    ctx.subscriptions.push({ dispose: () => registration?.dispose() });
  },
};
