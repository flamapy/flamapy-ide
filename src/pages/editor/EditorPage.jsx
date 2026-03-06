/* eslint-disable react/prop-types */
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "react-resizable/css/styles.css";
import ModelInformation from "../../components/ModelInformation";
import ExecutionOutput from "../../components/ExecutionOutput";
import UVLEditor from "../../components/UVLEditor";
import DropdownMenu from "../../components/DropdownMenu";
import { saveAs } from "file-saver";
import TreeView from "../../components/FeatureTree";
import FeatureModelVisualization from "../../components/FeatureModelVisualization";
import Wizzard from "../../components/Wizzard";
import ProductDistributionChart from "../../components/ProductDistributionChart";
import FeatureInclusionProbabilitiesChart from "../../components/FeatureInclusionProbabilitiesChart";
import JSZip from "jszip";
import { useWorkerClient } from "../../hooks/useWorkerClient";

// Full operation lists per solver — shown only when that plugin is enabled
const ALL_SOLVER_OPERATIONS = {
  sat: [
    { label: "Configurations", value: "PySATConfigurations" },
    { label: "Number of configurations", value: "PySATConfigurationsNumber" },
    { label: "Dead features", value: "PySATDeadFeatures" },
    { label: "Diagnosis", value: "PySATDiagnosis" },
    { label: "False optional features", value: "PySATFalseOptionalFeatures" },
    { label: "Satisfiable", value: "PySATSatisfiable" },
  ],
  bdd: [
    { label: "Configurations", value: "BDDConfigurations" },
    { label: "Number of configurations", value: "BDDConfigurationsNumber" },
    { label: "Dead features", value: "BDDDeadFeatures" },
    { label: "Satisfiable", value: "BDDSatisfiable" },
    { label: "Configuration distribution", value: "BDDProductDistribution" },
    { label: "Feature inclusion probability", value: "BDDFeatureInclusionProbability" },
    { label: "Unique features", value: "BDDUniqueFeatures" },
    { label: "Homogeneity", value: "BDDHomogeneity" },
    { label: "Variability", value: "BDDVariability" },
    { label: "Variant features", value: "BDDVariantFeatures" },
  ],
  z3: [
    { label: "Satisfiable", value: "Z3Satisfiable" },
    { label: "Configurations", value: "Z3Configurations" },
    { label: "Number of configurations", value: "Z3ConfigurationsNumber" },
    { label: "Core features", value: "Z3CoreFeatures" },
    { label: "Dead features", value: "Z3DeadFeatures" },
    { label: "False-optional features", value: "Z3FalseOptionalFeatures" },
    { label: "Attribute optimization", value: "Z3AttributeOptimization" },
  ],
};

const EXPORT_OPERATIONS = [
  { label: "AFM", value: "afm" },
  { label: "Glencoe", value: "gfm.json" },
  { label: "JSON", value: "json" },
  { label: "SPLOT", value: "sxfm" },
  { label: "Download UVL", value: "uvl" },
];

function EditorPage({ selectedFile, setNavControls }) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const docIdFromQuery = searchParams.get("doc");
  const collabFeatureAvailable = import.meta.env.VITE_ENABLE_COLLAB === "true";
  const collabEnabled = collabFeatureAvailable && !!docIdFromQuery;
  const collabEndpoint = import.meta.env.VITE_COLLAB_URL || "ws://localhost:1234";
  const collabConfig = collabEnabled
    ? { enabled: true, docId: docIdFromQuery, endpoint: collabEndpoint }
    : { enabled: false };

  const { isLoaded, pluginsConfig, call, restart } = useWorkerClient();

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
  const [collabStatus, setCollabStatus] = useState("");
  const [initialContent, setInitialContent] = useState("");
  const [featureTree, setFeatureTree] = useState(null);
  const [currentView, setCurrentView] = useState("source");
  const [constraints, setConstraints] = useState(null);
  const [history, setHistory] = useState(null);
  const [showConfiguratorPanel, setShowConfiguratorPanel] = useState(true);

  // Plugin config synced from worker on load
  const [enabledPlugins, setEnabledPlugins] = useState({ sat: true, bdd: true, z3: false });

  // Z3 attribute optimization modal state
  const [isAttrOptModalOpen, setIsAttrOptModalOpen] = useState(false);
  const [numericalAttributes, setNumericalAttributes] = useState(null);
  const [optimizationGoals, setOptimizationGoals] = useState({});

  // Chart data state
  const [configDistData, setConfigDistData] = useState(null);
  const [fipData, setFipData] = useState(null);

  const [selectedSolver, setSelectedSolver] = useState("sat");
  const editorRef = useRef(null);

  // Sync enabled plugins from worker config
  useEffect(() => {
    if (pluginsConfig?.plugins) {
      const enabled = {};
      for (const [key, val] of Object.entries(pluginsConfig.plugins)) {
        enabled[key] = val.enabled;
      }
      setEnabledPlugins(enabled);
    }
  }, [pluginsConfig]);

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

  // Restore saved editor content from localStorage when no file is being imported
  useEffect(() => {
    if (isLoaded && isEditorReady && !selectedFile) {
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
    ];
  }, [enabledPlugins.bdd]);

  // Reset to source if current view becomes unavailable (e.g. BDD disabled)
  useEffect(() => {
    if (!enabledPlugins.bdd && (currentView === "configdist" || currentView === "fip")) {
      setCurrentView("source");
    }
  }, [enabledPlugins.bdd, currentView]);

  // Derived solver tabs — only enabled plugins
  const solverOptions = useMemo(
    () =>
      Object.entries(enabledPlugins)
        .filter(([, enabled]) => enabled)
        .map(([key]) => ({ label: key.toUpperCase(), value: key })),
    [enabledPlugins]
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

  // eslint-disable-next-line no-unused-vars
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
        setValidation(result);
        setConstraints(getConstraints(code));
        return result;
      })
      .catch(() => {
        setOutput({
          label: "Validation error",
          result: "An exception occurred validating the model. Try restarting Flamapy.",
        });
        return null;
      });
  }

  async function executeAction(action) {
    if (!isLoaded) return;
    const currentValidation = validation ?? await validateModel();
    if (!currentValidation?.valid) {
      setOutput({ label: action.label, result: "Error: the model is not valid. Fix syntax errors and retry." });
      return;
    }

    if (action.value === "Z3AttributeOptimization") {
      try {
        const attrs = await call("getNumericalAttributes");
        setNumericalAttributes(attrs);
        setIsAttrOptModalOpen(true);
      } catch (error) {
        setOutput({ label: "Attribute extraction error", result: error.message });
      }
      return;
    }

    setIsRunning(true);
    setOutput({ label: action.label, result: "Executing operation" });
    try {
      const result = await call("executeAction", action);
      result.result = JSON.parse(result.result);
      setOutput(result);
    } catch {
      setOutput({ label: action.label, result: "An exception occurred. Check the model definition." });
    }
    setIsRunning(false);
  }

  async function executeActionWithConf(action, configuration) {
    if (!isLoaded) return;
    const currentValidation = validation ?? await validateModel();
    if (!currentValidation?.valid) {
      setOutput({ label: action.label, result: "Error: the model is not valid. Fix syntax errors and retry." });
      return;
    }

    if (action.isOperationWithConf) {
      setIsRunning(true);
      setOutput({ label: action.label, result: "Executing operation" });
      try {
        const result = await call("executeActionWithConf", { action, configuration });
        setOutput(result);
      } catch {
        setOutput({ label: action.label, result: "An exception occurred. Check the model definition." });
      }
      setIsRunning(false);
    } else if (action.value === "configurator") {
      toggleView(action);
    } else if (action.value === "downloadConfigurator") {
      const zip = new JSZip();
      try {
        const response = await fetch("/assets/flamapy.conf.zip");
        if (!response.ok) throw new Error("Failed to load base.zip");
        const baseZip = await JSZip.loadAsync(await (await response.blob()).arrayBuffer());
        baseZip.forEach((relativePath, file) => zip.file(relativePath, file.async("arraybuffer")));
        const featureModel = new File([editorRef.current.getValue()], "FeatureModel.uvl", { type: "text/plain" });
        zip.file(`models/${featureModel.name}`, featureModel);
        saveAs(await zip.generateAsync({ type: "blob" }), "configurator.zip");
      } catch (err) {
        console.error("Error processing ZIP:", err);
        alert("Failed to generate ZIP.");
      }
    }
  }

  function interruptExecution() {
    if (isLoaded) {
      restart();
      setIsRunning(false);
      setValidation(null);
      setOutput({ label: "Execution interrupted", result: "Re-starting Flamapy..." });
    }
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
    const currentValidation = validation ?? await validateModel();
    if (!currentValidation?.valid) {
      const messages = {
        graph: "The model is not valid. Fix syntax errors before visualizing.",
        configurator: "The model is not valid. Fix syntax errors before configuring.",
        configdist: "The model is not valid. Fix syntax errors before computing distribution.",
        fip: "The model is not valid. Fix syntax errors before computing probabilities.",
      };
      setOutput({ label: option.label, result: messages[option.value] ?? "The model is not valid." });
      return;
    }

    if (option.value === "configurator") setShowConfiguratorPanel(true);

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

    setCurrentView(option.value);
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
      healthUrl.pathname = "/health";
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
    call("executeAttributeOptimization", selectedGoals)
      .then((result) => setOutput(result))
      .catch(() => setOutput({ label: "Attribute Optimization", result: "An exception occurred. Check the model definition." }))
      .finally(() => setIsRunning(false));
    closeAttrOptModal();
  }

  function closeAttrOptModal() {
    setIsAttrOptModalOpen(false);
    setOptimizationGoals({});
  }

  // Navbar toolbar (injected via setNavControls)
  const toolbarContent = useMemo(() => {
    return (
      <div className="w-full flex justify-center">
        <div className="flex items-end gap-3 flex-nowrap overflow-x-auto overflow-visible px-3 py-1 bg-white/80 rounded shadow-sm">

          <div className="flex flex-col gap-1 whitespace-nowrap">
            <span className="text-[11px] text-gray-600 text-center w-full">View</span>
            <div className="h-px bg-gray-300 w-full" />
            <div className="flex items-stretch rounded overflow-hidden border border-gray-300">
              {viewOptions.map((option) => (
                <button
                  key={option.value}
                  className={`px-2.5 py-2 text-sm ${
                    currentView === option.value ? "bg-[#356C99] text-white" : "bg-white text-gray-700"
                  }`}
                  onClick={() => toggleView(option)}
                >
                  {option.label}
                </button>
              ))}
              {metricsOptions.length > 0 && (
                <DropdownMenu
                  buttonLabel="Metrics"
                  options={metricsOptions}
                  executeAction={toggleView}
                  className="bg-white text-gray-700 py-2 px-3 rounded-none shadow-none w-[100px] justify-between border-l border-gray-300"
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 whitespace-nowrap">
            <span className="text-[11px] text-gray-600 text-center w-full">Automated analysis</span>
            <div className="h-px bg-gray-300 w-full" />
            <div className="flex items-end gap-1">
              <div className="flex rounded overflow-hidden border border-gray-300">
                {solverOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`px-2.5 py-2 text-sm min-w-[60px] ${
                      selectedSolver === option.value ? "bg-[#356C99] text-white" : "bg-white text-gray-700"
                    }`}
                    onClick={() => setSelectedSolver(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex rounded overflow-hidden border border-gray-300">
                <DropdownMenu
                  buttonLabel="Analysis operation"
                  options={ALL_SOLVER_OPERATIONS[selectedSolver] ?? []}
                  executeAction={executeAction}
                  className="bg-white text-gray-700 py-2 px-3 rounded-none shadow-none w-[170px] justify-between"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 whitespace-nowrap">
            <span className="text-[11px] text-gray-600 text-center w-full">Export</span>
            <div className="h-px bg-gray-300 w-full" />
            <div className="flex rounded overflow-hidden border border-gray-300">
              <DropdownMenu
                buttonLabel="Export"
                options={EXPORT_OPERATIONS}
                executeAction={downloadFile}
                className="bg-white text-gray-700 py-2 px-3 rounded-none shadow-none w-[120px] justify-between"
              />
            </div>
          </div>

          {collabEnabled && (
            <div className="flex flex-col gap-1 whitespace-nowrap">
              <span className="text-[11px] text-gray-600 text-center w-full">Collaborate</span>
              <div className="h-px bg-gray-300 w-full" />
              <div className="flex items-end gap-1">
                <div className="flex rounded overflow-hidden border border-gray-300">
                  <button
                    className="px-2.5 py-2 text-sm bg-white text-gray-700 hover:bg-gray-100"
                    onClick={handleCopySessionLink}
                  >
                    Copy link
                  </button>
                </div>
                {copyMessage && <span className="text-xs text-gray-600">{copyMessage}</span>}
              </div>
            </div>
          )}
          {!collabEnabled && collabFeatureAvailable && (
            <div className="flex flex-col gap-1 whitespace-nowrap">
              <span className="text-[11px] text-gray-600 text-center w-full">Collaborate</span>
              <div className="h-px bg-gray-300 w-full" />
              <div className="flex items-end gap-1">
                <div className="flex rounded overflow-hidden border border-gray-300">
                  <button
                    className="px-2.5 py-2 text-sm bg-white text-gray-700 hover:bg-gray-100"
                    onClick={handleStartCollab}
                  >
                    Collaborate
                  </button>
                </div>
                {collabStatus && <span className="text-xs text-gray-600">{collabStatus}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabEnabled, collabFeatureAvailable, collabStatus, copyMessage, currentView, metricsOptions, selectedSolver, solverOptions, viewOptions]);

  useEffect(() => {
    if (setNavControls) {
      setNavControls(toolbarContent);
      return () => setNavControls(null);
    }
  }, [setNavControls, toolbarContent]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex flex-row flex-grow p-2 gap-2 overflow-hidden relative items-stretch">

        {showConfiguratorPanel && (
          <div className="relative h-full">
            <TreeView treeData={featureTree} executeAction={executeActionWithConf} history={history} />
            {currentView !== "configurator" && (
              <button
                className="absolute right-[-12px] top-1/2 -translate-y-1/2 bg-gray-300 text-gray-700 text-[10px] px-1 py-10 rounded-r shadow hover:bg-gray-400 rotate-180 [writing-mode:vertical-rl]"
                onClick={() => setShowConfiguratorPanel(false)}
              >
                Hide configuration panel
              </button>
            )}
          </div>
        )}
        {!showConfiguratorPanel && currentView !== "configurator" && (
          <button
            className="absolute left-0 top-1/2 -translate-y-1/2 bg-gray-300 text-gray-700 text-[10px] px-1 py-10 rounded-r shadow hover:bg-gray-400 z-40 rotate-180 [writing-mode:vertical-rl]"
            onClick={() => setShowConfiguratorPanel(true)}
          >
            Show configuration panel
          </button>
        )}

        <div className="flex flex-1 flex-col">
          <UVLEditor
            editorRef={editorRef}
            validateModel={validateModel}
            defaultCode={initialContent}
            hide={currentView !== "source"}
            collabConfig={collabConfig}
            onEditorMount={() => setIsEditorReady(true)}
          />
          {currentView === "graph" && (
            <FeatureModelVisualization treeData={featureTree} constraints={constraints} />
          )}
          {currentView === "configdist" && (
            <div className="flex-1 overflow-auto">
              <ProductDistributionChart data={configDistData} />
            </div>
          )}
          {currentView === "fip" && (
            <div className="flex-1 overflow-auto">
              <FeatureInclusionProbabilitiesChart data={fipData} />
            </div>
          )}
          {currentView === "configurator" && (
            <Wizzard call={call} setHistory={setHistory} />
          )}

          <ExecutionOutput
            handleResize={handleResize}
            handleStop={interruptExecution}
            isAwaiting={isRunning || !isImported || !isLoaded}
          >
            {output}
          </ExecutionOutput>
        </div>

        <ModelInformation onValidateModel={validateModel} validation={validation} />
      </div>

      {isAttrOptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Select Optimization Goals</h3>
            <div className="max-h-96 overflow-y-auto border border-gray-300 bg-gray-50 p-3 rounded">
              {numericalAttributes && numericalAttributes.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Optimize</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Attribute</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Goal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {numericalAttributes.map((attribute) => {
                      const isSelected = optimizationGoals[attribute]?.selected || false;
                      const goal = optimizationGoals[attribute]?.goal || "Minimize";
                      return (
                        <tr key={attribute}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleAttributeSelection(attribute, e.target.checked)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                            {attribute}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            <select
                              value={goal}
                              disabled={!isSelected}
                              onChange={(e) => handleGoalChange(attribute, e.target.value)}
                              className={`mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm sm:text-sm ${
                                !isSelected ? "bg-gray-200 text-gray-500" : "bg-white"
                              }`}
                            >
                              <option value="Minimize">Minimize</option>
                              <option value="Maximize">Maximize</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-red-500">No numerical attributes available in this model.</p>
              )}
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md hover:bg-gray-400"
                onClick={closeAttrOptModal}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700"
                onClick={executeOptimization}
              >
                Execute Optimization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditorPage;
