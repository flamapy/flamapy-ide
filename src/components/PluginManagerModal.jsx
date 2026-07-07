/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import Modal from "./ui/Modal";

// Manage the analysis plugins (solver backends) available in the IDE. Lists the
// installed backends, the curated official extras from plugins.registry.json (each
// installable when a Pyodide/wasm wheel exists), and an "install from URL" field for
// any third-party plugin wheel. Installing calls onInstall({ wheelRefs,
// pyodidePackages, key?, label? }) which micropip-installs it in the worker and
// refreshes the capability catalog, so the new solver tab appears without a reload.
function PluginManagerModal({ installedBackends, onInstall, onClose }) {
  const [registry, setRegistry] = useState([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(null); // signature of the entry currently installing
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}flamapy/plugins.registry.json`)
      .then((r) => (r.ok ? r.json() : { plugins: [] }))
      .then((data) => !cancelled && setRegistry(data.plugins || []))
      .catch(() => !cancelled && setRegistry([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const installed = new Set(installedBackends || []);
  const urlValid = /^https?:\/\/.+\.whl$/i.test(url.trim());

  async function install(descriptor, signature) {
    setError(null);
    setBusy(signature);
    try {
      await onInstall(descriptor);
    } catch (e) {
      setError(`Could not install ${descriptor.label || signature}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal onClose={onClose} title="Manage plugins" maxWidth="max-w-lg">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Solver backends run analyses in your browser. Install an official extra or any
        third-party plugin wheel; its operations appear as a new solver tab.
      </p>

      <div className="mb-5">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Installed
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {[...installed].map((b) => (
            <span
              key={b}
              className="px-2 py-0.5 text-xs rounded-md bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 uppercase"
            >
              {b}
            </span>
          ))}
          {installed.size === 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              No backends loaded yet.
            </span>
          )}
        </div>
      </div>

      <div className="mb-5">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Official extras
        </h4>
        <ul className="space-y-2">
          {registry.map((p) => {
            const isInstalled = installed.has(p.backend);
            const disabled = isInstalled || !p.available || busy !== null;
            return (
              <li
                key={p.key}
                className="flex items-start justify-between gap-3 p-2 rounded-md border border-gray-200 dark:border-gray-700"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {p.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {p.description}
                  </div>
                  {!p.available && p.note && (
                    <div className="text-xs mt-1 text-amber-600 dark:text-amber-400">
                      {p.note}
                    </div>
                  )}
                </div>
                <button
                  disabled={disabled}
                  onClick={() =>
                    install(
                      { key: p.key, label: p.label, wheelRefs: p.wheelRefs, pyodidePackages: p.pyodidePackages },
                      p.key
                    )
                  }
                  className="shrink-0 px-3 py-1 text-xs font-semibold rounded-md bg-[#356C99] text-white hover:bg-[#2c5a80] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isInstalled ? "Installed" : busy === p.key ? "Installing…" : "Enable"}
                </button>
              </li>
            );
          })}
          {registry.length === 0 && (
            <li className="text-xs text-gray-500 dark:text-gray-400">
              No official extras available.
            </li>
          )}
        </ul>
      </div>

      <div className="mb-2">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Install from URL
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          A Pyodide-compatible wheel URL (pure-Python plugins install directly; those
          needing native code require a prebuilt wasm wheel).
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && urlValid && install({ wheelRefs: [url.trim()], pyodidePackages: [] }, url.trim())}
            placeholder="https://example.org/flamapy_myplugin-1.0-py3-none-any.whl"
            className="flex-1 min-w-0 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
          />
          <button
            disabled={!urlValid || busy !== null}
            onClick={() => install({ wheelRefs: [url.trim()], pyodidePackages: [] }, url.trim())}
            className="shrink-0 px-3 py-2 text-sm font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === url.trim() ? "Installing…" : "Add"}
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      <div className="mt-6 flex justify-end">
        <button
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

export default PluginManagerModal;
