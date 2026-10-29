import {
  createPluginSettings,
  loadRemotePlugin,
  type PluginHostOptions,
  type PluginRecord,
  type Workbench,
} from '@flamapy/ide-plugin-api';

// Shell settings namespace for plugin management: which plugins the user turned off,
// the experimental remote-plugin loader flag and the remembered remote plugin URLs.
const settings = createPluginSettings('shell');
const DISABLED_KEY = 'plugins.disabled';
const FLAG_KEY = 'experimental.remotePlugins';
const URLS_KEY = 'remotePlugins.urls';

/** Persists the plugins the user turned off in the Plugins view. */
export const pluginEnablement: NonNullable<PluginHostOptions['enablement']> = {
  isEnabled: (id) => !settings.get<string[]>(DISABLED_KEY, []).includes(id),
  setEnabled(id, enabled) {
    const others = settings.get<string[]>(DISABLED_KEY, []).filter((entry) => entry !== id);
    settings.set(DISABLED_KEY, enabled ? others : [...others, id]);
  },
};

export function remotePluginsEnabled(): boolean {
  return settings.get(FLAG_KEY, false);
}

export function setRemotePluginsEnabled(enabled: boolean): void {
  settings.set(FLAG_KEY, enabled);
}

export function remotePluginUrls(): string[] {
  return settings.get<string[]>(URLS_KEY, []);
}

function remember(url: string): void {
  const urls = remotePluginUrls();
  if (!urls.includes(url)) {
    settings.set(URLS_KEY, [...urls, url]);
  }
}

function forget(url: string): void {
  settings.set(
    URLS_KEY,
    remotePluginUrls().filter((entry) => entry !== url),
  );
}

function recordFor(workbench: Workbench, url: string): PluginRecord | undefined {
  return workbench.host
    .list()
    .find((record) => record.source.kind === 'remote' && record.source.url === url);
}

function describeInactive(record: PluginRecord): string {
  const { id } = record.plugin.manifest;
  const reason = record.error instanceof Error ? ` ${record.error.message}` : '';
  switch (record.state) {
    case 'incompatible':
      return reason.trim();
    case 'skipped':
      return `Plugin '${id}' was skipped:${reason}`;
    case 'disabled':
      return `Plugin '${id}' is installed but turned off.`;
    default:
      return `Plugin '${id}' failed to activate.${reason}`;
  }
}

/**
 * Load one remote plugin into the running workbench and remember its URL. Loading a URL
 * that is already installed reloads it (picks up a new build). A plugin whose id is
 * already taken by another plugin is refused.
 */
export async function addRemotePlugin(workbench: Workbench, url: string): Promise<void> {
  const existing = recordFor(workbench, url);
  if (existing) {
    await reloadRemotePlugin(workbench, url);
    return;
  }
  const plugin = await loadRemotePlugin(url, { enabled: remotePluginsEnabled() });
  const { id } = plugin.manifest;
  const taken = workbench.host.get(id);
  if (taken) {
    const where =
      taken.source.kind === 'builtin' ? 'a built-in plugin' : `the plugin loaded from ${taken.source.url}`;
    throw new Error(`The id '${id}' is already used by ${where}.`);
  }
  const record = await workbench.host.activateOne(plugin, { source: { kind: 'remote', url } });
  remember(url);
  if (record.state !== 'active') {
    throw new Error(describeInactive(record));
  }
}

/** Re-import a remote plugin's bundle (bypassing the module cache) and swap it in. */
export async function reloadRemotePlugin(workbench: Workbench, url: string): Promise<void> {
  const record = recordFor(workbench, url);
  if (!record) {
    throw new Error(`No plugin is loaded from ${url}.`);
  }
  // ES modules are cached per URL: a query string makes the browser fetch the entry anew.
  const fresh = `${url}${url.includes('?') ? '&' : '?'}reload=${Date.now()}`;
  const plugin = await loadRemotePlugin(fresh, { enabled: true });
  if (plugin.manifest.id !== record.plugin.manifest.id) {
    throw new Error(
      `${url} now provides '${plugin.manifest.id}' instead of '${record.plugin.manifest.id}'.`,
    );
  }
  const reloaded = await workbench.host.reload(plugin.manifest.id, plugin);
  if (reloaded.state !== 'active' && reloaded.state !== 'disabled') {
    throw new Error(describeInactive(reloaded));
  }
}

/** Deactivate and remove a remote plugin, and forget its URL. */
export async function removeRemotePlugin(workbench: Workbench, url: string): Promise<void> {
  const record = recordFor(workbench, url);
  if (record) {
    await workbench.host.unregister(record.plugin.manifest.id);
  }
  forget(url);
}

/** Startup: load every remembered remote plugin (no-op while the flag is off). */
export async function loadRememberedRemotePlugins(workbench: Workbench): Promise<void> {
  if (!remotePluginsEnabled()) {
    return;
  }
  for (const url of remotePluginUrls()) {
    try {
      const plugin = await loadRemotePlugin(url, { enabled: true });
      if (workbench.host.get(plugin.manifest.id)) {
        throw new Error(`The id '${plugin.manifest.id}' is already in use.`);
      }
      await workbench.host.activateOne(plugin, { source: { kind: 'remote', url } });
    } catch (error) {
      console.error(`Failed to load remote plugin from ${url}`, error); // eslint-disable-line no-console
    }
  }
}
