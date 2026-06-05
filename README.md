# FlamapyIDE

_A browser-based Integrated Development Environment for Feature Models, powered by Flamapy on WebAssembly_

> **Try it now at [ide.flamapy.org](https://ide.flamapy.org) — nothing to install.**

## Introduction

FlamapyIDE is a web application for editing, visualizing, and performing Automated Analysis of Feature Models defined in UVL (Universal Variability Language). All computation runs directly in your browser via Pyodide (Python on WebAssembly) — no backend server or local installation of analysis tools required.

## Contents

- [Quick start](#quick-start)
- [Features](#features)
- [Using FlamapyIDE](#using-flamapyide)
- [Deployment](#deployment)
- [Development](#development)

---

## Quick start

| I want to… | Do this |
|------------|---------|
| **Just use it** | Open **[ide.flamapy.org](https://ide.flamapy.org)** in any modern browser |
| **Self-host it** | `docker run --rm -p 8080:80 flamapy/flamapy-ide`, then open http://localhost:8080 |
| **Hack on it** | See [Development](#development) (`npm install && npm run dev`) |

---

## Features

- **UVL editor** with syntax highlighting and real-time validation
- **Graphical visualization** of the feature model tree and constraints
- **Structural operations** (no solver needed): metrics, atomic sets, variation points, leaf features, max depth, estimated configurations, and more
- **Automated analysis** via SAT, BDD, and Z3 solvers:
  - Satisfiability, configurations, dead/core/false-optional features, sampling, backbone, diagnosis, and more — the IDE only lists the operations each enabled solver supports
- **Attribute optimization** (Z3): minimize/maximize numerical feature attributes
- **Configuration-driven operations**: valid configuration, filter, commonality, diagnosis, and conflict, run against the configurator's current selection
- **Metrics views**: configuration distribution chart, feature inclusion probability chart, and a feature flow map of attribute values
- **Guided configurator**: step-by-step product configuration with validity checking
- **Import** feature models from Glencoe (`.gfm.json`), FeatureIDE (`.fide`/`.xml`), AFM (`.afm`), and JSON formats — converted to UVL automatically
- **Export** to UVL, AFM, Glencoe, FeatureIDE, SPLOT, and JSON
- **Real-time collaboration** (built into the Docker image; see [Collaboration backend](#collaboration-backend))

---

## Using FlamapyIDE

### Interface overview

The IDE is divided into three main areas:

| Area | Description |
|------|-------------|
| **Left panel** — Configuration | Shows the feature tree and drives the guided configurator |
| **Center** — Editor / View | UVL source editor, graph view, or metrics charts |
| **Bottom** — Output | Displays results of analysis operations |
| **Right panel** — Model information | Shows validation status and model metrics (features, constraints, etc.) |
| **Top toolbar** | View switcher, analysis operations, export, and collaboration controls |

---

### Loading a model

**Type directly** — start writing UVL in the editor. The model is validated automatically as you type.

**Open a file** — click **Open file** in the home screen or use the file picker. Supported input formats:

| Format | Extension |
|--------|-----------|
| UVL | `.uvl` |
| Glencoe | `.gfm.json` |
| FeatureIDE | `.fide`, `.xml` |
| AFM | `.afm` |
| JSON | `.json` |

Non-UVL formats are converted to UVL automatically on import.

**Load a sample** — the home screen offers built-in example models (Smart Watch, Xiaomi Band 8, etc.) to get started quickly.

---

### Editing UVL

The editor provides:
- Syntax highlighting for UVL keywords (`features`, `constraints`, `mandatory`, `optional`, `alternative`, `or`)
- Real-time error markers for syntax issues
- The **Model information** panel on the right updates automatically with feature count, constraint count, and other structural properties

A minimal valid UVL model looks like:

```uvl
namespace MyModel
features
    Root
        mandatory
            FeatureA
        optional
            FeatureB
constraints
    FeatureB => FeatureA
```

---

### Switching views

Use the **View** section in the toolbar to switch between:

| View | Description |
|------|-------------|
| **Source** | UVL text editor |
| **Graph** | Graphical tree of features and constraints |
| **Metrics > Config. Distribution** | Line chart showing how configurations distribute over feature counts, with descriptive statistics |
| **Metrics > Feature Prob.** | Bar chart of feature inclusion probabilities (dead, optional, and core features highlighted) |
| **Metrics > Feature Flow Map** | Tree map of a chosen numerical attribute's value across the feature hierarchy |

> The Config. Distribution and Feature Prob. views require the BDD plugin to be enabled and a valid model to be loaded.

---

### Running analysis operations

Operations are grouped by what they need. Results appear in the **Output** panel at the bottom.

**Structural operations** require no solver — they come from the always-present feature-model plugin:

| Operation | Description |
|-----------|-------------|
| Metrics | Aggregate structural metrics of the model |
| Atomic sets | Groups of features that are always selected together |
| Variation points | Features that introduce variability |
| Leaf features / Leaf count | Features with no children, and their count |
| Average branching factor | Mean number of children per feature |
| Max depth | Depth of the deepest feature |
| Estimated configurations | Upper-bound estimate of the configuration space |
| Feature ancestors | Ancestors of a chosen feature |

**Solver operations** — pick a solver (**SAT**, **BDD**, or **Z3**, whichever are enabled) and an operation. The dropdown only lists operations the selected solver actually supports; when more than one solver implements an operation, the chosen solver is used as the backend.

| Operation | Solvers | Description |
|-----------|---------|-------------|
| Satisfiable | SAT, BDD, Z3 | Is there at least one valid configuration? |
| Configurations | SAT, BDD, Z3 | List all valid configurations |
| Number of configurations | SAT, BDD, Z3 | Count of valid configurations |
| Dead features | SAT, BDD, Z3 | Features that appear in no valid configuration |
| Core features | SAT, Z3 | Features present in every valid configuration |
| False optional features | SAT, Z3 | Optional features that are always selected |
| Sampling | SAT, BDD | A random sample of valid configurations (choose a size) |
| Backbone | SAT | Features fixed across all configurations |
| Unique features | BDD | Features that appear in exactly one configuration |
| Variant features | BDD | Features that are neither dead nor core |
| Pure optional features | BDD | Features whose selection is fully independent |
| Homogeneity | BDD | Degree to which configurations resemble each other |
| Variability | BDD | Ratio of valid configurations to total possible configurations |
| Configurations with N features | BDD | Configurations with exactly N selected features (choose N) |
| Feature bounds / Feature bounds (all) | Z3 | Min/max value bounds for numerical feature attributes |
| Attribute optimization | Z3 | Minimize/maximize numerical attributes (opens a dedicated goal modal) |

> Operations that need an extra input (sampling size, a feature name, N) prompt for it before running.

**Configuration-driven operations** run from the **Configuration** panel against the configurator's current selection: Valid configuration, Filter, Commonality, Diagnosis, and Conflict.

> If the model has syntax errors, running any operation shows an error message in the Output panel without switching views.

---

### Guided configurator

The **Configuration** panel on the left side drives a step-by-step product configuration:

1. The panel shows the feature tree. Select or deselect features to build a configuration.
2. Each selection is validated in real time.
3. Use the **Undo** button to step back through your choices.
4. Completed configurations can be tested against the model.

To show or hide the configuration panel, use the collapse button on its right edge.

---

### Exporting a model

Click **Export** in the toolbar and choose a format:

| Format | Extension |
|--------|-----------|
| UVL | `.uvl` |
| AFM | `.afm` |
| Glencoe | `.gfm.json` |
| FeatureIDE (SPLOT) | `.sxfm` |
| JSON | `.json` |

The file downloads immediately to your browser's default download location.

---

## Deployment

The hosted instance at [ide.flamapy.org](https://ide.flamapy.org) is the easiest way to use
FlamapyIDE. To run your own instance, deploy the Docker image — it is **self-contained**:
nginx serves the app and reverse-proxies `/collab` to the [collaboration backend](#collaboration-backend)
running inside the same container. One image, one command, no Node on the host.

### Run from Docker Hub (no build)

The released image is published to Docker Hub as
[`flamapy/flamapy-ide`](https://hub.docker.com/r/flamapy/flamapy-ide) (multi-arch:
`linux/amd64` and `linux/arm64`):

```bash
docker run --rm -p 8080:80 flamapy/flamapy-ide
```

Then open http://localhost:8080. Use `:latest` (the default) for the newest stable
release, or pin a specific version, e.g. `flamapy/flamapy-ide:1.4.0`. Collaboration is
enabled out of the box — the WebSocket URL is derived from the page's own origin, so the
same image works on `localhost` or any domain (use `wss://` behind a TLS-terminating proxy
in production) without rebuilding.

### Build the image yourself

```bash
docker build -t flamapy-ide .
docker run --rm -p 8080:80 flamapy-ide
```

`docker compose up --build` does the same via `docker-compose.yml`.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_GA_MEASUREMENT_ID` | — | Google Analytics 4 measurement ID (optional, cookie-consent gated) |
| `VITE_ENABLE_COLLAB` | `false` (`true` in the Docker image) | Set to `"true"` to enable collaborative editing |
| `VITE_COLLAB_URL` | same origin (`ws(s)://<host>/collab`) | WebSocket URL for the collaboration server; override to point at an external server |

See `.env.example` for a template.

### Collaboration backend

The collaboration server is a lightweight Node.js WebSocket server using Y.js. It keeps shared documents in memory and requires no database. It exposes a `/health` endpoint — the frontend pings it before creating a session to confirm the backend is reachable.

**In the Docker image (default)** — nothing to set up: the production image runs the collab server alongside nginx and proxies it at `/collab`, with collaboration enabled by default. Just `docker run` the image (see [Run from Docker Hub](#run-from-docker-hub-no-build)).

**Standalone (local dev or scaling it out separately)**:

```bash
npm install
npm run collab:server          # listens on 127.0.0.1:1234
COLLAB_HOST=0.0.0.0 COLLAB_PORT=4000 npm run collab:server   # override host/port
```

Then run the frontend against it (in `npm run dev`, `VITE_*` are read at startup):

```bash
VITE_ENABLE_COLLAB=true VITE_COLLAB_URL=ws://localhost:1234 npm run dev
```

Or set the variables in a `.env` file (see `.env.example`). For a production build pointing at an external server, pass them at build time and use `wss://` over HTTPS:

```bash
VITE_ENABLE_COLLAB=true VITE_COLLAB_URL=wss://collab.yourdomain.com npm run build
```

---

## Development

### Running locally

**Prerequisites:** Node.js >= 18.5 and a browser with WebAssembly support (all modern browsers).

```bash
git clone https://github.com/flamapy/flamapy-ide.git
cd flamapy-ide
npm install
npm run dev
```

The app is available at http://localhost:5173 with hot reload.

Prefer a container? The Docker `dev` target gives the same hot-reload server:

```bash
docker build -t flamapy-ide:dev --target dev .
docker run -p 5173:5173 -v $(pwd):/app -v /app/node_modules flamapy-ide:dev
```

### Running tests

Requires Python >= 3.11.

```bash
pip install -r requirements.txt
# flamapy_configurator is not on PyPI — install the vendored wheel:
pip install public/flamapy/flamapy_configurator-2.0.1-py3-none-any.whl

pytest --cov=public tests/
```

### Wheel management

Python wheels served to Pyodide are stored in `public/flamapy/`. To update them after changing versions in the Makefile:

```bash
# Download all wheels from PyPI and remove stale ones
make build-wheels
```

`plugins.conf.json` is the single source of truth for which wheels are loaded. To remove wheels that are no longer listed there without re-downloading:

```bash
make clean-old-wheels
```

> `flamapy_configurator` is not on PyPI — its vendored wheel in `public/flamapy/` must be updated manually.
