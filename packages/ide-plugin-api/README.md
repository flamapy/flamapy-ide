# @flamapy/ide-plugin-api

The plugin contract of [flamapy-ide](https://github.com/flamapy/flamapy-ide), the web IDE
for UVL feature models and their automated analysis with
[flamapy](https://flamapy.github.io).

An **IDE plugin** adds to the IDE's interface: views, menus, commands. It is not a
*flamapy plugin*, the Python package that adds metamodels and operations to flamapy
itself. A flamapy plugin needs no IDE code: the IDE can install its wheel, and its
operations then appear in the IDE.

```bash
npm install --save-dev @flamapy/ide-plugin-api
```

```ts
import type { FlamapyPlugin } from '@flamapy/ide-plugin-api';

export const myPlugin: FlamapyPlugin = {
  manifest: {
    id: 'acme.my-tool',
    name: 'My Tool',
    version: '1.0.0',
    engines: { pluginApi: '^1.0.0' },
    repository: 'https://github.com/acme/my-tool',
    citation: { text: 'Doe, J. (2026). My Tool. In SPLC 2026.', doi: '10.1145/0000000.0000000' },
  },
  activate(ctx) {
    // register views, menus, commands... and push what they return into ctx.subscriptions
  },
};
```

- `@flamapy/ide-plugin-api`: types, `PLUGIN_API_VERSION`, `SHARED_MODULES`,
  `validateManifest`, and the host runtime the IDE itself uses.
- `@flamapy/ide-plugin-api/testing`: `createTestWorkbench`, `stubPlugin`,
  `assertRemoteBundle`: test a plugin against the IDE's real shell core with Vitest or Jest
  and jsdom.

The version follows semver: minor releases only add API. Read the
[plugin authoring guide](https://github.com/flamapy/flamapy-ide/blob/develop/docs/plugin-authoring.md)
for the full contract.
