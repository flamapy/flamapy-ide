import { describe, expect, it, vi } from "vitest";

import { createWorkerClient } from "./workerClient";

// A controllable stand-in for the Pyodide Worker.
class FakeWorker {
  constructor() {
    this.posted = [];
    this.terminated = false;
    this.onmessage = null;
  }
  postMessage(message) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data) {
    this.onmessage?.({ data });
  }
}

function makeClient() {
  const workers = [];
  const client = createWorkerClient({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  client.start();
  return { client, workers };
}

describe("createWorkerClient", () => {
  it("resolves calls by msgId, independently of response order", async () => {
    const { client, workers } = makeClient();
    const first = client.call("validateModel", { code: "a" });
    const second = client.call("getFeatures");
    const [messageA, messageB] = workers[0].posted;
    workers[0].emit({ msgId: messageB.msgId, action: messageB.action, results: ["f1"] });
    workers[0].emit({ msgId: messageA.msgId, action: messageA.action, results: { valid: true } });
    await expect(second).resolves.toEqual(["f1"]);
    await expect(first).resolves.toEqual({ valid: true });
  });

  it("rejects a call when the worker reports an error for it", async () => {
    const { client, workers } = makeClient();
    const pending = client.call("executeFacadeOperation", { name: "x" });
    const [message] = workers[0].posted;
    workers[0].emit({ msgId: message.msgId, action: message.action, error: "boom" });
    await expect(pending).rejects.toThrow("boom");
  });

  it("exposes the loaded state and notifies subscribers", () => {
    const { client, workers } = makeClient();
    const listener = vi.fn();
    client.onStateChange(listener);
    expect(client.getState().isLoaded).toBe(false);
    workers[0].emit({ status: "loaded", pluginsConfig: { core: {} }, pluginCatalog: { ops: 1 } });
    expect(client.getState()).toEqual({
      isLoaded: true,
      pluginsConfig: { core: {} },
      pluginCatalog: { ops: 1 },
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("restart terminates the worker, rejects pendings and spawns a fresh worker", async () => {
    const { client, workers } = makeClient();
    workers[0].emit({ status: "loaded" });
    const orphan = client.call("getFeatures");
    client.restart();
    await expect(orphan).rejects.toThrow(/restarted/);
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(client.getState().isLoaded).toBe(false);
  });

  it("installPlugin adopts the refreshed catalog", async () => {
    const { client, workers } = makeClient();
    const install = client.installPlugin({ wheelRefs: ["x.whl"] });
    const [message] = workers[0].posted;
    expect(message.action).toBe("installPlugin");
    workers[0].emit({ msgId: message.msgId, action: "installPlugin", results: { ops: 2 } });
    await install;
    expect(client.getState().pluginCatalog).toEqual({ ops: 2 });
  });

  it("interrupt returns false without a SharedArrayBuffer (fallback to restart)", () => {
    const { client } = makeClient();
    // vitest node env is not cross-origin isolated, so no interrupt buffer exists.
    expect(client.interrupt()).toBe(false);
  });

  it("passes the user's flamapy plugin choices to the worker, re-read on restart", () => {
    const urls = [];
    let choices = {};
    const client = createWorkerClient({
      workerUrl: "/webworker.js",
      pluginChoices: () => choices,
      createWorker: (url) => {
        urls.push(url);
        return new FakeWorker();
      },
    });
    client.start();
    choices = { z3: false, sdd: true };
    client.restart();
    expect(urls).toEqual([
      "/webworker.js",
      `/webworker.js?plugins=${encodeURIComponent('{"z3":false,"sdd":true}')}`,
    ]);
  });
});
