// Framework-free Pyodide worker client. `useWorkerClient` wraps this for React
// components; the flamapy-engine plugin uses it directly (plugins activate outside
// React). One instance owns one Worker plus the msgId-keyed pending-promise map.

// Pyodide can interrupt running Python via a SharedArrayBuffer, but SAB needs
// the page to be cross-origin isolated (COOP/COEP headers — set by the vite dev
// server and the Docker nginx; NOT available on GitHub Pages). When the buffer
// is unavailable, interrupt() returns false and callers fall back to a full
// worker restart.
function createInterruptBuffer() {
  if (typeof SharedArrayBuffer === "undefined" || !globalThis.crossOriginIsolated) {
    return null;
  }
  return new Uint8Array(new SharedArrayBuffer(1));
}

/**
 * @param {{
 *   workerUrl?: string,
 *   createWorker?: (url: string) => Worker,
 *   pluginChoices?: () => Record<string, boolean>,
 * }} [options]
 *   `createWorker` overrides construction (tests); `workerUrl` defaults to
 *   `${import.meta.env.BASE_URL}webworker.js`. `pluginChoices` is read on every
 *   (re)start: the user's flamapy plugin decisions ({ key: installed }), passed to the
 *   worker so it boots exactly those plugins (see flamapy.js bootPlugins).
 */
export function createWorkerClient(options = {}) {
  const makeWorker = options.createWorker ?? ((url) => new Worker(url));

  function workerUrl() {
    const base = options.workerUrl ?? `${import.meta.env.BASE_URL}webworker.js`;
    const choices = options.pluginChoices?.() ?? {};
    if (Object.keys(choices).length === 0) return base;
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}plugins=${encodeURIComponent(JSON.stringify(choices))}`;
  }

  const pending = new Map();
  const loadListeners = new Set();
  let worker = null;
  let nextId = 0;
  let state = { isLoaded: false, pluginsConfig: null, pluginCatalog: null };
  const interruptBuffer = createInterruptBuffer();

  function notify() {
    for (const listener of loadListeners) listener(state);
  }

  function attachHandler(target) {
    target.onmessage = (event) => {
      const { status, exception, msgId, results, error } = event.data;

      if (status === "loaded") {
        state = {
          isLoaded: true,
          pluginsConfig: event.data.pluginsConfig ?? null,
          pluginCatalog: event.data.pluginCatalog ?? null,
        };
        notify();
        return;
      }

      if (status === "error") {
        console.error("Flamapy worker failed to load:", exception);
        for (const { reject } of pending.values()) {
          reject(new Error(exception));
        }
        pending.clear();
        return;
      }

      const entry = pending.get(msgId);
      if (!entry) return;
      pending.delete(msgId);
      error ? entry.reject(new Error(error)) : entry.resolve(results);
    };
  }

  function spawn() {
    worker = makeWorker(workerUrl());
    attachHandler(worker);
    if (interruptBuffer) {
      worker.postMessage({ command: "setInterruptBuffer", buffer: interruptBuffer });
    }
  }

  return {
    start() {
      if (!worker) spawn();
    },

    getState() {
      return state;
    },

    /** Listener fires with the new state on load/restart. Returns unsubscribe. */
    onStateChange(listener) {
      loadListeners.add(listener);
      return () => loadListeners.delete(listener);
    },

    call(action, data) {
      return new Promise((resolve, reject) => {
        const msgId = nextId++;
        pending.set(msgId, { resolve, reject });
        worker.postMessage({ action, data, msgId });
      });
    },

    // Install a plugin at runtime (micropip in the worker), then adopt the refreshed
    // capability catalog the worker returns so solver tabs and operation menus update
    // live. `data` is { wheelRefs, pyodidePackages }.
    async installPlugin(data) {
      const catalog = await this.call("installPlugin", data);
      if (catalog) {
        state = { ...state, pluginCatalog: catalog };
        notify();
      }
      return catalog;
    },

    // Raise KeyboardInterrupt inside the running Python operation. Returns false
    // when the interrupt buffer is unavailable (caller should restart instead).
    interrupt() {
      if (!interruptBuffer) return false;
      interruptBuffer[0] = 2; // SIGINT; Pyodide resets it to 0
      return true;
    },

    restart() {
      worker?.terminate();
      for (const { reject } of pending.values()) {
        reject(new Error("Worker restarted"));
      }
      pending.clear();
      state = { ...state, isLoaded: false };
      notify();
      spawn();
    },

    terminate() {
      worker?.terminate();
      worker = null;
    },
  };
}
