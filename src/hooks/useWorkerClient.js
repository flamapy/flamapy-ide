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

export function useWorkerClient() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [pluginsConfig, setPluginsConfig] = useState(null);
  const pendingRef = useRef(new Map());
  const workerRef = useRef(null);
  const nextIdRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(`${import.meta.env.BASE_URL}webworker.js`);
    workerRef.current = worker;
    attachHandler(worker, pendingRef, setIsLoaded, setPluginsConfig);
    return () => worker.terminate();
  }, []);

  const call = useCallback((action, data) => {
    return new Promise((resolve, reject) => {
      const msgId = nextIdRef.current++;
      pendingRef.current.set(msgId, { resolve, reject });
      workerRef.current.postMessage({ action, data, msgId });
    });
  }, []);

  const restart = useCallback(() => {
    workerRef.current?.terminate();
    for (const { reject } of pendingRef.current.values()) {
      reject(new Error("Worker restarted"));
    }
    pendingRef.current.clear();
    setIsLoaded(false);

    const worker = new Worker(`${import.meta.env.BASE_URL}webworker.js`);
    workerRef.current = worker;
    attachHandler(worker, pendingRef, setIsLoaded, setPluginsConfig);
  }, []);

  return { isLoaded, pluginsConfig, call, restart };
}
