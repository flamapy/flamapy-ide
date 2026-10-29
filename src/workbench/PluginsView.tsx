import { useEffect, useState, type ReactNode } from 'react';

import type { PluginRecord, PluginState, Workbench } from '@flamapy/ide-plugin-api';

import {
  addRemotePlugin,
  reloadRemotePlugin,
  remotePluginUrls,
  remotePluginsEnabled,
  removeRemotePlugin,
  setRemotePluginsEnabled,
} from './remotePlugins';

export const PLUGINS_VIEW_ID = 'shell.plugins';

const STATE_BADGES: Record<PluginState, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200' },
  registered: { label: 'Starting', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
  disabled: { label: 'Turned off', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  deactivated: { label: 'Stopped', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  skipped: { label: 'Waiting for a dependency', className: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200' },
  incompatible: { label: 'Incompatible', className: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200' },
};

const card =
  'bg-white/95 dark:bg-gray-800 border border-black/10 dark:border-white/10 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,.04)]';
const button =
  'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] text-gray-700 dark:text-gray-200 border border-black/10 dark:border-white/15 hover:bg-black/[.04] dark:hover:bg-white/10 disabled:opacity-40 transition-colors';
const link = 'text-accent hover:underline';

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

function sourceLabel(record: PluginRecord): ReactNode {
  if (record.source.kind === 'builtin') {
    return 'Built-in';
  }
  let host = record.source.url;
  try {
    host = new URL(record.source.url).host;
  } catch {
    // keep the raw URL
  }
  return <span title={record.source.url}>From {host}</span>;
}

function PluginCard({
  record,
  enabled,
  names,
  onToggle,
  onReload,
  onRemove,
}: {
  record: PluginRecord;
  enabled: boolean;
  names: Map<string, string>;
  onToggle(enabled: boolean): void;
  onReload?(): void;
  onRemove?(): void;
}) {
  const { manifest } = record.plugin;
  const badge = STATE_BADGES[record.state];
  const problem =
    ['failed', 'skipped', 'incompatible'].includes(record.state) && record.error instanceof Error
      ? record.error.message
      : null;
  const citation = manifest.citation;

  return (
    <article className={`${card} p-4 flex gap-4`} aria-label={manifest.name}>
      <Logo name={manifest.name} logo={manifest.logo} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-semibold text-[14px] text-gray-900 dark:text-gray-100">
                {manifest.name}
              </h3>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">v{manifest.version}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-medium ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {sourceLabel(record)} · <code className="font-mono">{manifest.id}</code>
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={record.state === 'incompatible'}
            onChange={onToggle}
            label={enabled ? `Turn off ${manifest.name}` : `Turn on ${manifest.name}`}
          />
        </div>

        {manifest.description && (
          <p className="text-[13px] text-gray-700 dark:text-gray-300 mt-2">{manifest.description}</p>
        )}

        {manifest.authors && manifest.authors.length > 0 && (
          <p className="text-[12px] text-gray-600 dark:text-gray-400 mt-2">
            By{' '}
            {manifest.authors.map((author, index) => (
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

        {(manifest.repository || manifest.homepage || manifest.license) && (
          <p className="text-[12px] mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {manifest.repository && (
              <a className={link} href={manifest.repository} target="_blank" rel="noreferrer">
                Source code ↗
              </a>
            )}
            {manifest.homepage && (
              <a className={link} href={manifest.homepage} target="_blank" rel="noreferrer">
                Website ↗
              </a>
            )}
            {manifest.license && (
              <span className="text-gray-500 dark:text-gray-400">License: {manifest.license}</span>
            )}
          </p>
        )}

        {citation && (
          <details className="mt-2 text-[12px]">
            <summary className="cursor-pointer text-gray-700 dark:text-gray-300 font-medium">
              How to cite
            </summary>
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

        {manifest.dependencies && manifest.dependencies.length > 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
            Requires {manifest.dependencies.map((id) => names.get(id) ?? id).join(', ')}
          </p>
        )}

        {problem && (
          <p className="mt-2 text-[12px] px-2 py-1.5 rounded-md bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200">
            {problem}
          </p>
        )}

        {(onReload || onRemove) && (
          <div className="flex gap-2 mt-3">
            {onReload && (
              <button className={button} onClick={onReload}>
                {record.state === 'failed' ? 'Retry' : 'Reload'}
              </button>
            )}
            {onRemove && (
              <button className={`${button} text-red-700 dark:text-red-300`} onClick={onRemove}>
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
        {title}
      </h2>
      {hint && <p className="text-[12px] text-gray-600 dark:text-gray-400 mt-1">{hint}</p>}
      <div className="mt-2 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/**
 * The Plugins view: every IDE plugin with its credits (logo, authors, links, license,
 * citation), its state and controls; loading plugins from a URL; and a pointer to the
 * separately managed flamapy (Python) plugins.
 */
export function createPluginsView(
  workbench: Workbench,
  options: { onManageFlamapyPlugins(): void },
) {
  return function PluginsView() {
    const records = usePluginRecords(workbench);
    const [remoteEnabled, setRemoteEnabledState] = useState(remotePluginsEnabled);
    const [urls, setUrls] = useState(remotePluginUrls);
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const names = new Map(records.map((record) => [record.plugin.manifest.id, record.plugin.manifest.name]));

    async function run(action: () => Promise<void>, success?: string) {
      setBusy(true);
      setMessage(null);
      try {
        await action();
        if (success) setMessage({ ok: true, text: success });
      } catch (error) {
        setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
      } finally {
        setUrls(remotePluginUrls());
        setBusy(false);
      }
    }

    function toggle(record: PluginRecord, enabled: boolean) {
      const { id } = record.plugin.manifest;
      if (!enabled) {
        const dependents = records.filter(
          (other) =>
            other.state === 'active' && other.plugin.manifest.dependencies?.includes(id),
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

    const remote = records.filter((record) => record.source.kind === 'remote');
    const builtin = records.filter((record) => record.source.kind === 'builtin');
    const loadedUrls = new Set(remote.map((record) => (record.source as { url: string }).url));
    const unloaded = urls.filter((entry) => !loadedUrls.has(entry));
    const urlValid = /^https?:\/\/\S+$/i.test(url.trim());

    const cardFor = (record: PluginRecord) => {
      const sourceUrl = record.source.kind === 'remote' ? record.source.url : null;
      return (
        <PluginCard
          key={record.plugin.manifest.id}
          record={record}
          names={names}
          enabled={workbench.host.isEnabled(record.plugin.manifest.id)}
          onToggle={(enabled) => toggle(record, enabled)}
          onReload={
            sourceUrl
              ? () => void run(() => reloadRemotePlugin(workbench, sourceUrl), 'Plugin reloaded.')
              : record.state === 'failed'
                ? () => void run(async () => void (await workbench.host.reload(record.plugin.manifest.id)))
                : undefined
          }
          onRemove={
            sourceUrl ? () => void run(() => removeRemotePlugin(workbench, sourceUrl)) : undefined
          }
        />
      );
    };

    return (
      <div className="flex-1 overflow-auto bg-surface dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Plugins</h1>
          <p className="text-[13px] text-gray-600 dark:text-gray-400 mt-1">
            IDE plugins add views, menus and tools to the IDE. Each card credits the people and
            the work behind the plugin: follow its links, and cite it when you use it.
          </p>

          {message && (
            <p
              role="status"
              className={`mt-3 text-[12px] ${message.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {message.text}
            </p>
          )}

          <Section
            title="Add a plugin from a URL"
            hint={
              <>
                Load an IDE plugin published as an ES module, for example a research tool's
                own build. Only add plugins you trust: they run with full access to this page.{' '}
                <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10.5px] font-medium">
                  experimental
                </span>
              </>
            }
          >
            <div className={`${card} p-4`}>
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
                <form
                  className="flex gap-2 mt-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (urlValid) {
                      void run(async () => {
                        await addRemotePlugin(workbench, url.trim());
                        setUrl('');
                      }, 'Plugin loaded and remembered.');
                    }
                  }}
                >
                  <input
                    className="flex-1 px-2 py-1 text-[13px] rounded-md border border-black/20 dark:border-white/20 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    placeholder="https://example.org/my-tool/plugin.js"
                    aria-label="Plugin URL"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 text-[12px] font-medium rounded-md bg-accent text-white disabled:opacity-50"
                    disabled={!urlValid || busy}
                  >
                    Load
                  </button>
                </form>
              )}
            </div>
          </Section>

          {(remote.length > 0 || unloaded.length > 0) && (
            <Section title={`Installed from a URL (${remote.length})`}>
              {remote.map(cardFor)}
              {unloaded.map((entry) => (
                <div key={entry} className={`${card} p-3 flex items-center gap-3 text-[12px]`}>
                  <span className="flex-1 truncate text-gray-700 dark:text-gray-300" title={entry}>
                    {entry}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {remoteEnabled ? 'Could not be loaded' : 'Not loaded: remote plugins are off'}
                  </span>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void run(() => removeRemotePlugin(workbench, entry))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </Section>
          )}

          <Section title={`Built-in (${builtin.length})`}>{builtin.map(cardFor)}</Section>

          <Section
            title="flamapy plugins"
            hint="Analysis backends and operations come from flamapy plugins: Python packages that extend flamapy itself, not the IDE. They are installed into the analysis engine and their operations appear in the toolbar menus."
          >
            <div>
              <button className={button} onClick={options.onManageFlamapyPlugins}>
                Manage flamapy plugins…
              </button>
            </div>
          </Section>
        </div>
      </div>
    );
  };
}
