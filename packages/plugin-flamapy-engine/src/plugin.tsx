import type { FlamapyPlugin, Marker, PluginContext } from '@flamapy/ide-plugin-api';
import { createElement } from 'react';

import { createAnalysisService } from './analysisService';
import {
  Analysis,
  Catalog,
  Configurator,
  EngineWorker,
  OPEN_BACKEND_SETTINGS,
  type ConfiguratorService,
  type ValidationResult,
} from './services';
import { createWorkerServices } from './workerService';
// @ts-expect-error untyped JSX components
import BackendSettingsModal from './ui/BackendSettingsModal.jsx';
// @ts-expect-error untyped JSX components
import ModelInformationPanel from './ui/ModelInformationPanel.jsx';

import { version } from '../package.json';

export const MODEL_INFO_PANEL_ID = 'flamapy.engine.modelInformation';

const infoIcon = createElement(
  'svg',
  { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', 'aria-hidden': true },
  createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    d: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  }),
);

function markersFrom(validation: ValidationResult | null): Marker[] {
  if (!validation || validation.valid) {
    return [];
  }
  const errors = (validation.errors ?? []).map(
    (message): Marker => ({ message: String(message), severity: 'error' }),
  );
  const warnings = validation.warnings
    ? (Array.isArray(validation.warnings) ? validation.warnings : [validation.warnings]).map(
        (message): Marker => ({ message: String(message), severity: 'warning' }),
      )
    : [];
  return [...errors, ...warnings];
}

/**
 * The flamapy analysis engine as a workbench plugin: owns the Pyodide worker (and the
 * remembered Python-wheel plugin installs), the capability catalog, validation and
 * WASM/REST operation dispatch — exposed as services. Registers the backend-settings
 * and plugin-manager modals behind shell commands so any chrome can open them.
 */
export const flamapyEnginePlugin: FlamapyPlugin = {
  manifest: {
    id: 'flamapy.engine',
    name: 'Flamapy Analysis Engine',
    version,
    description:
      'Runs flamapy in your browser (or on a flamapy REST server): validates the model, runs the analysis operations of every installed flamapy plugin and manages solver backends.',
    authors: [{ name: 'flamapy team', url: 'https://flamapy.github.io' }],
    repository: 'https://github.com/flamapy/flamapy-ide',
    homepage: 'https://flamapy.github.io',
    license: 'LGPL-3.0',
  },

  activate(ctx: PluginContext): void {
    const services = createWorkerServices();
    ctx.subscriptions.push({ dispose: () => services.dispose() });

    ctx.subscriptions.push(ctx.services.provide(EngineWorker, services.worker));
    ctx.subscriptions.push(ctx.services.provide(Catalog, services.catalog));

    const analysis = createAnalysisService({
      worker: services.worker,
      documents: ctx.shell.documents,
      onError: (label, message) => ctx.shell.output.show(label, message),
    });
    ctx.subscriptions.push(ctx.services.provide(Analysis, analysis));

    const configurator: ConfiguratorService = {
      start: () => services.worker.call('startConfigurator'),
      answerQuestion: (answer) => services.worker.call('answerQuestion', answer),
      undoAnswer: () => services.worker.call('undoAnswer'),
    };
    ctx.subscriptions.push(ctx.services.provide(Configurator, configurator));

    // Validation results surface as problem markers.
    ctx.subscriptions.push(
      analysis.onValidationChange(() => {
        ctx.shell.problems.set('flamapy', markersFrom(analysis.validation));
      }),
    );

    // The "Model information" side panel: validate and compute the model metrics.
    ctx.subscriptions.push(
      ctx.shell.sidebar.register({
        id: MODEL_INFO_PANEL_ID,
        title: 'Model information',
        side: 'right',
        icon: infoIcon,
        component: () =>
          createElement(ModelInformationPanel, {
            analysis,
            worker: services.worker,
            onError: (error: Error) => ctx.shell.output.show('Model information', error.message),
          }),
      }),
    );

    // Settings modals behind commands, so the activity bar (or any plugin) can open them.
    ctx.subscriptions.push(
      ctx.shell.commands.register(OPEN_BACKEND_SETTINGS, () => {
        ctx.shell.modals.open((close) =>
          createElement(BackendSettingsModal, {
            url: analysis.restApiUrl,
            onSave: (url: string) => {
              analysis.setRestApiUrl(url);
              close();
            },
            onCancel: close,
          }),
        );
      }),
    );
  },
};
