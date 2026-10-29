import { compatibilityProblem, validateManifest } from '../manifest';
import { isValidRemotePluginModule } from '../remoteLoader';
import type { FlamapyPlugin } from '../types';
import { SHARED_MODULES } from '../version';

// `from "x"`, `import "x"` and `import("x")`, minified or not.
const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)(["'])([^"'\s]+)\1/g;
const REACT_INTERNALS = '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED';

function isBare(specifier: string): boolean {
  return !/^(\.{0,2}\/|[a-z][a-z0-9+.-]*:)/i.test(specifier) || specifier.startsWith('node:');
}

// Text that only looks like an import, e.g. a library's error message quoting
// `import '@xyflow/${name}/dist/style.css'` inside a template literal.
function isTemplateText(specifier: string): boolean {
  return /[${}]/.test(specifier);
}

/**
 * Checks a built remote plugin bundle the way the IDE will load it, and returns the
 * plugin so the test can go on to activate it. Pass the bundle's source text (for the
 * static checks) and the module it evaluates to (`await import(url)`). Throws one error
 * listing every problem:
 * - a bare import outside `SHARED_MODULES` (the import map can't resolve it), or a
 *   `node:` import;
 * - a bundled copy of React;
 * - no `{ manifest, activate }` default export, an invalid manifest (remote plugins must
 *   declare `engines.pluginApi`) or a range this API version doesn't satisfy.
 */
export function assertRemoteBundle(
  source: string,
  module: { default?: unknown },
): FlamapyPlugin {
  const problems: string[] = [];
  const shared = new Set<string>(Object.keys(SHARED_MODULES));
  const foreign = new Set<string>();
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[2]!;
    if (isBare(specifier) && !isTemplateText(specifier) && !shared.has(specifier)) {
      foreign.add(specifier);
    }
  }
  for (const specifier of foreign) {
    problems.push(
      `imports '${specifier}', which the IDE does not provide: bundle it, or import ` +
        `only ${[...shared].join(', ')} as bare specifiers`,
    );
  }
  if (source.includes(REACT_INTERNALS)) {
    problems.push(
      'bundles its own copy of React; build react, react-dom and react/jsx-runtime as externals',
    );
  }

  const plugin = module.default;
  if (!isValidRemotePluginModule(plugin)) {
    problems.push('does not default-export a { manifest, activate } plugin');
  } else {
    problems.push(...validateManifest(plugin.manifest, { remote: true }));
    const incompatible = compatibilityProblem(plugin.manifest);
    if (incompatible) {
      problems.push(incompatible);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Remote bundle is not loadable:\n- ${problems.join('\n- ')}`);
  }
  return plugin as FlamapyPlugin;
}
