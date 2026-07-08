# Building the pysdd Pyodide/wasm wheel

`public/flamapy/pysdd-1.0.6-cp312-cp312-pyodide_2024_0_wasm32.whl` is the native
library behind the `flamapy-sdd` plugin (Cython binding over the UCLA libsdd-2.0 C
library, all sources bundled). PyPI ships no wasm wheel, so it is cross-compiled and
vendored in git, like `z3_solver` and `pyunigen`.

No source patches are needed. The one catch: **the PyPI sdist of PySDD 1.0.6 is
incomplete** — it is missing the Cython `.pxd` interface files and the three
`pysdd/lib/*/include` header directories, so any from-source build of the sdist fails
("'pysdd/sddapi_c.pxd' not found"). Build from the GitHub tag instead, which contains
identical C sources plus the missing files.

## Recipe

Toolchain must match the vendored Pyodide runtime (`public/pyodide`, currently 0.26.2:
ABI `pyodide_2024_0`, CPython 3.12, emscripten 3.1.58). See
`patches/pyunigen/README.md` for the emsdk + pyodide-build environment setup — it is
the same environment; only the source tree differs:

```bash
curl -sL -o pysdd-1.0.6.tar.gz \
  https://github.com/wannesm/PySDD/archive/refs/tags/v1.0.6.tar.gz
tar xzf pysdd-1.0.6.tar.gz && cd PySDD-1.0.6
source ../emsdk/emsdk_env.sh
pyodide build
# -> dist/pysdd-1.0.6-cp312-cp312-pyodide_2024_0_wasm32.whl
```

Copy the wheel to `public/flamapy/` (git-tracked via a `.gitignore` exception) and keep
the filename referenced in `public/flamapy/plugins.registry.json` in sync.

## Verifying

Headless check with the vendored Pyodide under node (from the repo root):

```js
// node --input-type=module
import { loadPyodide } from "./public/pyodide/pyodide.mjs";
import { readFileSync } from "node:fs";
const py = await loadPyodide({ indexURL: "public/pyodide" });
await py.loadPackage("micropip");
const whl = "pysdd-1.0.6-cp312-cp312-pyodide_2024_0_wasm32.whl";
py.FS.writeFile("/" + whl, readFileSync("public/flamapy/" + whl));
await py.runPythonAsync(`
import micropip
await micropip.install("emfs:/${whl}", deps=False)
from pysdd.sdd import SddManager, Vtree
m = SddManager.from_vtree(Vtree(var_count=3, vtree_type='balanced'))
a, b, c = m.vars
assert m.global_model_count(a | b) == 6
assert (a & -a).is_false()
print("OK")
`);
```
