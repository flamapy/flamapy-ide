/* eslint-disable react/prop-types */
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import "react-resizable/css/styles.css";
import { saveAs } from "file-saver";
import TitleBar from "../components/layout/TitleBar";
import ActionToolbar from "../components/layout/ActionToolbar";
import ActivityBar from "../components/layout/ActivityBar";
import EditorTabs from "../components/layout/EditorTabs";
import BottomPanel from "../components/layout/BottomPanel";
import StatusBar from "../components/layout/StatusBar";
import { UVLEditor } from "@flamapy/web-ui";
import {
  WASM,
  REST,
  installedBackends,
  solverOptionsFromCatalog,
  structuralOperationsFromCatalog,
  analysisOperationsForSolver,
} from "@flamapy/web-core";
import {
  OPEN_BACKEND_SETTINGS,
} from "@flamapy/plugin-flamapy-engine";
import { createWorkbench } from "@flamapy/ide-plugin-api";
import { builtinPlugins } from "./builtinPlugins";
import { useContributionStore } from "./useContributionStore";
import { useEngine } from "./useEngine";
import { useShareLinks } from "./useShareLinks";
import { loadRememberedRemotePlugins, pluginEnablement } from "./remotePlugins";
import { createPluginsView, PLUGINS_VIEW_ID } from "./PluginsView";
import { withContributedItems } from "./menuContributions";
import {
  activePanel,
  loadLayout,
  movePanel,
  panelWidth,
  resizePanel,
  saveLayout,
  showPanel,
  sideOf,
  togglePanel,
} from "./sidePanels";
import { OperationForm, OperationResultView, needsAttributes, needsFeatures } from "./OperationUi";
import { useCollabSession } from "./useCollabSession";
import { ToolbarMenuSlot } from "./slots/ToolbarMenuSlot";
import { StatusBarSlot } from "./slots/StatusBarSlot";
import { SidebarSlot } from "./slots/SidebarSlot";
import { ViewOutlet } from "./slots/ViewOutlet";
import { ModalOutlet } from "./slots/ModalOutlet";

// The v3 workbench: owns the plugin host, the document, the chrome and the operation
// toolbar; everything else (analysis engine, views, configurator, diagram) is a plugin.
// The analysis/structural operation menus are derived at runtime from the plugin
// capability catalog the Pyodide bridge reports, so runtime-installed plugins surface
// without an IDE edit (derivations in @flamapy/web-core, services in the engine plugin).

const EXPORT_OPERATIONS = [
  { label: "AFM", value: "afm" },
  { label: "Glencoe", value: "gfm.json" },
  { label: "JSON", value: "json" },
  { label: "SPLOT", value: "sxfm" },
  { label: "Download UVL", value: "uvl" },
];

function Workbench({ selectedFile, darkMode, toggleDark }) {
  const workbenchRef = useRef(null);
  if (!workbenchRef.current) {
    const created = createWorkbench("", { host: { enablement: pluginEnablement } });
    // The shell's own Plugins view: a tab only while open (activity bar puzzle icon).
    created.stores.views.register({
      id: PLUGINS_VIEW_ID,
      title: "Plugins",
      dynamic: true,
      order: 1000,
      component: createPluginsView(created),
    });
    workbenchRef.current = created;
  }
  const workbench = workbenchRef.current;

  const [isRunning, setIsRunning] = useState(false);
  const [isImported, setIsImported] = useState(true);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [lastOutputHeight, setLastOutputHeight] = useState(150);
  const [output, setOutput] = useState({
    label: "Loading Flamapy...",
    result: selectedFile ? `Importing model '${selectedFile.name}'` : "FlamapyIDE is starting",
  });
  const [initialContent, setInitialContent] = useState("");
  // Model metrics (right panel) — fetched separately from validation because
  // some metrics are full analyses and must not run on every (debounced) keystroke.
  const [currentView, setCurrentView] = useState("source");
  // Side panels contributed by plugins: which one each side shows, sides moved by the
  // user and widths, remembered across sessions (see sidePanels.ts).
  const sidePanels = useContributionStore(workbench.stores.sidebarPanels);
  const [panelLayout, setPanelLayout] = useState(loadLayout);
  const updatePanelLayout = useCallback((change) => {
    setPanelLayout((layout) => {
      const next = change(layout);
      saveLayout(next);
      return next;
    });
  }, []);
  workbench.delegates.showSidebarPanel = (id) => {
    const panel = workbench.stores.sidebarPanels.get(id);
    if (panel) updatePanelLayout((layout) => showPanel(layout, panel));
  };
  const [panelTab, setPanelTab] = useState("output");

  // Operation input form ({ title, inputs, choices, resolve } while open, else null)
  const [inputModal, setInputModal] = useState(null);
  // AbortController of the plugin operation running now (Stop aborts it).
  const pluginRunRef = useRef(null);

  const [pluginModals, setPluginModals] = useState([]);
  const nextModalKeyRef = useRef(0);
  const currentViewRef = useRef("source");
  currentViewRef.current = currentView;
  const editorRef = useRef(null);

  // Delegates capture the freshest state each render (plugins call through them).
  workbench.delegates.showOutput = (label, result) => setOutput({ label, result });
  workbench.delegates.openModal = (render) => {
    const key = nextModalKeyRef.current++;
    setPluginModals((open) => [...open, { key, render }]);
  };
  workbench.delegates.setActiveView = (id) => setCurrentView(id);
  workbench.delegates.getActiveView = () => currentViewRef.current;

  const closePluginModal = useCallback(
    (key) => setPluginModals((open) => open.filter((modal) => modal.key !== key)),
    []
  );

  // Activate the built-in plugins once (the engine among them), then any remembered
  // remote plugins (no-op unless the experimental flag is on). Teardown is deferred a
  // tick: React StrictMode's dev-only unmount/remount runs cleanup and setup back to
  // back, and must neither re-register the plugins nor deactivate them in between.
  const activationRef = useRef({ started: false, teardown: null });
  useEffect(() => {
    const activation = activationRef.current;
    clearTimeout(activation.teardown);
    if (!activation.started) {
      activation.started = true;
      for (const plugin of builtinPlugins) {
        workbench.host.register(plugin);
      }
      workbench.host.activateAll().then(() => loadRememberedRemotePlugins(workbench));
    }
    return () => {
      activation.teardown = setTimeout(() => workbench.host.deactivateAll(), 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const engine = useEngine(workbench);
  const { isLoaded, pluginCatalog, validation, restApiUrl, selectedSolver } = engine;
  const computeBackend = engine.computeBackend ?? WASM;

  const call = useCallback(
    (action, data) => {
      if (!engine.services) return Promise.reject(new Error("Engine not ready"));
      return engine.services.worker.call(action, data);
    },
    [engine.services]
  );

  async function ensureValidated() {
    if (!engine.services) return null;
    return engine.services.analysis.ensureValidated();
  }

  const { collabConfig, collab, searchParams } = useCollabSession({
    onBeforeStart: () =>
      setInitialContent(editorRef.current?.getValue() || initialContent || ""),
  });
  const shareLinks = useShareLinks({
    getText: () => editorRef.current?.getValue() || "",
    ensureValidated,
  });

  // Contributed views become tabs; plugins can observe the active view.
  const contributedViews = useContributionStore(workbench.stores.views);
  useEffect(() => {
    workbench.notifyActiveViewChanged(currentView);
  }, [workbench, currentView]);

  // Non-'editor' document writes (imports, diagram edits) land in monaco. Monaco's own
  // changes flow the other way via UVLEditor's onContentChange below.
  useEffect(() => {
    const subscription = workbench.documents.onDidChange(({ text, origin }) => {
      if (origin === "editor") return;
      const editor = editorRef.current;
      if (editor && editor.getValue() !== text) {
        editor.setValue(text);
      }
    });
    return () => subscription.dispose();
  }, [workbench]);

  // Which solver backends are installed, derived from the capability catalog the
  // worker reports (updated live when a plugin is installed at runtime).
  const enabledPlugins = useMemo(() => {
    if (!pluginCatalog) return { sat: true, bdd: true, z3: true };
    const enabled = {};
    for (const backend of installedBackends(pluginCatalog)) enabled[backend] = true;
    return enabled;
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

  // Items plugins added to the built-in menus, listed after the built-in ones under the
  // contributing plugin's name.
  const contributedItems = useContributionStore(workbench.stores.menuItems);
  const contributedOperations = useContributionStore(workbench.stores.operations);
  const menuItems = useMemo(
    () => [
      ...contributedItems,
      ...contributedOperations.map((operation) => ({ ...operation, operation })),
    ],
    [contributedItems, contributedOperations]
  );
  const pluginName = useCallback(
    (pluginId) => workbench.host.get(pluginId)?.plugin.manifest.name ?? pluginId ?? "Plugins",
    [workbench]
  );
  const structuralMenu = useMemo(
    () => withContributedItems(structuralOptions, menuItems, "structural", { pluginName }),
    [structuralOptions, menuItems, pluginName]
  );
  const analysisMenu = useMemo(
    () => withContributedItems(analysisOptions, menuItems, "analysis", { pluginName, selectedSolver }),
    [analysisOptions, menuItems, pluginName, selectedSolver]
  );
  const exportMenu = useMemo(
    () => withContributedItems(EXPORT_OPERATIONS, menuItems, "export", { pluginName }),
    [menuItems, pluginName]
  );

  const setSelectedSolver = useCallback(
    (solver) => engine.services?.analysis.setSelectedSolver(solver),
    [engine.services]
  );

  // Keep selectedSolver valid after config loads
  useEffect(() => {
    if (!enabledPlugins[selectedSolver]) {
      const first = Object.entries(enabledPlugins).find(([, v]) => v);
      if (first) setSelectedSolver(first[0]);
    }
  }, [enabledPlugins, selectedSolver, setSelectedSolver]);

  // Import the launch file once worker and editor are both ready. UVL loads directly;
  // other formats go through the worker's importModel (fileHandlers registry pending —
  // today the engine's Python bridge handles every known extension).
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

  const handleResize = (e, data) => {
    e.preventDefault();
    if (data.size.height !== lastOutputHeight) {
      editorRef.current.layout({});
      setLastOutputHeight(data.size.height);
    }
  };

  // Shell-side validation wrapper: persist the content (document concerns), then let the
  // engine validate the document text. The engine tracks staleness by document version.
  function validateModel() {
    if (!isLoaded || !engine.services) return Promise.resolve(null);
    const code = editorRef.current.getValue();
    setInitialContent(code);
    if (!collabConfig.enabled) {
      localStorage.setItem("flamapy-ide-content", code);
    }
    return engine.services.analysis.validateNow();
  }

  // A plugin's menu item runs its own handler; a plugin operation runs through the
  // shell (inputs form, progress, Stop, result). Errors land in the output panel.
  function orContributed(handler) {
    return async (action) => {
      const item = action.contributedItem;
      if (!item) return handler(action);
      if (item.operation) return runContributedOperation(item.operation);
      try {
        await item.run();
      } catch (error) {
        setOutput({ label: item.label, result: `Error: ${error?.message ?? error}` });
      }
    };
  }

  // Shows the input form for `inputs` (feature/attribute pickers filled from the model)
  // and resolves with the typed args, or null when cancelled.
  async function collectInputs(title, inputs) {
    const choices = { features: [], attributes: [] };
    try {
      if (needsFeatures(inputs)) choices.features = (await call("getFeatures")) ?? [];
      if (needsAttributes(inputs)) choices.attributes = (await call("getNumericalAttributes")) ?? [];
    } catch (error) {
      setOutput({ label: title, result: error.message });
      return null;
    }
    return new Promise((resolve) => setInputModal({ title, inputs, choices, resolve }));
  }

  function closeInputModal(args) {
    inputModal?.resolve(args);
    setInputModal(null);
  }

  async function runContributedOperation(operation) {
    if (!isLoaded || isRunning) return;
    if (operation.requiresValidModel !== false) {
      const currentValidation = await ensureValidated();
      if (!currentValidation?.valid) {
        setOutput({ label: operation.label, result: "Error: the model is not valid. Fix syntax errors and retry." });
        return;
      }
    }
    let args = {};
    if (operation.inputs?.length) {
      args = await collectInputs(operation.label, operation.inputs);
      if (!args) return;
    }
    const controller = new AbortController();
    pluginRunRef.current = controller;
    setIsRunning(true);
    setOutput({ label: operation.label, result: "Running…" });
    const progress = ({ message, fraction }) => {
      if (controller.signal.aborted) return;
      const percent = fraction === undefined ? "" : ` (${Math.round(fraction * 100)}%)`;
      setOutput({ label: operation.label, result: `${message ?? "Running…"}${percent}` });
    };
    try {
      const result = await operation.run(args, { signal: controller.signal, progress });
      if (controller.signal.aborted) {
        setOutput({ label: operation.label, result: "Operation stopped." });
      } else if (result) {
        setOutput({ label: operation.label, result: "", view: <OperationResultView result={result} /> });
      } else {
        setOutput({ label: operation.label, result: "Done." });
      }
    } catch (error) {
      setOutput({
        label: operation.label,
        result: controller.signal.aborted ? "Operation stopped." : `Error: ${error?.message ?? error}`,
      });
    } finally {
      pluginRunRef.current = null;
      setIsRunning(false);
    }
  }

  async function executeAction(action) {
    if (!isLoaded) return;
    const currentValidation = await ensureValidated();
    if (!currentValidation?.valid) {
      setOutput({ label: action.label, result: "Error: the model is not valid. Fix syntax errors and retry." });
      return;
    }

    if (action.inputs?.length) {
      // The operation takes arguments: collect them with the input form, then run.
      const args = await collectInputs(action.label, action.inputs);
      if (!args) return;
      runOperation({ ...action, args: { ...(action.args || {}), ...args } });
      return;
    }

    runOperation(action);
  }

  async function runOperation(action) {
    const { analysis } = engine.services;
    setIsRunning(true);
    setOutput({ label: action.label, result: "Executing operation" });
    try {
      const result = await analysis.runOperation(action);
      setOutput({ label: action.label, result });
    } catch (error) {
      setOutput({ label: action.label, result: analysis.describeError(error) });
    }
    setIsRunning(false);
  }

  function interruptExecution() {
    // A plugin operation: abort its signal (the plugin stops its own work).
    if (pluginRunRef.current) {
      pluginRunRef.current.abort();
      setOutput({ label: "Execution interrupted", result: "Stopping the running operation…" });
      return;
    }
    if (!isLoaded || !engine.services) return;
    const { worker } = engine.services;
    // Fast path: raise KeyboardInterrupt inside the running Python operation
    // (needs cross-origin isolation). The pending call rejects and is shown as
    // "Operation interrupted." — Flamapy itself stays loaded.
    if (worker.interrupt()) {
      setOutput({ label: "Execution interrupted", result: "Stopping the running operation…" });
      return;
    }
    // Fallback (no SharedArrayBuffer): tear down and reload the whole runtime.
    worker.restart();
    setIsRunning(false);
    setOutput({ label: "Execution interrupted", result: "Re-starting Flamapy..." });
  }

  async function downloadFile(action) {
    if (!isLoaded) return;
    try {
      const result = await engine.services.analysis.exportModel(action.value);
      saveAs(new File([result], `model.${action.value}`, { type: "text/plain;charset=utf-8" }));
    } catch (error) {
      setOutput({ label: "Export failed", result: error.message });
    }
  }

  // Tabs: the built-in source view plus every contributed view (dynamic ones only
  // while active). Contributed tabs open through the shell (onBeforeOpen guard).
  const editorTabs = useMemo(() => {
    const tabs = [{ label: "Source", value: "source" }];
    for (const view of contributedViews) {
      if (!view.dynamic || view.id === currentView) {
        tabs.push({ label: view.title, value: view.id, contributed: true });
      }
    }
    return tabs;
  }, [contributedViews, currentView]);

  const selectTab = useCallback(
    (tab) => {
      if (tab.contributed) {
        workbench.shell.views.open(tab.value);
      } else {
        setCurrentView(tab.value);
      }
    },
    [workbench]
  );

  // Status-bar backend control toggles between in-browser WASM and the remote API
  // (switching to REST opens the engine's settings modal via its command).
  const toggleComputeBackend = useCallback(() => {
    if (!engine.services) return;
    const next = computeBackend === WASM ? REST : WASM;
    engine.services.analysis.setComputeBackend(next);
    if (next === REST) workbench.shell.commands.execute(OPEN_BACKEND_SETTINGS);
  }, [computeBackend, engine.services, workbench]);

  // The panel a side shows, in the shell's frame (header, move, close, resize).
  function sidePanelSlot(side) {
    const panel = activePanel(sidePanels, panelLayout, side);
    return (
      <SidebarSlot
        key={side}
        panel={panel}
        side={side}
        width={panel ? panelWidth(panelLayout, panel) : 0}
        onClose={(closing) => updatePanelLayout((layout) => togglePanel(layout, sidePanels, closing))}
        onMove={(moving) => updatePanelLayout((layout) => movePanel(layout, sidePanels, moving))}
        onResize={(resized, width) => updatePanelLayout((layout) => resizePanel(layout, resized, width))}
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-surface dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <TitleBar darkMode={darkMode} toggleDark={toggleDark} />

      <ActionToolbar
        structuralOptions={structuralMenu}
        executeAction={orContributed(executeAction)}
        solverOptions={solverOptions}
        selectedSolver={selectedSolver}
        setSelectedSolver={setSelectedSolver}
        analysisOptions={analysisMenu}
        exportOptions={exportMenu}
        downloadFile={orContributed(downloadFile)}
        onShareLink={shareLinks.handleCopyModelLink}
        shareMessage={shareLinks.shareMessage}
        onUvlhub={shareLinks.handleSaveToUVLHub}
        uvlhubMessage={shareLinks.uvlhubMessage}
        collab={collab}
      >
        <ToolbarMenuSlot store={workbench.stores.toolbarMenus} pluginName={pluginName} />
      </ActionToolbar>

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar
          panels={sidePanels.map((panel) => ({
            id: panel.id,
            title: panel.title,
            icon: panel.icon,
            side: sideOf(panel, panelLayout),
            active: activePanel(sidePanels, panelLayout, sideOf(panel, panelLayout))?.id === panel.id,
          }))}
          onTogglePanel={(id) =>
            updatePanelLayout((layout) =>
              togglePanel(layout, sidePanels, sidePanels.find((panel) => panel.id === id))
            )
          }
          onOpenBackend={() => workbench.shell.commands.execute(OPEN_BACKEND_SETTINGS)}
          pluginsOpen={currentView === PLUGINS_VIEW_ID}
          onOpenPlugins={() => workbench.shell.views.open(PLUGINS_VIEW_ID)}
        />

        {sidePanelSlot("left")}

        <div className="flex flex-1 flex-col overflow-hidden">
          <EditorTabs tabs={editorTabs} currentView={currentView} onSelect={selectTab} />

          <div className="flex flex-1 flex-col overflow-hidden relative">
            <UVLEditor
              editorRef={editorRef}
              validateModel={validateModel}
              defaultCode={initialContent}
              hide={currentView !== "source"}
              collabConfig={collabConfig}
              onEditorMount={() => setIsEditorReady(true)}
              onContentChange={(text) => workbench.documents.setText(text, "editor")}
              darkMode={darkMode}
            />
            <ViewOutlet store={workbench.stores.views} activeViewId={currentView} />
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

        {sidePanelSlot("right")}
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
        extraLeft={<StatusBarSlot store={workbench.stores.statusBarItems} side="left" />}
        extraRight={<StatusBarSlot store={workbench.stores.statusBarItems} side="right" />}
      />

      <ModalOutlet modals={pluginModals} onClose={closePluginModal} />

      {inputModal && (
        <OperationForm
          title={inputModal.title}
          inputs={inputModal.inputs}
          choices={inputModal.choices}
          onSubmit={(args) => closeInputModal(args)}
          onCancel={() => closeInputModal(null)}
        />
      )}
    </div>
  );
}

export default Workbench;
