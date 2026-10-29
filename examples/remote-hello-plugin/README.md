# remote-hello-plugin

The reference remote plugin for flamapy-ide's experimental remote loading: a single
plain-ESM file (`hello-plugin.js`) that contributes a view, a status-bar item, a
*Say hello* item in the Structural menu, and a *Find features…* operation (inputs form,
progress and a table result) that asks the flamapy engine for the model's features.

## The remote plugin contract

- **Default-export** a `{ manifest, activate }` object (the same `FlamapyPlugin` shape a
  workspace plugin has; see `@flamapy/ide-plugin-api`). The manifest must declare
  `engines.pluginApi`, the IDE plugin API range the bundle was built against; the attribution
  fields (authors, repository, citation, logo...) are optional but recommended.
- **Never bundle React.** Import `react`, `react-dom`, `react/jsx-runtime` and
  `@flamapy/ide-plugin-api` as bare specifiers (the `SHARED_MODULES` of the plugin API): the
  IDE's import map resolves them to the shell's instances. When building with a bundler
  (vite lib mode, rollup, esbuild), declare exactly those as externals. Relative lazy
  chunks and assets are fine; the entry doesn't have to be a single file.
- **Serve with CORS headers.** The IDE runs cross-origin isolated
  (`Cross-Origin-Embedder-Policy: credentialless`), so the plugin host must allow
  cross-origin fetching.

`hello-plugin.test.js` checks all of this with `assertRemoteBundle` from
`@flamapy/ide-plugin-api/testing`, then activates the plugin in a test workbench.

## Try it

```bash
npx serve --cors examples/remote-hello-plugin   # serves on http://localhost:3000
```

In the IDE: activity bar → puzzle icon (*Plugins*) → *Add a plugin from a URL* → allow
loading plugins from a URL → load `http://localhost:3000/hello-plugin.js`. A "Hello" tab,
a 👋 status-bar item and two Structural menu entries (under *Remote Hello*) appear, and
the plugin gets its card in the Plugins view. The URL is remembered and reloaded on the
next startup while loading from URLs stays allowed.
