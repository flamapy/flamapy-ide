// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { serviceId } from "@flamapy/ide-plugin-api";
import { assertRemoteBundle, createTestWorkbench, stubPlugin } from "@flamapy/ide-plugin-api/testing";

import source from "./hello-plugin.js?raw";
import * as module from "./hello-plugin.js";

describe("remote-hello-plugin", () => {
  it("is loadable as a remote bundle and works in the workbench", async () => {
    const plugin = assertRemoteBundle(source, module);

    const wb = createTestWorkbench();
    // Stand-in for the flamapy engine: only the analysis call the plugin makes.
    const engine = stubPlugin("flamapy.engine", (ctx) => {
      ctx.subscriptions.push(
        ctx.services.provide(serviceId("flamapy.engine.analysis"), {
          getFeatures: async () => ["Root", "Camera", "CameraFlash", "GPS"],
        }),
      );
    });
    await wb.activate(engine, plugin);
    const view = await wb.openView("example.remote-hello.view");
    expect(view.container.textContent).toContain("Hello from a remotely loaded plugin!");
    expect(wb.outputs).toEqual([
      { label: "Remote Hello", result: "The remote example plugin activated." },
    ]);

    const greet = wb.workbench.stores.menuItems.get("example.remote-hello.greet");
    expect(greet).toMatchObject({ menu: "structural", pluginId: "example.remote-hello" });
    await wb.update(() => greet.run());
    expect(wb.outputs.at(-1)).toEqual({ label: "Remote Hello", result: "Hello! The model has 1 lines." });

    await expect(
      wb.runOperation("example.remote-hello.features", { contains: "camera", limit: 5 }),
    ).resolves.toEqual({
      kind: "table",
      columns: ["#", "Feature"],
      rows: [[1, "Camera"], [2, "CameraFlash"]],
    });
    expect(wb.progress).toEqual([{ message: "Asking flamapy for the features" }]);
    await wb.dispose();
  });
});
