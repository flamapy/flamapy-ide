import { useEffect, useRef, useState, useCallback } from "react";

import { createWorkerClient } from "./workerClient";

// React wrapper over the framework-free createWorkerClient: same return shape as the
// pre-v3 hook so existing components keep working unchanged.
export function useWorkerClient() {
  const clientRef = useRef(null);
  if (!clientRef.current) {
    clientRef.current = createWorkerClient();
  }
  const client = clientRef.current;

  const [state, setState] = useState(client.getState());

  useEffect(() => {
    const unsubscribe = client.onStateChange(setState);
    client.start();
    return () => {
      unsubscribe();
      client.terminate();
    };
  }, [client]);

  const call = useCallback((action, data) => client.call(action, data), [client]);
  const installPlugin = useCallback((data) => client.installPlugin(data), [client]);
  const interrupt = useCallback(() => client.interrupt(), [client]);
  const restart = useCallback(() => client.restart(), [client]);

  return {
    isLoaded: state.isLoaded,
    pluginsConfig: state.pluginsConfig,
    pluginCatalog: state.pluginCatalog,
    call,
    installPlugin,
    interrupt,
    restart,
  };
}
