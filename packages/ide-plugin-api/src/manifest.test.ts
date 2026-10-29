import { describe, expect, it } from 'vitest';

import { compatibilityProblem, validateManifest } from './manifest';
import type { PluginManifest } from './types';

const minimal: PluginManifest = { id: 'acme.tool', name: 'Tool', version: '1.0.0' };

describe('validateManifest', () => {
  it('accepts a minimal manifest and a fully attributed one', () => {
    expect(validateManifest(minimal)).toEqual([]);
    expect(
      validateManifest({
        ...minimal,
        engines: { pluginApi: '^1.0.0' },
        description: 'Draws feature models.',
        authors: [
          {
            name: 'Ada Researcher',
            affiliation: 'University of Somewhere',
            url: 'https://example.org/ada',
            orcid: '0000-0002-1825-0097',
          },
        ],
        repository: 'https://github.com/acme/tool',
        homepage: 'https://acme.example.org',
        license: 'MIT',
        logo: 'data:image/svg+xml;base64,PHN2Zy8+',
        citation: {
          text: 'Researcher, A. (2026). Tool. In SPLC 2026.',
          doi: '10.1145/1234567.1234568',
          bibtex: '@inproceedings{tool2026, ...}',
        },
      }),
    ).toEqual([]);
  });

  it('reports every problem in one pass', () => {
    expect(
      validateManifest({
        id: '',
        name: 'Tool',
        version: '1.0.0',
        engines: { pluginApi: 'latest' },
        repository: 'github.com/acme/tool',
        logo: '/logo.svg',
        authors: [{ name: 'Ada', orcid: '1234' }],
        citation: { doi: 'https://doi.org/10.1/x' },
      }),
    ).toEqual([
      'id must be a non-empty string',
      "engines.pluginApi 'latest' is not a valid semver range",
      'repository must be an https: URL',
      'logo must be an https: URL or a data:image/ URI',
      'authors[0].orcid must look like 0000-0002-1825-0097',
      'citation.text must be a non-empty string',
      'citation.doi must be a bare DOI such as 10.1145/1234567.1234568',
    ]);
    expect(validateManifest(null)).toEqual(['manifest must be an object']);
  });

  it('requires engines.pluginApi for remote plugins only', () => {
    expect(validateManifest(minimal, { remote: true })).toEqual([
      "engines.pluginApi is required for remote plugins (e.g. '^1.0.0')",
    ]);
    expect(
      validateManifest({ ...minimal, engines: { pluginApi: '^1.0.0' } }, { remote: true }),
    ).toEqual([]);
  });
});

describe('compatibilityProblem', () => {
  it('accepts plugins without a range or with a satisfied one', () => {
    expect(compatibilityProblem(minimal)).toBeNull();
    expect(compatibilityProblem({ ...minimal, engines: { pluginApi: '^1.0.0' } })).toBeNull();
  });

  it('explains an unsatisfied or invalid range', () => {
    expect(compatibilityProblem({ ...minimal, engines: { pluginApi: '^2.0.0' } })).toBe(
      "Plugin 'acme.tool' requires plugin API ^2.0.0, but this IDE provides 1.0.0.",
    );
    expect(compatibilityProblem({ ...minimal, engines: { pluginApi: 'two' } })).toMatch(
      /invalid engines\.pluginApi range 'two'/,
    );
  });
});
