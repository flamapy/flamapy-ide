import { defineConfig } from "vite";

// Library build for publishing: plain ESM in dist/, React left to the host. Inside the
// flamapy-ide workspace nothing builds this; the IDE aliases the package to src/.
export default defineConfig({
  build: {
    lib: {
      entry: { index: "src/index.ts", testing: "src/testing/index.ts" },
      formats: ["es"],
    },
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
