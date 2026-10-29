import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { SHARED_MODULES } from "./packages/ide-plugin-api/src/version.ts";

const pluginApiSource = fileURLToPath(new URL("./packages/ide-plugin-api/src", import.meta.url));

// Cross-origin isolation enables SharedArrayBuffer, which the IDE uses to
// interrupt a running Pyodide operation without reloading the whole runtime.
// `credentialless` (instead of `require-corp`) keeps third-party scripts like
// Google Analytics loadable; Safari doesn't support it and simply falls back
// to the restart-based stop. GitHub Pages can't set headers at all — same
// fallback applies there. Keep in sync with nginx.conf.
const crossOriginIsolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), rawEndpointPlugin(), sharedImportMapPlugin()],
  resolve: {
    // One React for the shell and every package plugin, guaranteed rather than left to
    // the resolver (a second copy breaks hooks). Remote plugins get the same instance
    // through the import map below.
    dedupe: ["react", "react-dom"],
    // The workspace builds @flamapy/ide-plugin-api from source; its package.json points at
    // dist/ for consumers of the published package.
    alias: [
      {
        find: /^@flamapy\/ide-plugin-api(\/testing)?$/,
        replacement: `${pluginApiSource}$1/index.ts`,
      },
    ],
  },
  optimizeDeps: {
    exclude: ["pyodide"],
  },
  server: { headers: crossOriginIsolationHeaders },
  preview: { headers: crossOriginIsolationHeaders },
});

// Injects the import map that resolves every SHARED_MODULES specifier (react, react-dom,
// react/jsx-runtime, @flamapy/ide-plugin-api) to its shim in public/shared/, so remotely
// loaded ESM plugins (built with those as externals) share the shell's module instances.
// The shell bundle itself is unaffected: Vite resolves its bare imports at build time.
function sharedImportMapPlugin() {
  return {
    name: "shared-import-map",
    transformIndexHtml() {
      const base = process.env.VITE_BASE_PATH || "/";
      const importMap = {
        imports: Object.fromEntries(
          Object.keys(SHARED_MODULES).map((specifier) => [
            specifier,
            `${base}shared/${sharedShimFile(specifier)}`,
          ]),
        ),
      };
      return [
        {
          tag: "script",
          attrs: { type: "importmap" },
          children: JSON.stringify(importMap),
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

// '@flamapy/ide-plugin-api' -> 'flamapy-ide-plugin-api.js', 'react/jsx-runtime' -> 'react-jsx-runtime.js'.
function sharedShimFile(specifier) {
  return `${specifier.replace(/^@/, "").replaceAll("/", "-")}.js`;
}

// Mirrors the nginx /raw location: decodes ?model= (base64 UTF-8) and returns
// plain text so UVLHub can fetch the raw UVL content during development.
function rawEndpointPlugin() {
  return {
    name: "raw-endpoint",
    configureServer(server) {
      server.middlewares.use("/raw", (req, res) => {
        const model = new URL(req.url, "http://localhost").searchParams.get("model");
        if (!model) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/plain");
          res.end("Missing required query parameter: model\n");
          return;
        }
        try {
          const uvl = Buffer.from(model, "base64").toString("utf-8");
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(uvl);
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/plain");
          res.end("Invalid base64 encoding\n");
        }
      });
    },
  };
}
