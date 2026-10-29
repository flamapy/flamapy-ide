// A minimal remote flamapy-ide plugin, written as plain ESM so it can be served from any
// static file server with no build step. The bare imports below resolve through the
// IDE's import map to the shell's own module instances — a remote plugin must never
// bundle its own React copy (hooks would break). Bundled plugins achieve the same by
// declaring react, react-dom, react/jsx-runtime and @flamapy/ide-plugin-api as externals.
//
// Try it (from the flamapy-ide repo):
//   npx serve --cors examples/remote-hello-plugin
//   → in the IDE's Plugins view (puzzle icon), allow loading plugins from a URL
//   → load http://localhost:3000/hello-plugin.js
import { createElement, useState } from "react";
import { serviceId } from "@flamapy/ide-plugin-api";

// The engine's analysis service, by its public id: flamapy knows the model, so the
// plugin asks it instead of parsing UVL itself.
const Analysis = serviceId("flamapy.engine.analysis");

function HelloView() {
  const [count, setCount] = useState(0);
  return createElement(
    "div",
    { className: "flex-1 flex flex-col items-center justify-center gap-3" },
    createElement("p", { className: "text-lg" }, "Hello from a remotely loaded plugin!"),
    createElement(
      "button",
      {
        className: "px-3 py-1 rounded bg-blue-600 text-white",
        onClick: () => setCount(count + 1),
      },
      `Shared React works: clicked ${count} times`,
    ),
  );
}

function HelloStatusItem() {
  return createElement(
    "span",
    { className: "px-2 h-full flex items-center", title: "remote-hello-plugin is active" },
    "👋 remote",
  );
}

export default {
  manifest: {
    id: "example.remote-hello",
    name: "Remote Hello",
    version: "1.0.0",
    // Required for remote plugins: the IDE plugin API range this bundle was built against.
    engines: { pluginApi: "^1.0.0" },
    dependencies: ["flamapy.engine"],
    // Attribution, shown wherever the IDE lists plugins. All optional.
    description: "The reference remote plugin: a view and a status-bar item.",
    authors: [{ name: "flamapy team", url: "https://flamapy.github.io" }],
    repository: "https://github.com/flamapy/flamapy-ide",
    license: "LGPL-3.0",
  },
  activate(ctx) {
    ctx.subscriptions.push(
      ctx.shell.views.register({
        id: "example.remote-hello.view",
        title: "Hello",
        order: 99,
        component: HelloView,
      }),
    );
    ctx.subscriptions.push(
      ctx.shell.statusBar.registerItem({
        id: "example.remote-hello.status",
        side: "right",
        component: HelloStatusItem,
      }),
    );
    // An item in the built-in Structural menu, listed under this plugin's name.
    ctx.subscriptions.push(
      ctx.shell.menus.registerItem({
        id: "example.remote-hello.greet",
        menu: "structural",
        label: "Say hello",
        title: "Writes a greeting to the output panel",
        run() {
          const lines = ctx.shell.documents.getText().split("\n").length;
          ctx.shell.output.show("Remote Hello", `Hello! The model has ${lines} lines.`);
        },
      }),
    );
    // An operation the shell runs: it renders the inputs form, shows progress and the
    // Stop button, and draws the returned table in the output panel.
    ctx.subscriptions.push(
      ctx.shell.operations.register({
        id: "example.remote-hello.features",
        menu: "structural",
        label: "Find features…",
        title: "Lists the features whose name contains some text",
        inputs: [
          { name: "contains", kind: "string", label: "Name contains" },
          { name: "limit", kind: "integer", label: "Show at most", min: 1, default: 10, required: true },
        ],
        async run({ contains = "", limit }, { progress, signal }) {
          progress({ message: "Asking flamapy for the features" });
          const features = await ctx.services.get(Analysis).getFeatures();
          if (signal.aborted) return undefined;
          const matches = features
            .filter((name) => name.toLowerCase().includes(String(contains).toLowerCase()))
            .slice(0, limit);
          return { kind: "table", columns: ["#", "Feature"], rows: matches.map((name, i) => [i + 1, name]) };
        },
      }),
    );
    ctx.shell.output.show("Remote Hello", "The remote example plugin activated.");
  },
};
