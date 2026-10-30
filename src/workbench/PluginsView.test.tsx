// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWorkbench, type FlamapyPlugin } from '@flamapy/ide-plugin-api';
import {
  Catalog,
  EngineWorker,
  type EngineWorkerService,
  type FlamapyPluginInfo,
} from '@flamapy/plugin-flamapy-engine';

import { createPluginsView } from './PluginsView';

const tool: FlamapyPlugin = {
  manifest: {
    id: 'acme.tool',
    name: 'Acme Tool',
    version: '1.2.0',
    description: 'Optimises configurations.',
    authors: [{ name: 'Ada Researcher', orcid: '0000-0002-1825-0097', affiliation: 'Uni' }],
    repository: 'https://github.com/acme/tool',
    license: 'MIT',
    citation: { text: 'Researcher, A. (2026). Acme Tool.', doi: '10.1145/1234567.1234568' },
  },
  activate() {},
};

const broken: FlamapyPlugin = {
  manifest: { id: 'acme.broken', name: 'Broken', version: '0.1.0', dependencies: ['acme.tool'] },
  activate() {
    throw new Error('boom');
  },
};

function info(overrides: Partial<FlamapyPluginInfo> & { key: string }): FlamapyPluginInfo {
  return {
    label: overrides.key.toUpperCase(),
    backend: overrides.key,
    description: `${overrides.key} backend`,
    preinstalled: false,
    available: true,
    installed: false,
    loaded: false,
    ...overrides,
  };
}

/** A stand-in for the flamapy engine's worker service, as the Plugins view uses it. */
function fakeEngine() {
  return {
    isLoaded: true,
    onStateChange: () => ({ dispose() {} }),
    flamapyPlugins: () => [
      info({ key: 'sat', label: 'SAT', version: '2.6.0', preinstalled: true, installed: true, loaded: true, repository: 'https://github.com/flamapy/pysat_metamodel' }),
      info({ key: 'sdd', label: 'SDD' }),
      info({ key: 'dnnf', label: 'd-DNNF', available: false, note: 'Needs d4.' }),
    ],
    urlPythonPlugins: () => [{ wheelRefs: ['https://example.org/flamapy_cool-1.0-py3-none-any.whl'] }],
    installFlamapyPlugin: vi.fn(async () => {}),
    removeFlamapyPlugin: vi.fn(async () => {}),
    installPythonPlugin: vi.fn(async () => {}),
    removePythonPlugin: vi.fn(async () => {}),
  } as unknown as EngineWorkerService & Record<string, ReturnType<typeof vi.fn>>;
}

async function setup(options: { engine?: EngineWorkerService } = {}) {
  const workbench = createWorkbench('', { host: { log: () => {} } });
  if (options.engine) {
    workbench.services.provide(EngineWorker, options.engine);
    workbench.services.provide(Catalog, { onDidChange: () => ({ dispose() {} }) } as never);
  }
  workbench.host.register(tool);
  workbench.host.register(broken);
  await workbench.host.activateAll();
  const PluginsView = createPluginsView(workbench);
  render(<PluginsView />);
  return { workbench };
}

afterEach(cleanup);

describe('Plugins view', () => {
  it('credits each plugin: description, authors, ORCID, links, license and citation', async () => {
    await setup();
    const card = screen.getByRole('article', { name: 'Acme Tool' });
    expect(within(card).getByText('Optimises configurations.')).toBeTruthy();
    expect(within(card).getByText('Active')).toBeTruthy();
    expect(within(card).getByTitle('ORCID 0000-0002-1825-0097').getAttribute('href')).toBe(
      'https://orcid.org/0000-0002-1825-0097',
    );
    expect(within(card).getByText('Source code ↗').getAttribute('href')).toBe(
      'https://github.com/acme/tool',
    );
    expect(within(card).getByText('License: MIT')).toBeTruthy();
    expect(within(card).getByText('doi:10.1145/1234567.1234568').getAttribute('href')).toBe(
      'https://doi.org/10.1145/1234567.1234568',
    );
  });

  it('shows why a plugin failed, and turns plugins off and on', async () => {
    const { workbench } = await setup();
    const brokenCard = screen.getByRole('article', { name: 'Broken' });
    expect(within(brokenCard).getByText('Failed')).toBeTruthy();
    expect(within(brokenCard).getByText('boom')).toBeTruthy();
    expect(within(brokenCard).getByText('Requires Acme Tool')).toBeTruthy();

    const toolCard = screen.getByRole('article', { name: 'Acme Tool' });
    await act(async () => {
      fireEvent.click(within(toolCard).getByRole('switch', { name: 'Turn off Acme Tool' }));
    });
    expect(workbench.host.get('acme.tool')?.state).toBe('disabled');
    expect(within(toolCard).getByText('Turned off')).toBeTruthy();

    await act(async () => {
      fireEvent.click(within(toolCard).getByRole('switch', { name: 'Turn on Acme Tool' }));
    });
    expect(workbench.host.get('acme.tool')?.state).toBe('active');
  });

  it('says so when the flamapy engine plugin is off', async () => {
    await setup();
    expect(screen.getByText(/The flamapy analysis engine is turned off/)).toBeTruthy();
  });

  it('shows flamapy plugins with the same cards, preinstalled ones like any other', async () => {
    await setup({ engine: fakeEngine() });
    const group = screen.getByRole('region', { name: 'flamapy plugins' });
    const sat = within(group).getByRole('article', { name: 'SAT' });
    expect(within(sat).getByText('Installed')).toBeTruthy();
    expect(within(sat).getByText('Preinstalled')).toBeTruthy();
    expect(within(sat).getByText('Source code ↗').getAttribute('href')).toBe(
      'https://github.com/flamapy/pysat_metamodel',
    );
    const dnnf = within(group).getByRole('article', { name: 'd-DNNF' });
    expect(within(dnnf).getByText('Not available in the browser')).toBeTruthy();
    expect(within(dnnf).getByRole('switch').hasAttribute('disabled')).toBe(true);
    const cool = within(group).getByRole('article', { name: 'flamapy_cool' });
    expect(within(sat).getByText('v2.6.0')).toBeTruthy();
    expect(within(cool).getByText('v1.0')).toBeTruthy();
    expect(within(dnnf).queryByText(/^v\d/)).toBeNull();
  });

  it('installs and removes flamapy plugins with the switch, confirming removals', async () => {
    const engine = fakeEngine();
    await setup({ engine });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const group = screen.getByRole('region', { name: 'flamapy plugins' });

    await act(async () => {
      fireEvent.click(within(within(group).getByRole('article', { name: 'SDD' })).getByRole('switch'));
    });
    expect(engine.installFlamapyPlugin).toHaveBeenCalledWith('sdd');

    await act(async () => {
      fireEvent.click(within(within(group).getByRole('article', { name: 'SAT' })).getByRole('switch'));
    });
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/restarts/));
    expect(engine.removeFlamapyPlugin).toHaveBeenCalledWith('sat');

    await act(async () => {
      fireEvent.click(
        within(within(group).getByRole('article', { name: 'flamapy_cool' })).getByRole('button', { name: 'Remove' }),
      );
    });
    expect(engine.removePythonPlugin).toHaveBeenCalledOnce();
    confirm.mockRestore();
  });
});
