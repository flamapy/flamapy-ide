# FlamapyIDE

_Flamapy-based Integrated Developement Environment for Feature Models that runs on WebAssembly_

## Introduction

FlamapyIDE is Francisco Benítez's (@sebasruii) Final Degree Project. It consists of a web application that provides users with tools to perform Automated Analysis of Feature Models defined in UVL (Universal Variability Language). To accomplish this task, it delegates the execution of operations to a web worker that runs Flamapy compiled to webAssembly. Thanks to this, FlamapyIDE runs completely on your browser, without the need for a Backend server to perform AAFM operations, or installation of external tools on your machine.

## Main Features

- UVL Code Editor, with syntax coloring
- Display quick information of the current feature model that automatically updates as the code is edited
- Graphical visualization of the feature model tree
- Execution of SAT-based operations on the model
- Execution of BDD-based operations on the model
- Create a product configuration, and test its validity
- Different export options, including Glencoe, FeatureIDE, AFM or SPLOT
- Import feature models defined in different formats into UVL, including Glencoe, FeatureIDE or AFM

# Deploying the Project locally

## Prerequisites

- To run FlamapyIDE locally, you must have NodeJS (>=18.5) installed.
- Your browser must support WASM.

1. **Clone the repository** (if you haven't already):

   ```bash
   git clone https://github.com/sebasruii/flamapy-ide.git
   cd flamapy-ide

   ```

2. **Install dependencies**

Run `npm install` and wait until all packages have been downloaded.

3. **Run FlamapyIDE**

Once packages have been downloaded, you can run:
`npm run dev`
and this will deploy FlamapyIDE on http://localhost:5173

# Deploying the Project Using Docker

## Prerequisites

Ensure you have Docker installed on your machine. You can install it from [Docker's official site](https://docs.docker.com/get-docker/).

---

## Building the Docker Image

1. **Clone the repository** (if you haven't already):

   ```bash
   git clone https://github.com/sebasruii/flamapy-ide.git
   cd flamapy-ide

   ```

1. **Build the Docker image**

- For production:
  ```
  docker build -t flamapy-ide:prod --target prod .
  ```
- For development:
  ```
  docker build -t flamapy-ide:dev --target dev .
  ```

## Running the Docker Container

### Run the container using the production image:

```bash
docker run -p 80:80 flamapy-ide:prod
   ```

This starts the app on port 80 using Nginx. You can access the app at http://localhost.

Running in Development
Run the container with the development image:

```bash
docker run -p 5173:5173 -v $(pwd):/app -v /app/node_modules flamapy-ide:dev
```

This starts the Vite development server with hot-reloading on port 5173. Access it at http://localhost:5173.

# Running tests

To run the tests you must have Python >=3.10 installed on your system.

First, install the project Python dependencies:

```bash
pip install -r requirements.txt
```

After that, you can run the tests with coverae with the following command

```bash
pytest –cov=public tests/
```

## Experimental real-time collaboration

1. Install JS deps if you haven't recently: `npm install`.
2. Start the collaboration backend (in another terminal): `npm run collab:server` (set `COLLAB_PORT` and `COLLAB_HOST` as needed; defaults to `127.0.0.1:1234`).
3. Start the UI with collaboration enabled: `VITE_ENABLE_COLLAB=true VITE_COLLAB_URL=ws://localhost:1234 npm run dev`.
4. Share a doc by URL: open `http://localhost:5173/editor?doc=my-session-id` in two browsers/tabs to co-edit the same UVL document. Pyodide-based analysis still runs locally on each user and is triggered the same way as before.
