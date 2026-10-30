import type { PluginManifest } from './types';
import { isValidRange, PLUGIN_API_VERSION, satisfies } from './version';

const HTTPS_URL = /^https:\/\/\S+$/;
const ORCID = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
const DOI = /^10\.\d{4,9}\/\S+$/;

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim() !== '';
}

/**
 * Checks a manifest against the contract and returns human-readable problems (empty when
 * it is valid). Pass `{ remote: true }` for remotely loaded plugins, which must also
 * declare `engines.pluginApi`. Compatibility with this IDE is checked separately by
 * `compatibilityProblem`.
 */
export function validateManifest(
  candidate: unknown,
  options: { remote?: boolean } = {},
): string[] {
  if (typeof candidate !== 'object' || candidate === null) {
    return ['manifest must be an object'];
  }
  const manifest = candidate as Partial<Record<keyof PluginManifest, unknown>>;
  const problems: string[] = [];
  const optionalUrl = (field: 'repository' | 'homepage' | 'logo'): void => {
    const value = manifest[field];
    if (value === undefined) {
      return;
    }
    const valid =
      field === 'logo'
        ? isString(value) && (HTTPS_URL.test(value) || value.startsWith('data:image/'))
        : isString(value) && HTTPS_URL.test(value);
    if (!valid) {
      problems.push(
        field === 'logo'
          ? 'logo must be an https: URL or a data:image/ URI'
          : `${field} must be an https: URL`,
      );
    }
  };

  for (const field of ['id', 'name', 'version'] as const) {
    if (!isNonEmptyString(manifest[field])) {
      problems.push(`${field} must be a non-empty string`);
    }
  }
  if (
    manifest.dependencies !== undefined &&
    !(Array.isArray(manifest.dependencies) && manifest.dependencies.every(isNonEmptyString))
  ) {
    problems.push('dependencies must be an array of plugin ids');
  }

  const engines = manifest.engines as PluginManifest['engines'] | undefined;
  const range = engines?.pluginApi;
  if (range === undefined) {
    if (options.remote) {
      problems.push(
        `engines.pluginApi is required for remote plugins (e.g. '^${PLUGIN_API_VERSION}')`,
      );
    }
  } else if (!isString(range) || !isValidRange(range)) {
    problems.push(`engines.pluginApi '${String(range)}' is not a valid semver range`);
  }

  for (const field of ['description', 'license'] as const) {
    if (manifest[field] !== undefined && !isNonEmptyString(manifest[field])) {
      problems.push(`${field} must be a non-empty string`);
    }
  }
  optionalUrl('repository');
  optionalUrl('homepage');
  optionalUrl('logo');

  if (manifest.authors !== undefined) {
    if (!Array.isArray(manifest.authors)) {
      problems.push('authors must be an array of { name, affiliation?, url?, orcid? }');
    } else {
      manifest.authors.forEach((author: unknown, index) => {
        const entry = (author ?? {}) as Record<string, unknown>;
        if (!isNonEmptyString(entry.name)) {
          problems.push(`authors[${index}].name must be a non-empty string`);
        }
        if (entry.url !== undefined && !(isString(entry.url) && HTTPS_URL.test(entry.url))) {
          problems.push(`authors[${index}].url must be an https: URL`);
        }
        if (entry.orcid !== undefined && !(isString(entry.orcid) && ORCID.test(entry.orcid))) {
          problems.push(`authors[${index}].orcid must look like 0000-0002-1825-0097`);
        }
      });
    }
  }

  if (manifest.citation !== undefined) {
    const citation = (manifest.citation ?? {}) as Record<string, unknown>;
    if (!isNonEmptyString(citation.text)) {
      problems.push('citation.text must be a non-empty string');
    }
    if (citation.doi !== undefined && !(isString(citation.doi) && DOI.test(citation.doi))) {
      problems.push('citation.doi must be a bare DOI such as 10.1145/1234567.1234568');
    }
    if (citation.url !== undefined && !(isString(citation.url) && HTTPS_URL.test(citation.url))) {
      problems.push('citation.url must be an https: URL');
    }
    if (citation.bibtex !== undefined && !isNonEmptyString(citation.bibtex)) {
      problems.push('citation.bibtex must be a non-empty string');
    }
  }
  return problems;
}

/**
 * Why this IDE cannot run the plugin, or `null` when it can. A plugin without
 * `engines.pluginApi` is assumed compatible (built-ins are type-checked with the IDE).
 */
export function compatibilityProblem(manifest: PluginManifest): string | null {
  const range = manifest.engines?.pluginApi;
  if (range === undefined) {
    return null;
  }
  if (!isValidRange(range)) {
    return `Plugin '${manifest.id}' declares an invalid engines.pluginApi range '${range}'.`;
  }
  if (!satisfies(PLUGIN_API_VERSION, range)) {
    return (
      `Plugin '${manifest.id}' requires plugin API ${range}, ` +
      `but this IDE provides ${PLUGIN_API_VERSION}.`
    );
  }
  return null;
}
