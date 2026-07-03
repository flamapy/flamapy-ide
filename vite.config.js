import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
  plugins: [react(), rawEndpointPlugin()],
  optimizeDeps: {
    exclude: ["pyodide"],
  },
  server: { headers: crossOriginIsolationHeaders },
  preview: { headers: crossOriginIsolationHeaders },
});

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
