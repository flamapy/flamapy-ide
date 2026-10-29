import { useEffect, useState } from 'react';

import {
  Analysis,
  Catalog,
  Configurator,
  EngineWorker,
  type AnalysisService,
  type CatalogService,
  type ConfiguratorService,
  type EngineWorkerService,
  type ValidationResult,
} from '@flamapy/plugin-flamapy-engine';

import type { Workbench } from '@flamapy/ide-plugin-api';

export interface EngineServices {
  worker: EngineWorkerService;
  catalog: CatalogService;
  analysis: AnalysisService;
  configurator: ConfiguratorService;
}

export interface EngineSnapshot {
  services: EngineServices | null;
  isLoaded: boolean;
  pluginCatalog: unknown;
  validation: ValidationResult | null;
  computeBackend: string | null;
  restApiUrl: string;
  selectedSolver: string;
}

/**
 * Reactive access to the engine plugin's services for the shell's React components.
 * `services` is null for the first frame (plugins activate in an effect); every other
 * field re-renders the consumer when the engine fires the matching change event.
 */
export function useEngine(workbench: Workbench): EngineSnapshot {
  const [services, setServices] = useState<EngineServices | null>(null);
  const [snapshot, setSnapshot] = useState({
    isLoaded: false,
    pluginCatalog: null as unknown,
    validation: null as ValidationResult | null,
    computeBackend: null as string | null,
    restApiUrl: '',
    selectedSolver: 'sat',
  });

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      workbench.services.whenAvailable(EngineWorker),
      workbench.services.whenAvailable(Catalog),
      workbench.services.whenAvailable(Analysis),
      workbench.services.whenAvailable(Configurator),
    ]).then(([worker, catalog, analysis, configurator]) => {
      if (!cancelled) {
        setServices({ worker, catalog, analysis, configurator });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workbench]);

  useEffect(() => {
    if (!services) {
      return;
    }
    const { worker, catalog, analysis } = services;
    const read = () => ({
      isLoaded: worker.isLoaded,
      pluginCatalog: catalog.catalog,
      validation: analysis.validation,
      computeBackend: analysis.computeBackend,
      restApiUrl: analysis.restApiUrl,
      selectedSolver: analysis.selectedSolver,
    });
    setSnapshot(read());
    const refresh = () => setSnapshot(read());
    const subscriptions = [
      worker.onStateChange(refresh),
      catalog.onDidChange(refresh),
      analysis.onValidationChange(refresh),
      analysis.onComputeBackendChange(refresh),
      analysis.onSelectedSolverChange(refresh),
    ];
    return () => {
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    };
  }, [services]);

  return { services, ...snapshot };
}
