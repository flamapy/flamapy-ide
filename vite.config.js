import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), rawEndpointPlugin()],
  optimizeDeps: {
    exclude: ["pyodide"],
  },
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
