// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWorkbench, type FlamapyPlugin } from '@flamapy/ide-plugin-api';

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

async function setup() {
  const workbench = createWorkbench('', { host: { log: () => {} } });
  workbench.host.register(tool);
  workbench.host.register(broken);
  await workbench.host.activateAll();
  const onManageFlamapyPlugins = vi.fn();
  const PluginsView = createPluginsView(workbench, { onManageFlamapyPlugins });
  render(<PluginsView />);
  return { workbench, onManageFlamapyPlugins };
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

  it('sends users to the flamapy plugin manager for Python plugins', async () => {
    const { onManageFlamapyPlugins } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Manage flamapy plugins…' }));
    expect(onManageFlamapyPlugins).toHaveBeenCalledOnce();
  });
});
