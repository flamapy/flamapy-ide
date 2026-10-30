import type { AnalysisService } from './services';

/**
 * The standard `ViewDescriptor.onBeforeOpen` guard: the view opens only when the current
 * document validates. Reuses the engine's staleness-aware `ensureValidated`.
 */
export function validModelGate(
  analysis: AnalysisService,
  message: string,
): () => Promise<{ ok: boolean; message?: string }> {
  return async () => {
    const validation = await analysis.ensureValidated();
    return validation?.valid ? { ok: true } : { ok: false, message };
  };
}
