# FlamapyIDE

_A browser-based Integrated Development Environment for Feature Models, powered by Flamapy on WebAssembly_

## Introduction

FlamapyIDE is a web application for editing, visualizing, and performing Automated Analysis of Feature Models defined in UVL (Universal Variability Language). All computation runs directly in your browser via Pyodide (Python on WebAssembly) — no backend server or local installation of analysis tools required.

## Features

- **UVL editor** with syntax highlighting and real-time validation
- **Graphical visualization** of the feature model tree and constraints
- **Automated analysis** via SAT and BDD solvers:
  - Satisfiability, configurations, dead features, false-optional features, diagnosis, and more
- **Metrics views**: configuration distribution chart and feature inclusion probability chart
- **Guided configurator**: step-by-step product configuration with validity checking
- **Import** feature models from Glencoe (`.gfm.json`), FeatureIDE (`.fide`/`.xml`), AFM (`.afm`), and JSON formats — converted to UVL automatically
- **Export** to UVL, AFM, Glencoe, FeatureIDE, SPLOT, and JSON
- **Real-time collaboration** (optional, requires a backend server)

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

> Metrics views require the BDD plugin to be enabled and a valid model to be loaded.

---

### Running analysis operations

1. Select a solver in the **Automated analysis** section of the toolbar: **SAT** or **BDD**.
2. Open the **Analysis operation** dropdown and pick an operation.
3. The result appears in the **Output** panel at the bottom.

**SAT operations**

| Operation | Description |
|-----------|-------------|
| Satisfiable | Is there at least one valid configuration? |
| Configurations | List all valid configurations |
| Number of configurations | Count of valid configurations |
| Dead features | Features that appear in no valid configuration |
| False optional features | Optional features that are always selected |
| Diagnosis | Identify conflicting constraints |

**BDD operations**

| Operation | Description |
|-----------|-------------|
| Satisfiable | Is there at least one valid configuration? |
| Configurations | List all valid configurations |
| Number of configurations | Count of valid configurations |
| Dead features | Features that appear in no valid configuration |
| Configuration distribution | Number of configurations per feature count |
| Feature inclusion probability | Probability of each feature appearing in a valid configuration |
| Unique features | Features that appear in exactly one configuration |
| Homogeneity | Degree to which configurations resemble each other |
| Variability | Ratio of valid configurations to total possible configurations |
| Variant features | Features that are neither dead nor core |

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

## Deploying locally

### Prerequisites

- Node.js >= 18.5
- A browser with WebAssembly support (all modern browsers)

```bash
git clone https://github.com/flamapy/flamapy-ide.git
cd flamapy-ide
npm install
npm run dev
```

The app is available at http://localhost:5173.

---

## Deploying with Docker

### Build

```bash
# Production
docker build -t flamapy-ide:prod --target prod .

# Development (hot-reload)
docker build -t flamapy-ide:dev --target dev .
```

### Run

```bash
# Production (Nginx on port 80)
docker run -p 80:80 flamapy-ide:prod

# Development (Vite on port 5173 with hot-reload)
docker run -p 5173:5173 -v $(pwd):/app -v /app/node_modules flamapy-ide:dev
```

---

## Running tests

Requires Python >= 3.11.

```bash
pip install -r requirements.txt
# flamapy_configurator is not on PyPI — install the vendored wheel:
pip install public/flamapy/flamapy_configurator-2.0.1-py3-none-any.whl

pytest --cov=public tests/
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_GA_MEASUREMENT_ID` | — | Google Analytics 4 measurement ID (optional, cookie-consent gated) |
| `VITE_ENABLE_COLLAB` | `false` | Set to `"true"` to enable collaborative editing |
| `VITE_COLLAB_URL` | `ws://localhost:1234` | WebSocket URL for the collaboration server |

See `.env.example` for a template.

---

## Enabling Z3

Z3 is disabled by default due to Pyodide/WASM compatibility constraints. To enable it:

1. Edit `public/flamapy/plugins.conf.json` and set `"enabled": true` for the `z3` plugin:

```json
"z3": {
  "enabled": true,
  "wheels": [
    "flamapy_z3-2.5.0-py3-none-any.whl",
    "z3_solver-4.13.4.0-py3-none-pyodide_2024_0_wasm32.whl"
  ]
}
```

2. Make sure the Pyodide-compatible Z3 wheel is present in `public/flamapy/`. The standard PyPI wheel **will not work** in WASM — you need the `pyodide_2024_0_wasm32` build. It must be obtained separately and placed manually (it is not downloaded by `make build-wheels`).

Once enabled, a **Z3** tab appears in the Automated analysis section of the toolbar alongside SAT and BDD.

---

## Setting up the collaboration backend

The collaboration server is a lightweight Node.js WebSocket server using Y.js. It keeps shared documents in memory and requires no database.

### Running the server

```bash
npm install
npm run collab:server
```

By default it listens on `127.0.0.1:1234`. Override with environment variables:

```bash
COLLAB_HOST=0.0.0.0 COLLAB_PORT=4000 npm run collab:server
```

The server exposes a `/health` endpoint — the frontend pings it before creating a session to confirm the backend is reachable.

### Running the frontend against it

```bash
VITE_ENABLE_COLLAB=true VITE_COLLAB_URL=ws://<server-host>:1234 npm run dev
```

Or set the variables in a `.env` file (see `.env.example`):

```env
VITE_ENABLE_COLLAB=true
VITE_COLLAB_URL=ws://localhost:1234
```

### Production deployment

When building for production, pass the variables at build time:

```bash
VITE_ENABLE_COLLAB=true VITE_COLLAB_URL=wss://collab.yourdomain.com npm run build
```

Use `wss://` (TLS) when deploying over HTTPS. The collab server should sit behind a reverse proxy (e.g. Nginx) that handles TLS termination.

---

## Wheel management (contributors)

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
