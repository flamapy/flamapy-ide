import { validateManifest } from './manifest';
import type { FlamapyPlugin } from './types';

/**
 * Loads a remotely hosted ESM plugin bundle. Experimental — the caller (the shell) gates
 * this behind the `experimental.remotePlugins` setting; this module only implements the
 * mechanics.
 *
 * The contract for remote bundles: default-export a `{ manifest, activate }` object whose
 * manifest declares `engines.pluginApi`, and build with the `SHARED_MODULES` specifiers
 * (`react`, `react-dom`, `react/jsx-runtime`, `@flamapy/ide-plugin-api`) as externals — the
 * shell's import map resolves those to its own instances, so the bundle never carries a
 * second React copy. Relative imports (lazy chunks, assets) resolve against the bundle URL.
 */
export function isValidRemotePluginModule(candidate: unknown): candidate is FlamapyPlugin {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const plugin = candidate as Partial<FlamapyPlugin>;
  const manifest = plugin.manifest as Partial<FlamapyPlugin['manifest']> | undefined;
  return (
    typeof plugin.activate === 'function' &&
    typeof manifest?.id === 'string' &&
    manifest.id.length > 0 &&
    typeof manifest.name === 'string' &&
    typeof manifest.version === 'string'
  );
}

export async function loadRemotePlugin(
  url: string,
  options: { enabled: boolean },
): Promise<FlamapyPlugin> {
  if (!options.enabled) {
    throw new Error(
      'Remote plugin loading is disabled. Enable the experimental.remotePlugins setting.',
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url, globalThis.location?.href);
  } catch {
    throw new Error(`Invalid remote plugin URL: ${url}`);
  }
  const module: { default?: unknown } = await import(/* @vite-ignore */ parsed.href);
  if (!isValidRemotePluginModule(module.default)) {
    throw new Error(
      `Remote module at ${url} does not default-export a { manifest, activate } plugin.`,
    );
  }
  const problems = validateManifest(module.default.manifest, { remote: true });
  if (problems.length > 0) {
    throw new Error(
      `Remote plugin '${module.default.manifest.id}' has an invalid manifest: ${problems.join('; ')}.`,
    );
  }
  return module.default;
}
