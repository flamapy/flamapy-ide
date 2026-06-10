import { useState, useEffect, useRef, useCallback } from "react";

function attachHandler(worker, pendingRef, setIsLoaded, setPluginsConfig) {
  worker.onmessage = (event) => {
    const { status, exception, msgId, results, error } = event.data;

    if (status === "loaded") {
      setIsLoaded(true);
      setPluginsConfig(event.data.pluginsConfig ?? null);
      return;
    }

    if (status === "error") {
      console.error("Flamapy worker failed to load:", exception);
      for (const { reject } of pendingRef.current.values()) {
        reject(new Error(exception));
      }
      pendingRef.current.clear();
      return;
    }

    const pending = pendingRef.current.get(msgId);
    if (!pending) return;
    pendingRef.current.delete(msgId);
    error ? pending.reject(new Error(error)) : pending.resolve(results);
  };
}

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

export function useWorkerClient() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [pluginsConfig, setPluginsConfig] = useState(null);
  const pendingRef = useRef(new Map());
  const workerRef = useRef(null);
  const nextIdRef = useRef(0);
  const interruptBufferRef = useRef(null);

  const spawnWorker = useCallback(() => {
    const worker = new Worker(`${import.meta.env.BASE_URL}webworker.js`);
    workerRef.current = worker;
    attachHandler(worker, pendingRef, setIsLoaded, setPluginsConfig);
    if (interruptBufferRef.current) {
      worker.postMessage({
        command: "setInterruptBuffer",
        buffer: interruptBufferRef.current,
      });
    }
  }, []);

  useEffect(() => {
    interruptBufferRef.current = createInterruptBuffer();
    spawnWorker();
    return () => workerRef.current?.terminate();
  }, [spawnWorker]);

  const call = useCallback((action, data) => {
    return new Promise((resolve, reject) => {
      const msgId = nextIdRef.current++;
      pendingRef.current.set(msgId, { resolve, reject });
      workerRef.current.postMessage({ action, data, msgId });
    });
  }, []);

  // Raise KeyboardInterrupt inside the running Python operation. Returns false
  // when the interrupt buffer is unavailable (caller should restart instead).
  const interrupt = useCallback(() => {
    if (!interruptBufferRef.current) return false;
    interruptBufferRef.current[0] = 2; // SIGINT; Pyodide resets it to 0
    return true;
  }, []);

  const restart = useCallback(() => {
    workerRef.current?.terminate();
    for (const { reject } of pendingRef.current.values()) {
      reject(new Error("Worker restarted"));
    }
    pendingRef.current.clear();
    setIsLoaded(false);
    spawnWorker();
  }, [spawnWorker]);

  return { isLoaded, pluginsConfig, call, interrupt, restart };
}
