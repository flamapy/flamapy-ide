/* eslint-disable react/prop-types */
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "react-resizable/css/styles.css";
import ModelInformation from "../../components/ModelInformation";
import UVLEditor from "../../components/UVLEditor";
import TitleBar from "../../components/layout/TitleBar";
import ActionToolbar from "../../components/layout/ActionToolbar";
import ActivityBar from "../../components/layout/ActivityBar";
import EditorTabs from "../../components/layout/EditorTabs";
import BottomPanel from "../../components/layout/BottomPanel";
import StatusBar from "../../components/layout/StatusBar";
import { saveAs } from "file-saver";
import TreeView from "../../components/FeatureTree";
import FeatureModelVisualization from "../../components/FeatureModelVisualization";
import Wizard from "../../components/Wizard";
import ProductDistributionChart from "../../components/ProductDistributionChart";
import FeatureInclusionProbabilitiesChart from "../../components/FeatureInclusionProbabilitiesChart";
import FeatureFlowMap from "../../components/FeatureFlowMap";
import ParetoFrontChart from "../../components/ParetoFrontChart";
import ErrorBoundary from "../../components/ErrorBoundary";
import OperationInputModal from "../../components/OperationInputModal";
import BackendSettingsModal from "../../components/BackendSettingsModal";
import PluginManagerModal from "../../components/PluginManagerModal";
import AttributeOptimizationModal from "../../components/AttributeOptimizationModal";
import AttributeSelectionModal from "../../components/AttributeSelectionModal";
import JSZip from "jszip";
import { useWorkerClient } from "../../hooks/useWorkerClient";
import {
  solverOptionsFromCatalog,
  installedBackends,
  structuralOperationsFromCatalog,
  analysisOperationsForSolver,
} from "../../utils/operationCatalog";
import {
  WASM,
  REST,
  loadBackend,
  saveBackend,
  loadRestUrl,
  saveRestUrl,
  executeRestOperation,
  executeRestOperationWithConfig,
} from "../../utils/computeBackend";

// The analysis/structural operation menus are derived at runtime from the plugin
// capability catalog the Pyodide bridge reports (which backends implement which
// operations), so runtime-installed plugins surface without an IDE edit. The
// derivation + the IDE's presentation layer (labels, input prompts, order, the one
// legacy modal operation) live in ../../utils/operationCatalog.

// Runtime-installed plugins are remembered here so they are re-applied on the next
// load (a fresh Pyodide worker starts with only the bundled defaults). Each stored
// descriptor is { wheelRefs, pyodidePackages, key?, label? }.
const INSTALLED_PLUGINS_KEY = "flamapy-ide-installed-plugins";

function loadInstalledPlugins() {
  try {
    const raw = localStorage.getItem(INSTALLED_PLUGINS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveInstalledPlugins(list) {
  localStorage.setItem(INSTALLED_PLUGINS_KEY, JSON.stringify(list));
}

function pluginSignature(descriptor) {
  return descriptor.key || (descriptor.wheelRefs || []).join("|");
}

// Configuration-input operations — run from the configuration panel against the tree's
// current selection (a {feature: value} mapping). A `method` entry runs that mapping
// through the facade; a `value` entry drives a UI-only flow (wizard, download).
const CONFIG_OPERATIONS = [
  { label: "Valid configuration", method: "satisfiable_configuration" },
  { label: "Filter", method: "filter" },
  { label: "Commonality", method: "commonality" },
  { label: "Diagnosis", method: "diagnosis" },
  { label: "Conflict", method: "conflict" },
  { label: "Interactive Configuration", value: "configurator" },
  { label: "Download Configurator", value: "downloadConfigurator" },
];

const EXPORT_OPERATIONS = [
  { label: "AFM", value: "afm" },
  { label: "Glencoe", value: "gfm.json" },
  { label: "JSON", value: "json" },
  { label: "SPLOT", value: "sxfm" },
  { label: "Download UVL", value: "uvl" },
];

// Collaboration endpoint when VITE_COLLAB_URL is not set: derive it from the page's
// own origin so the all-in-one Docker image (nginx proxies /collab to the bundled
// collab server) works on localhost or any domain without a rebuild. Falls back to
// the local dev server when there is no window (e.g. tests).
function defaultCollabEndpoint() {
  if (typeof window === "undefined") return "ws://localhost:1234";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/collab`;
}

function EditorPage({ selectedFile, darkMode, toggleDark }) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const docIdFromQuery = searchParams.get("doc");
  const collabFeatureAvailable = import.meta.env.VITE_ENABLE_COLLAB === "true";
  const collabEnabled = collabFeatureAvailable && !!docIdFromQuery;
  const collabEndpoint = import.meta.env.VITE_COLLAB_URL || defaultCollabEndpoint();
  const collabConfig = collabEnabled
    ? { enabled: true, docId: docIdFromQuery, endpoint: collabEndpoint }
    : { enabled: false };

  const { isLoaded, pluginCatalog, call, installPlugin, interrupt, restart } = useWorkerClient();

  const [isRunning, setIsRunning] = useState(false);
  const [isImported, setIsImported] = useState(true);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [validation, setValidation] = useState(null);
  const [lastOutputHeight, setLastOutputHeight] = useState(150);
  const [output, setOutput] = useState({
    label: "Loading Flamapy...",
    result: selectedFile ? `Importing model '${selectedFile.name}'` : "FlamapyIDE is starting",
  });
  const [copyMessage, setCopyMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [uvlhubMessage, setUvlhubMessage] = useState("");
  const [collabStatus, setCollabStatus] = useState("");
  const [initialContent, setInitialContent] = useState("");
  // Model metrics (right panel) — fetched separately from validation because
  // some metrics are full analyses and must not run on every (debounced) keystroke.
  const [modelInfo, setModelInfo] = useState(null);
  const [featureTree, setFeatureTree] = useState(null);
  const [currentView, setCurrentView] = useState("source");
  const [constraints, setConstraints] = useState(null);
  const [history, setHistory] = useState(null);
  const [showConfiguratorPanel, setShowConfiguratorPanel] = useState(true);
  const [modelInfoOpen, setModelInfoOpen] = useState(true);
  const [panelTab, setPanelTab] = useState("output");

  // Plugin config synced from worker on load
  const [enabledPlugins, setEnabledPlugins] = useState({ sat: true, bdd: true, z3: true });

  // Operation-argument modal state ({ action, options } while open, else null)
  const [inputModal, setInputModal] = useState(null);

  // Z3 attribute optimization modal state
  const [isAttrOptModalOpen, setIsAttrOptModalOpen] = useState(false);
  const [attrOptBackend, setAttrOptBackend] = useState("z3");
  const [numericalAttributes, setNumericalAttributes] = useState(null);
  const [optimizationGoals, setOptimizationGoals] = useState({});

  // Chart data state
  const [configDistData, setConfigDistData] = useState(null);
  const [fipData, setFipData] = useState(null);
  const [paretoFrontData, setParetoFrontData] = useState(null);

  const [isAttrSelectionModalOpen, setIsAttrSelectionModalOpen] = useState(false);
  const [numericalAttributesSelection, setNumericalAttributesSelection] = useState(null);
  const [selectedAttribute, setSelectedAttribute] = useState(null);
  const [ffmData, setFfmData] = useState(null);

  const [selectedSolver, setSelectedSolver] = useState("sat");
  // Compute backend: in-browser WASM (default) or a remote flamapy-rest API.
  const [computeBackend, setComputeBackend] = useState(loadBackend);
  const [restApiUrl, setRestApiUrl] = useState(loadRestUrl);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [isPluginModalOpen, setIsPluginModalOpen] = useState(false);
  const editorRef = useRef(null);
  // The exact editor content the current `validation` state refers to; lets
  // ensureValidated() skip revalidation only when nothing changed since.
  const lastValidatedCodeRef = useRef(null);

  const selectBackend = useCallback((backend) => {
    setComputeBackend(backend);
    saveBackend(backend);
    if (backend === REST) setIsBackendModalOpen(true);
  }, []);

  // Install a plugin at runtime and remember it, so the choice is re-applied on the
  // next load (a fresh worker only has the bundled defaults). `descriptor` is
  // { wheelRefs, pyodidePackages, key?, label? }.
  const handleInstallPlugin = useCallback(
    async (descriptor) => {
      await installPlugin({
        wheelRefs: descriptor.wheelRefs,
        pyodidePackages: descriptor.pyodidePackages,
      });
      const list = loadInstalledPlugins();
      const sig = pluginSignature(descriptor);
      if (!list.some((d) => pluginSignature(d) === sig)) {
        saveInstalledPlugins([...list, descriptor]);
      }
    },
    [installPlugin]
  );

  // Re-apply remembered plugin installs once the (fresh) worker is ready.
  useEffect(() => {
    if (!isLoaded) return;
    const list = loadInstalledPlugins();
    if (list.length === 0) return;
    (async () => {
      for (const descriptor of list) {
        try {
          await installPlugin({
            wheelRefs: descriptor.wheelRefs,
            pyodidePackages: descriptor.pyodidePackages,
          });
        } catch (error) {
          console.error("Failed to re-install plugin", descriptor, error);
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Which solver backends are installed, derived from the capability catalog the
  // worker reports (updated live when a plugin is installed at runtime). Gates the
  // solver tabs, the bdd-only metrics views, and the "keep selectedSolver valid".
  useEffect(() => {
    if (pluginCatalog) {
      const enabled = {};
      for (const backend of installedBackends(pluginCatalog)) enabled[backend] = true;
      setEnabledPlugins(enabled);
    }
  }, [pluginCatalog]);

  // When worker finishes loading, update output and trigger file import if needed
  useEffect(() => {
    if (isLoaded) {
      setOutput({
        label: "Flamapy is ready",
        result: "Here you will see the result of executing an operation",
      });
      if (selectedFile) setIsImported(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Restore editor content on startup: URL ?model= param takes priority over localStorage
  useEffect(() => {
    if (isLoaded && isEditorReady && !selectedFile) {
      const modelParam = searchParams.get("model");
      if (modelParam) {
        try {
          const decoded = decodeURIComponent(escape(atob(modelParam)));
          editorRef.current.setValue(decoded);
          setInitialContent(decoded);
          return;
        } catch { /* ignore malformed param */ }
      }
      const saved = localStorage.getItem("flamapy-ide-content");
      if (saved) {
        editorRef.current.setValue(saved);
        setInitialContent(saved);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isEditorReady]);

  const viewOptions = useMemo(() => [
    { label: "Source", value: "source" },
    { label: "Graph", value: "graph" },
  ], []);

  const metricsOptions = useMemo(() => {
    if (!enabledPlugins.bdd) return [];
    return [
      { label: "Config. Distribution", value: "configdist" },
      { label: "Feature Prob.", value: "fip" },
      { label: "Feature Flow Map", value: "ffm" },
    ];
  }, [enabledPlugins.bdd]);

  // Reset to source if current view becomes unavailable (e.g. BDD disabled)
  useEffect(() => {
    if (!enabledPlugins.bdd && (currentView === "configdist" || currentView === "fip")) {
      setCurrentView("source");
    }
  }, [enabledPlugins.bdd, currentView]);

  // Solver tabs + operation menus, derived from the plugin capability catalog.
  const solverOptions = useMemo(() => solverOptionsFromCatalog(pluginCatalog), [pluginCatalog]);
  const structuralOptions = useMemo(
    () => structuralOperationsFromCatalog(pluginCatalog),
    [pluginCatalog]
  );
  const analysisOptions = useMemo(
    () => analysisOperationsForSolver(pluginCatalog, selectedSolver),
    [pluginCatalog, selectedSolver]
  );

  // Keep selectedSolver valid after config loads
  useEffect(() => {
    if (!enabledPlugins[selectedSolver]) {
      const first = Object.entries(enabledPlugins).find(([, v]) => v);
      if (first) setSelectedSolver(first[0]);
    }
  }, [enabledPlugins, selectedSolver]);

  // Import file once worker and editor are both ready
  useEffect(() => {
    if (selectedFile && isLoaded && !isImported && isEditorReady) {
      const reader = new FileReader();
      const fileName = selectedFile.name;
      const fileExtension = fileName.substring(fileName.indexOf(".") + 1);
      reader.onload = async (e) => {
        const fileContent = e.target.result;
        setInitialContent(fileContent);
        if (fileExtension === "uvl") {
          editorRef.current.setValue(fileContent);
          editorRef.current.layout();
          setIsImported(true);
        } else {
          try {
            const result = await call("importModel", { fileContent, fileExtension });
            editorRef.current.setValue(result);
            setInitialContent(result);
            editorRef.current.layout();
            setIsImported(true);
          } catch (error) {
            setOutput({
              label: "Import error",
              result: error.message?.includes("not_supported")
                ? "The provided file extension is not supported. Try: .gfm.json, .afm, .fide, .json, .xml or .uvl"
                : "There was an error importing the model. Please verify it is valid.",
            });
            setIsImported(true);
          }
        }
      };
      reader.readAsText(selectedFile);
    }
  }, [isLoaded, isImported, selectedFile, call, isEditorReady]);

  // Fetch feature tree whenever validation succeeds
  useEffect(() => {
    if (validation?.valid) {
      call("getFeatureTree").then((result) => setFeatureTree(result)).catch(() => {});
    }
  }, [validation, call]);

  useEffect(() => {
    if (currentView === "configurator") setShowConfiguratorPanel(true);
  }, [currentView]);

  const handleResize = (e, data) => {
    e.preventDefault();
    if (data.size.height !== lastOutputHeight) {
      editorRef.current.layout({});
      setLastOutputHeight(data.size.height);
    }
  };

  function getConstraints(code) {
    const startIndex = code.indexOf("constraints");
    if (startIndex === -1) return null;
    return code
      .substring(startIndex)
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l !== "");
  }

  function validateModel() {
    if (!isLoaded) return Promise.resolve(null);
    const code = editorRef.current.getValue();
    setInitialContent(code);
    if (!collabConfig.enabled) {
      localStorage.setItem("flamapy-ide-content", code);
    }
    return call("validateModel", code)
      .then((result) => {
        lastValidatedCodeRef.current = code;
        setValidation(result);
        setModelInfo(null); // metrics refer to the previous model — refetch on demand
        setConstraints(getConstraints(code));
        return result;
      })
      .catch((error) => {
        setOutput({
          label: "Validation error",
          result: `An exception occurred validating the model: ${error.message}. Try restarting Flamapy.`,
        });
        return null;
      });
  }

  // Operations must run against the code currently in the editor: reuse the
  // last validation only if the content hasn't changed since (typing-triggered
  // validation is debounced, so `validation` alone can be stale).
  async function ensureValidated() {
    if (validation && editorRef.current?.getValue() === lastValidatedCodeRef.current) {
      return validation;
    }
    return await validateModel();
  }

  // The right panel's Validate button also computes the model metrics, which
  // are deliberately excluded from per-keystroke validation (they include full
  // analyses such as core features and atomic sets).
  async function handleValidateClick() {
    const result = await validateModel();
    if (result?.valid) {
      try {
        setModelInfo(await call("getModelInformation"));
      } catch (error) {
        setOutput({ label: "Model information", result: error.message });
      }
    }
  }

  async function executeAction(action) {
    if (!isLoaded) return;
    const currentValidation = await ensureValidated();
    if (!currentValidation?.valid) {
      setOutput({ label: action.label, result: "Error: the model is not valid. Fix syntax errors and retry." });
      return;
    }

    if (action.engine === "legacy" && action.value === "AttributeOptimization") {
      try {
        const attrs = await call("getNumericalAttributes");
        setNumericalAttributes(attrs);
        setAttrOptBackend(action.backendAware ? selectedSolver : "z3");
        setIsAttrOptModalOpen(true);
      } catch (error) {
        setOutput({ label: "Attribute extraction error", result: error.message });
      }
      return;
    }

    if (action.input) {
      // Operation needs an extra argument: collect it via a modal, then run.
      let options = [];
      if (action.input.kind === "feature") {
        try {
          options = await call("getFeatures");
        } catch (error) {
          setOutput({ label: action.label, result: error.message });
          return;
        }
      }
      setInputModal({ action, options });
      return;
    }

    runOperation(action);
  }

  async function runOperation(action) {
    setIsRunning(true);
    setOutput({ label: action.label, result: "Executing operation" });
    try {
      // Forward the selected solver only to backend-aware operations, merged with any
      // argument already collected for the operation.
      const args = action.backendAware
        ? { ...(action.args || {}), backend: selectedSolver }
        : action.args || {};
      let result;
      if (computeBackend === REST) {
        result = await executeRestOperation({
          baseUrl: restApiUrl,
          method: action.method,
          modelText: editorRef.current.getValue(),
          args,
        });
      } else {
        const data = action.backendAware ? { ...action, args } : action;
        result = JSON.parse((await call("executeFacadeOperation", data)).result);
      }
      setOutput({ label: action.label, result });
    } catch (error) {
      setOutput({ label: action.label, result: describeError(error) });
    }
    setIsRunning(false);
  }

  // Turn a worker/REST failure into a message the user can act on. The worker
  // forwards the real Python error; an interrupt surfaces as KeyboardInterrupt.
  function describeError(error) {
    const message = error?.message || "";
    if (message.includes("KeyboardInterrupt")) {
      return "Operation interrupted.";
    }
    if (computeBackend === REST) {
      return `Remote API error: ${message}`;
    }
    return message
      ? `Error: ${message}`
      : "An exception occurred. Check the model definition.";
  }

  function confirmInputOperation(value) {
    const { action } = inputModal;
    setInputModal(null);
    runOperation({ ...action, args: { ...(action.args || {}), [action.input.arg]: value } });
  }

  async function executeActionWithConf(action, configuration) {
    if (!isLoaded) return;
    const currentValidation = await ensureValidated();
    if (!currentValidation?.valid) {
      setOutput({ label: action.label, result: "Error: the model is not valid. Fix syntax errors and retry." });
      return;
    }

    if (action.method) {
      setIsRunning(true);
      setOutput({ label: action.label, result: "Executing operation" });
      try {
        let result;
        if (computeBackend === REST) {
          result = await executeRestOperationWithConfig({
            baseUrl: restApiUrl,
            method: action.method,
            modelText: editorRef.current.getValue(),
            configMapping: configuration,
            args: action.args || {},
          });
        } else {
          const configs = { configuration_path: configuration };
          result = JSON.parse(
            (await call("executeFacadeOperationWithConfig", { action, configs })).result
          );
        }
        setOutput({ label: action.label, result });
      } catch (error) {
        setOutput({ label: action.label, result: describeError(error) });
      }
      setIsRunning(false);
    } else if (action.value === "configurator") {
      toggleView(action);
    } else if (action.value === "downloadConfigurator") {
      const zip = new JSZip();
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/flamapy.conf.zip`);
        if (!response.ok) throw new Error("Failed to load base.zip");
        const baseZip = await JSZip.loadAsync(await (await response.blob()).arrayBuffer());
        baseZip.forEach((relativePath, file) => zip.file(relativePath, file.async("arraybuffer")));
        const featureModel = new File([editorRef.current.getValue()], "FeatureModel.uvl", { type: "text/plain" });
        zip.file(`models/${featureModel.name}`, featureModel);
        saveAs(await zip.generateAsync({ type: "blob" }), "configurator.zip");
      } catch (err) {
        console.error("Error processing ZIP:", err);
        setOutput({ label: "Download Configurator", result: `Failed to generate the configurator ZIP: ${err.message}` });
      }
    }
  }

  function interruptExecution() {
    if (!isLoaded) return;
    // Fast path: raise KeyboardInterrupt inside the running Python operation
    // (needs cross-origin isolation). The pending call rejects and is shown as
    // "Operation interrupted." — Flamapy itself stays loaded.
    if (interrupt()) {
      setOutput({ label: "Execution interrupted", result: "Stopping the running operation…" });
      return;
    }
    // Fallback (no SharedArrayBuffer): tear down and reload the whole runtime.
    restart();
    setIsRunning(false);
    setValidation(null);
    setOutput({ label: "Execution interrupted", result: "Re-starting Flamapy..." });
  }

  async function downloadFile(action) {
    if (!isLoaded) return;
    try {
      const result = await call("downloadFile", action);
      saveAs(new File([result], `model.${action.value}`, { type: "text/plain;charset=utf-8" }));
    } catch (error) {
      setOutput({ label: "Export failed", result: error.message });
    }
  }

  async function toggleView(option) {
    if (!isLoaded) return;
    const currentValidation = await ensureValidated();
    if (!currentValidation?.valid) {
      const messages = {
        graph: "The model is not valid. Fix syntax errors before visualizing.",
        configurator: "The model is not valid. Fix syntax errors before configuring.",
        configdist: "The model is not valid. Fix syntax errors before computing distribution.",
        fip: "The model is not valid. Fix syntax errors before computing probabilities.",
        ffm: "The model is not valid. Fix syntax errors before computing the feature flow map.",
      };
      setOutput({ label: option.label, result: messages[option.value] ?? "The model is not valid." });
      return;
    }

    if (option.value === "configurator") setShowConfiguratorPanel(true);

    if (option.value === "graph") {
      setCurrentView("graph");
      call("getFeatureTree").then((result) => setFeatureTree(result)).catch(() => {});
      return;
    }

    if (option.value === "configdist") {
      setCurrentView("configdist");
      setConfigDistData(null);
      setIsRunning(true);
      setOutput({ label: "Configuration Distribution", result: "Computing..." });
      try {
        const result = await call("getConfigurationDistribution");
        setConfigDistData(result);
        setOutput({ label: "Configuration Distribution", result: "Done" });
      } catch (error) {
        setOutput({ label: "Configuration Distribution Error", result: error.message });
      }
      setIsRunning(false);
      return;
    }

    if (option.value === "fip") {
      setCurrentView("fip");
      setFipData(null);
      setIsRunning(true);
      setOutput({ label: "Feature Inclusion Probability", result: "Computing..." });
      try {
        const result = await call("getFeatureInclusionProbabilities");
        setFipData(result);
        setOutput({ label: "Feature Inclusion Probability", result: "Done" });
      } catch (error) {
        setOutput({ label: "Feature Inclusion Probability Error", result: error.message });
      }
      setIsRunning(false);
      return;
    }

    if (option.value === "ffm") {
      try {
        const attrs = await call("getNumericalAttributes");
        setNumericalAttributesSelection(attrs);
        setIsAttrSelectionModalOpen(true);
      } catch (error) {
        setOutput({ label: "Attribute extraction error", result: error.message });
      }
      return;
    }

    setCurrentView(option.value);
  }

  // Browsers and intermediaries start rejecting URLs in the low tens of KB;
  // stay safely below that when embedding the whole model in a link.
  const MAX_SHARE_URL_LENGTH = 8000;

  async function handleSaveToUVLHub() {
    const currentValidation = await ensureValidated();
    if (!currentValidation?.valid) {
      setUvlhubMessage("Model must be valid");
      setTimeout(() => setUvlhubMessage(""), 2000);
      return;
    }
    const code = editorRef.current?.getValue() || "";
    const encoded = btoa(unescape(encodeURIComponent(code)));
    if (encoded.length > MAX_SHARE_URL_LENGTH) {
      setUvlhubMessage("Model too large to send as a link");
      setTimeout(() => setUvlhubMessage(""), 3000);
      return;
    }
    const rawEndpoint = new URL("/raw/model.uvl", window.location.href);
    rawEndpoint.searchParams.set("model", encoded);
    const uvlhubBase = import.meta.env.VITE_UVLHUB_URL || "https://www.uvlhub.io";
    const uvlhubUrl = new URL("/dataset/import/", uvlhubBase);
    uvlhubUrl.searchParams.set("import", rawEndpoint.toString());
    window.open(uvlhubUrl.toString(), "_blank", "noopener,noreferrer");
  }

  async function handleCopyModelLink() {
    const code = editorRef.current?.getValue() || "";
    const encoded = btoa(unescape(encodeURIComponent(code)));
    if (encoded.length > MAX_SHARE_URL_LENGTH) {
      setShareMessage("Model too large to share as a link");
      setTimeout(() => setShareMessage(""), 3000);
      return;
    }
    const url = new URL("/editor", window.location.href);
    url.searchParams.set("model", encoded);
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareMessage("Link copied!");
    } catch {
      setShareMessage("Unable to copy");
    }
    setTimeout(() => setShareMessage(""), 2000);
  }

  async function handleCopySessionLink() {
    if (!collabEnabled || !docIdFromQuery) return;
    const url = new URL(window.location.href);
    url.searchParams.set("doc", docIdFromQuery);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopyMessage("Session link copied");
    } catch {
      setCopyMessage("Unable to copy link");
    }
    setTimeout(() => setCopyMessage(""), 2000);
  }

  const generateDocId = useCallback(() => {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }, []);

  async function checkCollabHealth() {
    try {
      const wsUrl = new URL(collabEndpoint);
      const healthUrl = new URL(wsUrl);
      healthUrl.protocol = wsUrl.protocol === "wss:" ? "https:" : "http:";
      // Append /health to the endpoint path so it works for both a same-origin
      // proxied endpoint (…/collab -> …/collab/health) and a bare host:port one.
      healthUrl.pathname = `${wsUrl.pathname.replace(/\/+$/, "")}/health`;
      const res = await fetch(healthUrl.toString(), { mode: "cors" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function handleStartCollab() {
    if (!collabFeatureAvailable) {
      setCollabStatus("Enable VITE_ENABLE_COLLAB=true to use collaboration.");
      return;
    }
    const warning =
      "This feature relies on a backend server. Your file will no longer be sandboxed to this machine. Continue?";
    if (!window.confirm(warning)) { setCollabStatus(""); return; }
    setCollabStatus("Checking collaboration backend…");
    if (!(await checkCollabHealth())) {
      setCollabStatus("Collaboration backend is not responding.");
      return;
    }
    setInitialContent(editorRef.current?.getValue() || initialContent || "");
    const newDocId = generateDocId();
    const nextSearch = new URLSearchParams(location.search);
    nextSearch.set("doc", newDocId);
    navigate({ pathname: location.pathname, search: nextSearch.toString() });
    setCollabStatus("Session created. Share the link to collaborate.");
  }

  function handleAttributeSelection(attribute, isChecked) {
    setOptimizationGoals((prev) => ({
      ...prev,
      [attribute]: { selected: isChecked, goal: prev[attribute]?.goal || "Minimize" },
    }));
  }

  function handleGoalChange(attribute, newGoal) {
    setOptimizationGoals((prev) => ({ ...prev, [attribute]: { ...prev[attribute], goal: newGoal } }));
  }

  function executeOptimization() {
    const selectedGoals = Object.entries(optimizationGoals)
      .filter(([, data]) => data.selected)
      .map(([attribute, data]) => ({ attribute, goal: data.goal }));
    if (selectedGoals.length === 0) {
      setOutput({ label: "Optimization Error", result: "No attributes selected for optimization." });
      return;
    }
    setIsRunning(true);
    setOutput({ label: "Attribute Optimization", result: "Executing operation" });
    setCurrentView("paretofront");
    call("executeAttributeOptimization", { goals: selectedGoals, backend: attrOptBackend })
      .then((result) => {
        setOutput({ label: result.label, result: result.result.results_str });
        setParetoFrontData(result.result);
      })
      .catch((error) => setOutput({ label: "Attribute Optimization", result: describeError(error) }))
      .finally(() => setIsRunning(false));
    closeAttrOptModal();
  }

  function closeAttrOptModal() {
    setIsAttrOptModalOpen(false);
    setOptimizationGoals({});
  }

  function closeAttrSelectionModal() {
    setIsAttrSelectionModalOpen(false);
    setNumericalAttributesSelection(null);
  }

  function executeFlowMap() {
    setCurrentView("ffm");
    setIsRunning(true);
    setOutput({ label: "Feature Flow Map", result: "Executing operation" });
    call("getFeatureFlowMap", selectedAttribute)
      .then((result) => {
        setOutput(result);
        setFfmData(result);
      })
      .catch((error) => setOutput({ label: "Feature Flow Map", result: describeError(error) }))
      .finally(() => setIsRunning(false));
    closeAttrSelectionModal();
  }

  // VSCode-style editor tabs: base views + metrics, plus a dynamic tab for the
  // configurator / pareto-front views while they are the active view.
  const editorTabs = useMemo(() => {
    const tabs = [...viewOptions, ...metricsOptions];
    const dynamic = { configurator: "Configurator", paretofront: "Pareto Front" };
    if (dynamic[currentView] && !tabs.some((t) => t.value === currentView)) {
      tabs.push({ label: dynamic[currentView], value: currentView });
    }
    return tabs;
  }, [viewOptions, metricsOptions, currentView]);

  // Status-bar backend control toggles between in-browser WASM and the remote API
  // (selectBackend opens the settings modal when switching to REST).
  const toggleComputeBackend = useCallback(
    () => selectBackend(computeBackend === WASM ? REST : WASM),
    [computeBackend, selectBackend]
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-surface dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <TitleBar darkMode={darkMode} toggleDark={toggleDark} />

      <ActionToolbar
        structuralOptions={structuralOptions}
        executeAction={executeAction}
        solverOptions={solverOptions}
        selectedSolver={selectedSolver}
        setSelectedSolver={setSelectedSolver}
        analysisOptions={analysisOptions}
        exportOptions={EXPORT_OPERATIONS}
        downloadFile={downloadFile}
        onShareLink={handleCopyModelLink}
        shareMessage={shareMessage}
        onUvlhub={handleSaveToUVLHub}
        uvlhubMessage={uvlhubMessage}
        collab={{
          enabled: collabEnabled,
          available: collabFeatureAvailable,
          onCopySession: handleCopySessionLink,
          copyMessage,
          onStart: handleStartCollab,
          status: collabStatus,
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar
          sidebarOpen={showConfiguratorPanel}
          onToggleSidebar={() => setShowConfiguratorPanel((o) => !o)}
          modelInfoOpen={modelInfoOpen}
          onToggleModelInfo={() => setModelInfoOpen((o) => !o)}
          onOpenBackend={() => setIsBackendModalOpen(true)}
          onOpenPlugins={() => setIsPluginModalOpen(true)}
        />

        {showConfiguratorPanel && (
          <TreeView
            treeData={featureTree}
            executeAction={executeActionWithConf}
            operations={CONFIG_OPERATIONS}
            history={history}
          />
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <EditorTabs tabs={editorTabs} currentView={currentView} onSelect={toggleView} />

          <div className="flex flex-1 flex-col overflow-hidden relative">
            <UVLEditor
              editorRef={editorRef}
              validateModel={validateModel}
              defaultCode={initialContent}
              hide={currentView !== "source"}
              collabConfig={collabConfig}
              onEditorMount={() => setIsEditorReady(true)}
              darkMode={darkMode}
            />
            {currentView === "graph" && (
              <FeatureModelVisualization treeData={featureTree} constraints={constraints} />
            )}
            {currentView === "configdist" && (
              <div className="flex-1 overflow-auto">
                <ErrorBoundary>
                  <ProductDistributionChart data={configDistData} />
                </ErrorBoundary>
              </div>
            )}
            {currentView === "fip" && (
              <div className="flex-1 overflow-auto">
                <ErrorBoundary>
                  <FeatureInclusionProbabilitiesChart data={fipData} />
                </ErrorBoundary>
              </div>
            )}
            {currentView === "ffm" && (
              <div className="flex-1 overflow-auto">
                <ErrorBoundary>
                  <FeatureFlowMap data={ffmData} />
                </ErrorBoundary>
              </div>
            )}
            {currentView === "paretofront" && (
              <div className="flex-1 overflow-auto">
                <ErrorBoundary>
                  <ParetoFrontChart data={paretoFrontData} />
                </ErrorBoundary>
              </div>
            )}
            {currentView === "configurator" && (
              <Wizard call={call} setHistory={setHistory} />
            )}
          </div>

          <BottomPanel
            panelTab={panelTab}
            setPanelTab={setPanelTab}
            output={output}
            validation={validation}
            isAwaiting={isRunning || !isImported || !isLoaded}
            handleResize={handleResize}
            handleStop={interruptExecution}
          />
        </div>

        {modelInfoOpen && (
          <ModelInformation
            onValidateModel={handleValidateClick}
            validation={validation}
            modelInfo={modelInfo}
          />
        )}
      </div>

      <StatusBar
        isLoaded={isLoaded}
        isAwaiting={isRunning || !isImported || !isLoaded}
        validation={validation}
        onShowProblems={() => setPanelTab("problems")}
        computeBackend={computeBackend}
        WASM={WASM}
        onToggleBackend={toggleComputeBackend}
        restApiUrl={restApiUrl}
        selectedSolver={selectedSolver}
      />

      {isAttrOptModalOpen && (
        <AttributeOptimizationModal
          attributes={numericalAttributes}
          goals={optimizationGoals}
          onToggle={handleAttributeSelection}
          onGoalChange={handleGoalChange}
          onExecute={executeOptimization}
          onCancel={closeAttrOptModal}
        />
      )}
      {isAttrSelectionModalOpen && (
        <AttributeSelectionModal
          attributes={numericalAttributesSelection}
          selected={selectedAttribute}
          onSelect={setSelectedAttribute}
          onConfirm={executeFlowMap}
          onCancel={closeAttrSelectionModal}
        />
      )}
      {inputModal && (
        <OperationInputModal
          action={inputModal.action}
          options={inputModal.options}
          onConfirm={confirmInputOperation}
          onCancel={() => setInputModal(null)}
        />
      )}
      {isBackendModalOpen && (
        <BackendSettingsModal
          url={restApiUrl}
          onSave={(url) => {
            setRestApiUrl(url);
            saveRestUrl(url);
            setIsBackendModalOpen(false);
          }}
          onCancel={() => setIsBackendModalOpen(false)}
        />
      )}
      {isPluginModalOpen && (
        <PluginManagerModal
          installedBackends={installedBackends(pluginCatalog)}
          onInstall={handleInstallPlugin}
          onClose={() => setIsPluginModalOpen(false)}
        />
      )}
    </div>
  );
}

export default EditorPage;
