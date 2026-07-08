# Building the pyunigen Pyodide/wasm wheel

`public/flamapy/pyunigen-2.5.8-cp312-cp312-pyodide_2024_0_wasm32.whl` is the native
solver behind the `flamapy-sharpsat` plugin (UniGen + ApproxMC + CryptoMiniSat + Arjun,
all bundled in the pyunigen sdist). PyPI ships no wasm wheel, so it is cross-compiled
here and vendored in git, like `z3_solver`.

## Why the patch

`pyunigen-2.5.8-wasm-fixes.patch` contains two fixes against the pristine 2.5.8 sdist:

1. **Pass `Config`/`SolCount` to `Sampler::sample` by const reference** (sampler.h,
   sampler.cpp). Under emscripten 3.1.58 at any optimization level, the by-value
   `SolCount` argument arrives zeroed in the callee (the caller-side temporary is
   clobbered before the callee reads it, which it only does after several intervening
   calls). Result: every satisfiable formula was reported "unsatisfiable" and the
   process exited. Native builds are unaffected. Passing by reference sidesteps the
   miscompile and is behavior-identical C++.
2. **Guard a 0/0 integer division in `generate_samples`** (sampler.cpp). With
   `num=0` (count-only use — exactly what `SharpSATConfigurationsNumber` does) and
   `startiter == 0`, `sols_to_return(0)` returns 0 and `num_samples_needed /
   samplesPerCall` is 0/0: UB that native compilers happen to optimize away but wasm
   executes and traps on. Upstream-worthy fix.

## Recipe

Toolchain must match the vendored Pyodide runtime (`public/pyodide`, currently 0.26.2:
ABI `pyodide_2024_0`, CPython 3.12, emscripten 3.1.58). Host Python must be 3.12.

```bash
# 1. emsdk pinned to Pyodide 0.26.2's emscripten
git clone https://github.com/emscripten-core/emsdk.git
./emsdk/emsdk install 3.1.58 && ./emsdk/emsdk activate 3.1.58

# 2. pyodide-build in a Python 3.12 venv (wheel<0.46: newer wheel drops wheel.cli,
#    which auditwheel-emscripten still imports)
python3.12 -m venv venv && source venv/bin/activate
pip install pyodide-build==0.26.2 'wheel<0.46'
pyodide config get emscripten_version   # must print 3.1.58
pyodide xbuildenv install 0.26.2

# 3. patched sdist
pip download pyunigen==2.5.8 --no-deps --no-binary :all: -d .
tar xzf pyunigen-2.5.8.tar.gz && cd pyunigen-2.5.8
patch -p1 < ../pyunigen-2.5.8-wasm-fixes.patch

# 4. build (~10 min; venv bin dir must be on PATH — xbuildenv install shells out to pip)
source ../emsdk/emsdk_env.sh
pyodide build
# -> dist/pyunigen-2.5.8-cp312-cp312-pyodide_2024_0_wasm32.whl
```

Copy the wheel to `public/flamapy/` (it is git-tracked via a `.gitignore` exception)
and keep the filename referenced in `public/flamapy/plugins.registry.json` in sync.

## Verifying

Quick headless check with the vendored Pyodide under node (from the repo root):

```js
// node --input-type=module
import { loadPyodide } from "./public/pyodide/pyodide.mjs";
import { readFileSync } from "node:fs";
const py = await loadPyodide({ indexURL: "public/pyodide" });
await py.loadPackage("micropip");
const whl = "pyunigen-2.5.8-cp312-cp312-pyodide_2024_0_wasm32.whl";
py.FS.writeFile("/" + whl, readFileSync("public/flamapy/" + whl));
await py.runPythonAsync(`
import micropip
await micropip.install("emfs:/${whl}", deps=False)
import pyunigen
c = pyunigen.Sampler()
c.add_clause([1, 5]); c.add_clause([10, 11, 12])
cells, hashes, samples = c.sample(num=2, sampling_set=[1, 2, 3, 4])
assert cells * 2**hashes == 16, (cells, hashes)
# count-only path (what SharpSATConfigurationsNumber uses) must not trap:
c2 = pyunigen.Sampler(); c2.add_clause([1])
assert c2.sample(num=0, sampling_set=[1])[0] == 1
print("OK")
`);
```
