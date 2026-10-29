import { useEffect, useReducer, useState, type ReactNode } from 'react';

import type { PluginManifest, PluginRecord, PluginState, Workbench } from '@flamapy/ide-plugin-api';
import {
  Catalog,
  EngineWorker,
  type EngineWorkerService,
  type FlamapyPluginInfo,
  type PythonPluginDescriptor,
} from '@flamapy/plugin-flamapy-engine';

import {
  addRemotePlugin,
  reloadRemotePlugin,
  remotePluginUrls,
  remotePluginsEnabled,
  removeRemotePlugin,
  setRemotePluginsEnabled,
} from './remotePlugins';

export const PLUGINS_VIEW_ID = 'shell.plugins';

interface Badge {
  label: string;
  className: string;
}

const green = 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200';
const grey = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
const amber = 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200';
const red = 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200';

const STATE_BADGES: Record<PluginState, Badge> = {
  active: { label: 'Active', className: green },
  registered: { label: 'Starting', className: grey },
  disabled: { label: 'Turned off', className: grey },
  deactivated: { label: 'Stopped', className: grey },
  skipped: { label: 'Waiting for a dependency', className: amber },
  incompatible: { label: 'Incompatible', className: amber },
  failed: { label: 'Failed', className: red },
};

const card =
  'bg-white/95 dark:bg-gray-800 border border-black/10 dark:border-white/10 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,.04)]';
const button =
  'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] text-gray-700 dark:text-gray-200 border border-black/10 dark:border-white/15 hover:bg-black/[.04] dark:hover:bg-white/10 disabled:opacity-40 transition-colors';
const link = 'text-accent hover:underline';

/** Re-renders when the flamapy engine (if active) changes state or catalog; its worker service. */
function useFlamapyEngine(workbench: Workbench): EngineWorkerService | undefined {
  const worker = workbench.services.tryGet(EngineWorker);
  const catalog = workbench.services.tryGet(Catalog);
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    if (!worker || !catalog) return undefined;
    const subscriptions = [worker.onStateChange(refresh), catalog.onDidChange(refresh)];
    return () => subscriptions.forEach((subscription) => subscription.dispose());
  }, [worker, catalog]);
  return worker;
}

/** A snapshot of the host's records that re-renders on every plugin state change. */
function usePluginRecords(workbench: Workbench): PluginRecord[] {
  const snapshot = () => workbench.host.list().map((record) => ({ ...record }));
  const [records, setRecords] = useState(snapshot);
  useEffect(() => {
    const subscription = workbench.host.onDidChange(() => setRecords(snapshot()));
    setRecords(snapshot());
    return () => subscription.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbench]);
  return records;
}

function initials(name: string): string {
  // Short acronyms (SAT, BDD, Z3, #SAT) read better whole.
  if (/^[#A-Z0-9]{1,4}$/.test(name)) return name;
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

function Logo({ name, logo }: { name: string; logo?: string }) {
  if (logo) {
    return <img src={logo} alt="" className="w-11 h-11 rounded-lg object-contain shrink-0" />;
  }
  return (
    <div
      aria-hidden="true"
      className="w-11 h-11 rounded-lg shrink-0 grid place-items-center bg-accent/10 text-accent font-semibold text-sm"
    >
      {initials(name)}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={button}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-40 ${
        checked ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : ''
        }`}
      />
    </button>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function fromUrl(url: string): ReactNode {
  return <span title={url}>From {hostOf(url)}</span>;
}

/** Credits shown on a card: the attribution fields of an IDE plugin manifest. */
type Credits = Pick<PluginManifest, 'authors' | 'repository' | 'homepage' | 'license' | 'citation'>;

interface CardAction {
  label: string;
  onClick(): void;
  danger?: boolean;
}

/**
 * One plugin, IDE or flamapy: logo, name and badges, where it comes from, what it does,
 * its credits, and its controls (an on/off switch and actions).
 */
function PluginCard({
  name,
  version,
  logo,
  badges,
  subtitle,
  description,
  credits = {},
  note,
  requires,
  problem,
  toggle,
  actions = [],
}: {
  name: string;
  version?: string;
  logo?: string;
  badges: Badge[];
  subtitle: ReactNode;
  description?: string;
  credits?: Credits;
  note?: { text: string; warn?: boolean };
  requires?: string;
  problem?: string | null;
  toggle?: { checked: boolean; disabled?: boolean; onChange(checked: boolean): void };
  actions?: CardAction[];
}) {
  const { authors, repository, homepage, license, citation } = credits;
  return (
    <article className={`${card} p-4 flex gap-4`} aria-label={name}>
      <Logo name={name} logo={logo} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h4 className="font-semibold text-[14px] text-gray-900 dark:text-gray-100">{name}</h4>
              {version && <span className="text-[11px] text-gray-500 dark:text-gray-400">v{version}</span>}
              {badges.map((badge) => (
                <span key={badge.label} className={`px-1.5 py-0.5 rounded text-[10.5px] font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          {toggle && (
            <Switch
              checked={toggle.checked}
              disabled={toggle.disabled}
              onChange={toggle.onChange}
              label={toggle.checked ? `Turn off ${name}` : `Turn on ${name}`}
            />
          )}
        </div>

        {description && <p className="text-[13px] text-gray-700 dark:text-gray-300 mt-2">{description}</p>}

        {authors && authors.length > 0 && (
          <p className="text-[12px] text-gray-600 dark:text-gray-400 mt-2">
            By{' '}
            {authors.map((author, index) => (
              <span key={`${author.name}-${index}`}>
                {index > 0 && ', '}
                {author.url ? (
                  <a className={link} href={author.url} target="_blank" rel="noreferrer">
                    {author.name}
                  </a>
                ) : (
                  author.name
                )}
                {author.orcid && (
                  <a
                    className="ml-1 text-[10px] px-1 rounded bg-[#a6ce39] text-white font-semibold align-middle"
                    href={`https://orcid.org/${author.orcid}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`ORCID ${author.orcid}`}
                  >
                    iD
                  </a>
                )}
                {author.affiliation && (
                  <span className="text-gray-500 dark:text-gray-500"> ({author.affiliation})</span>
                )}
              </span>
            ))}
          </p>
        )}

        {(repository || homepage || license) && (
          <p className="text-[12px] mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {repository && (
              <a className={link} href={repository} target="_blank" rel="noreferrer">
                Source code ↗
              </a>
            )}
            {homepage && (
              <a className={link} href={homepage} target="_blank" rel="noreferrer">
                Website ↗
              </a>
            )}
            {license && <span className="text-gray-500 dark:text-gray-400">License: {license}</span>}
          </p>
        )}

        {citation && (
          <details className="mt-2 text-[12px]">
            <summary className="cursor-pointer text-gray-700 dark:text-gray-300 font-medium">How to cite</summary>
            <p className="mt-1.5 text-gray-700 dark:text-gray-300">
              {citation.text}
              {citation.doi && (
                <>
                  {' '}
                  <a className={link} href={`https://doi.org/${citation.doi}`} target="_blank" rel="noreferrer">
                    doi:{citation.doi}
                  </a>
                </>
              )}
              {!citation.doi && citation.url && (
                <>
                  {' '}
                  <a className={link} href={citation.url} target="_blank" rel="noreferrer">
                    {citation.url}
                  </a>
                </>
              )}
            </p>
            <div className="flex gap-2 mt-1.5">
              <CopyButton text={citation.text} label="Copy citation" />
              {citation.bibtex && <CopyButton text={citation.bibtex} label="Copy BibTeX" />}
            </div>
          </details>
        )}

        {note && (
          <p className={`text-[12px] mt-1.5 ${note.warn ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {note.text}
          </p>
        )}

        {requires && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">Requires {requires}</p>}

        {problem && (
          <p className="mt-2 text-[12px] px-2 py-1.5 rounded-md bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200">
            {problem}
          </p>
        )}

        {actions.length > 0 && (
          <div className="flex gap-2 mt-3">
            {actions.map((action) => (
              <button
                key={action.label}
                className={`${button} ${action.danger ? 'text-red-700 dark:text-red-300' : ''}`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/** A URL field with a submit button; clears itself when `onSubmit` succeeds. */
function UrlForm({
  label,
  placeholder,
  pattern,
  submitLabel,
  disabled,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  pattern: RegExp;
  submitLabel: string;
  disabled?: boolean;
  onSubmit(url: string): Promise<boolean>;
}) {
  const [url, setUrl] = useState('');
  const valid = pattern.test(url.trim());
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          void onSubmit(url.trim()).then((ok) => ok && setUrl(''));
        }
      }}
    >
      <input
        className="flex-1 min-w-0 px-2 py-1 text-[13px] rounded-md border border-black/20 dark:border-white/20 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        placeholder={placeholder}
        aria-label={label}
        value={url}
        onChange={(event) => setUrl(event.target.value)}
      />
      <button
        type="submit"
        className="px-3 py-1 text-[12px] font-medium rounded-md bg-accent text-white disabled:opacity-50"
        disabled={!valid || disabled}
      >
        {submitLabel}
      </button>
    </form>
  );
}

function Group({ id, title, intro, children }: { id: string; title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="mt-8 scroll-mt-4" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h2>
      <p className="text-[13px] text-gray-600 dark:text-gray-400 mt-1">{intro}</p>
      {children}
    </section>
  );
}

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">{title}</h3>
      {hint && <p className="text-[12px] text-gray-600 dark:text-gray-400 mt-1">{hint}</p>}
      <div className="mt-2 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function flamapyBadges(plugin: FlamapyPluginInfo, engineLoaded: boolean): Badge[] {
  const state: Badge = !plugin.available
    ? { label: 'Not available in the browser', className: amber }
    : !plugin.installed
      ? { label: 'Not installed', className: grey }
      : plugin.loaded || !engineLoaded
        ? { label: 'Installed', className: green }
        : { label: 'Installed, loads on restart', className: green };
  return plugin.preinstalled ? [state, { label: 'Preinstalled', className: grey }] : [state];
}

function wheelName(descriptor: PythonPluginDescriptor): string {
  const first = descriptor.wheelRefs?.[0] ?? '';
  return descriptor.label || first.split('/').pop()?.split('-')[0] || first;
}

/**
 * The Plugins view, in two groups. IDE plugins: every plugin with its credits, state and
 * controls, and loading plugins from a URL. flamapy plugins: the analysis backends of the
 * flamapy engine (preinstalled or not, all handled alike), and wheels from a URL.
 */
export function createPluginsView(workbench: Workbench) {
  return function PluginsView() {
    const records = usePluginRecords(workbench);
    const engine = useFlamapyEngine(workbench);
    const [remoteEnabled, setRemoteEnabledState] = useState(remotePluginsEnabled);
    const [urls, setUrls] = useState(remotePluginUrls);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const names = new Map(records.map((record) => [record.plugin.manifest.id, record.plugin.manifest.name]));

    async function run(action: () => Promise<void>, success?: string): Promise<boolean> {
      setBusy(true);
      setMessage(null);
      try {
        await action();
        if (success) setMessage({ ok: true, text: success });
        return true;
      } catch (error) {
        setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
        return false;
      } finally {
        setUrls(remotePluginUrls());
        setBusy(false);
      }
    }

    // -- IDE plugins ----------------------------------------------------------------

    function toggleIdePlugin(record: PluginRecord, enabled: boolean) {
      const { id } = record.plugin.manifest;
      if (!enabled) {
        const dependents = records.filter(
          (other) => other.state === 'active' && other.plugin.manifest.dependencies?.includes(id),
        );
        if (
          dependents.length > 0 &&
          !window.confirm(
            `Turning off ${record.plugin.manifest.name} also stops: ${dependents
              .map((other) => other.plugin.manifest.name)
              .join(', ')}.`,
          )
        ) {
          return;
        }
      }
      void run(() => workbench.host.setEnabled(id, enabled));
    }

    function ideCard(record: PluginRecord) {
      const { manifest } = record.plugin;
      const sourceUrl = record.source.kind === 'remote' ? record.source.url : null;
      const actions: CardAction[] = [];
      if (sourceUrl) {
        actions.push(
          { label: record.state === 'failed' ? 'Retry' : 'Reload', onClick: () => void run(() => reloadRemotePlugin(workbench, sourceUrl), 'Plugin reloaded.') },
          { label: 'Remove', danger: true, onClick: () => void run(() => removeRemotePlugin(workbench, sourceUrl)) },
        );
      } else if (record.state === 'failed') {
        actions.push({ label: 'Retry', onClick: () => void run(async () => void (await workbench.host.reload(manifest.id))) });
      }
      return (
        <PluginCard
          key={manifest.id}
          name={manifest.name}
          version={manifest.version}
          logo={manifest.logo}
          badges={[STATE_BADGES[record.state]]}
          subtitle={
            <>
              {sourceUrl ? fromUrl(sourceUrl) : 'Built-in'} · <code className="font-mono">{manifest.id}</code>
            </>
          }
          description={manifest.description}
          credits={manifest}
          requires={manifest.dependencies?.map((id) => names.get(id) ?? id).join(', ') || undefined}
          problem={
            ['failed', 'skipped', 'incompatible'].includes(record.state) && record.error instanceof Error
              ? record.error.message
              : null
          }
          toggle={{
            checked: workbench.host.isEnabled(manifest.id),
            disabled: record.state === 'incompatible',
            onChange: (enabled) => toggleIdePlugin(record, enabled),
          }}
          actions={actions}
        />
      );
    }

    const remote = records.filter((record) => record.source.kind === 'remote');
    const builtin = records.filter((record) => record.source.kind === 'builtin');
    const loadedUrls = new Set(remote.map((record) => (record.source as { url: string }).url));
    const unloaded = urls.filter((entry) => !loadedUrls.has(entry));

    // -- flamapy plugins ------------------------------------------------------------

    const engineReady = Boolean(engine?.isLoaded);
    const flamapyPlugins = engine?.flamapyPlugins() ?? [];
    const wheelPlugins = engine?.urlPythonPlugins() ?? [];
    const restartWarning = (name: string) =>
      window.confirm(`Remove ${name}? The analysis engine restarts without it (your model is kept).`);

    function toggleFlamapyPlugin(plugin: FlamapyPluginInfo, install: boolean) {
      if (!engine) return;
      if (install) {
        void run(() => engine.installFlamapyPlugin(plugin.key), `${plugin.label} installed.`);
      } else if (restartWarning(plugin.label)) {
        void run(() => engine.removeFlamapyPlugin(plugin.key), `${plugin.label} removed; the analysis engine is restarting.`);
      }
    }

    const flamapyCard = (plugin: FlamapyPluginInfo) => (
      <PluginCard
        key={plugin.key}
        name={plugin.label}
        badges={flamapyBadges(plugin, engineReady)}
        subtitle={
          <>
            flamapy plugin · solver <code className="font-mono">{plugin.backend}</code>
          </>
        }
        description={plugin.description}
        credits={{ repository: plugin.repository }}
        note={plugin.note ? { text: plugin.note, warn: !plugin.available } : undefined}
        toggle={{
          checked: plugin.installed,
          disabled: !plugin.available || !engineReady || busy,
          onChange: (install) => toggleFlamapyPlugin(plugin, install),
        }}
      />
    );

    const wheelCard = (descriptor: PythonPluginDescriptor) => {
      const name = wheelName(descriptor);
      return (
        <PluginCard
          key={(descriptor.wheelRefs ?? []).join('|')}
          name={name}
          badges={[{ label: 'Installed', className: green }]}
          subtitle={fromUrl(descriptor.wheelRefs?.[0] ?? '')}
          actions={[
            {
              label: 'Remove',
              danger: true,
              onClick: () => {
                if (engine && restartWarning(name)) {
                  void run(() => engine.removePythonPlugin(descriptor), `${name} removed; the analysis engine is restarting.`);
                }
              },
            },
          ]}
        />
      );
    };

    return (
      <div className="flex-1 overflow-auto bg-surface dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Plugins</h1>
          <p className="text-[13px] text-gray-600 dark:text-gray-400 mt-1">
            Each card credits the people and the work behind a plugin: follow its links, and
            cite it when you use it.
          </p>
          <nav className="mt-2 flex gap-4 text-[13px]" aria-label="Plugin groups">
            <a className={link} href="#ide-plugins">IDE plugins ({records.length})</a>
            <a className={link} href="#flamapy-plugins">flamapy plugins ({flamapyPlugins.length + wheelPlugins.length})</a>
          </nav>

          {message && (
            <p
              role="status"
              className={`mt-3 text-[12px] ${message.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {message.text}
            </p>
          )}

          <Group id="ide-plugins" title="IDE plugins" intro="Views, menus and tools added to the IDE.">
            <Section
              title="Add a plugin from a URL"
              hint={
                <>
                  Load an IDE plugin published as an ES module, for example a research tool's own
                  build. Only add plugins you trust: they run with full access to this page.{' '}
                  <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10.5px] font-medium">
                    experimental
                  </span>
                </>
              }
            >
              <div className={`${card} p-4 space-y-3`}>
                <label className="flex items-center gap-2 text-[13px] text-gray-800 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={remoteEnabled}
                    onChange={(event) => {
                      setRemotePluginsEnabled(event.target.checked);
                      setRemoteEnabledState(event.target.checked);
                    }}
                  />
                  Allow loading plugins from a URL
                </label>
                {remoteEnabled && (
                  <UrlForm
                    label="Plugin URL"
                    placeholder="https://example.org/my-tool/plugin.js"
                    pattern={/^https?:\/\/\S+$/i}
                    submitLabel="Load"
                    disabled={busy}
                    onSubmit={(url) => run(() => addRemotePlugin(workbench, url), 'Plugin loaded and remembered.')}
                  />
                )}
              </div>
            </Section>

            {(remote.length > 0 || unloaded.length > 0) && (
              <Section title={`Installed from a URL (${remote.length})`}>
                {remote.map(ideCard)}
                {unloaded.map((entry) => (
                  <PluginCard
                    key={entry}
                    name={entry.split('/').pop() || entry}
                    badges={[{ label: remoteEnabled ? 'Could not be loaded' : 'Not loaded: loading from URLs is off', className: amber }]}
                    subtitle={fromUrl(entry)}
                    actions={[{ label: 'Remove', danger: true, onClick: () => void run(() => removeRemotePlugin(workbench, entry)) }]}
                  />
                ))}
              </Section>
            )}

            <Section title={`Built-in (${builtin.length})`}>{builtin.map(ideCard)}</Section>
          </Group>

          <Group
            id="flamapy-plugins"
            title="flamapy plugins"
            intro="Python packages that extend flamapy itself, not the IDE: solver backends and their analysis operations. Each installed one is a solver tab in the toolbar. Removing one restarts the analysis engine; your model is kept."
          >
            {!engine ? (
              <p className="mt-3 text-[13px] text-gray-600 dark:text-gray-400">
                The flamapy analysis engine is turned off. Turn it on under IDE plugins to manage
                flamapy plugins.
              </p>
            ) : (
              <>
                {!engineReady && (
                  <p className="mt-3 text-[12px] text-gray-500 dark:text-gray-400">The analysis engine is starting…</p>
                )}
                <Section title={`Solvers (${flamapyPlugins.length})`}>{flamapyPlugins.map(flamapyCard)}</Section>
                {wheelPlugins.length > 0 && (
                  <Section title={`Installed from a URL (${wheelPlugins.length})`}>{wheelPlugins.map(wheelCard)}</Section>
                )}
                <Section
                  title="Install a wheel from a URL"
                  hint="A Pyodide-compatible wheel: pure-Python plugins install directly; those needing native code need a prebuilt WebAssembly wheel."
                >
                  <div className={`${card} p-4`}>
                    <UrlForm
                      label="Wheel URL"
                      placeholder="https://example.org/flamapy_myplugin-1.0-py3-none-any.whl"
                      pattern={/^https?:\/\/\S+\.whl$/i}
                      submitLabel="Install"
                      disabled={busy || !engineReady}
                      onSubmit={(url) =>
                        run(() => engine.installPythonPlugin({ wheelRefs: [url], pyodidePackages: [] }), 'Wheel installed and remembered.')
                      }
                    />
                  </div>
                </Section>
              </>
            )}
          </Group>
        </div>
      </div>
    );
  };
}
