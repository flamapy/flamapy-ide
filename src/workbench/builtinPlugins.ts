import type { FlamapyPlugin } from '@flamapy/ide-plugin-api';
import { flamapyEnginePlugin } from '@flamapy/plugin-flamapy-engine';
import { graphViewPlugin } from '@flamapy/plugin-view-graph';
import { chartsViewPlugin } from '@flamapy/plugin-view-charts';
import { flowMapViewPlugin } from '@flamapy/plugin-view-flowmap';
import { configuratorPlugin } from '@flamapy/plugin-configurator';

/**
 * First-party plugins compiled into the IDE, activated at workbench startup in
 * dependency order. The remaining view plugins register here as they are extracted
 * from the legacy EditorPage orchestration.
 */
export const builtinPlugins: FlamapyPlugin[] = [
  flamapyEnginePlugin,
  graphViewPlugin,
  chartsViewPlugin,
  flowMapViewPlugin,
  configuratorPlugin,
];
