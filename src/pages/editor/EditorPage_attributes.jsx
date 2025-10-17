/* eslint-disable react/prop-types */
import { useEffect, useState, useRef } from "react";
import "react-resizable/css/styles.css";
import ModelInformation from "../../components/ModelInformation";
import ExecutionOutput from "../../components/ExecutionOutput";
import UVLEditor from "../../components/UVLEditor";
import Toolbar from "../../components/Toolbar";
import DropdownMenu from "../../components/DropdownMenu";
import { saveAs } from "file-saver";
import TreeView from "../../components/FeatureTree";
import FeatureModelVisualization from "../../components/FeatureModelVisualization";
import Wizzard from "../../components/Wizzard";
import JSZip from "jszip";

function EditorPage({ selectedFile }) {
  const [worker, setWorker] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isImported, setIsImported] = useState(true);
  const [validation, setValidation] = useState(null);
  const [lastOutputHeight, setLastOutputHeight] = useState(150);
  const [output, setOutput] = useState({
    label: "Loading Flamapy...",
    result: selectedFile
      ? `Importing model '${selectedFile.name}'`
      : "FlamapyIDE is starting",
  });
  const [featureTree, setFeatureTree] = useState(null);
  const [currentView, setCurrentView] = useState("source");
  const [constraints, setConstraints] = useState(null);
  const [history, setHistory] = useState(null)

  // =========================================================================
  // ESTADOS Y REFS PARA Z3 ATTRIBUTE OPTIMIZATION Y COMUNICACIÓN ASÍNCRONA
  // =========================================================================
  const [showZ3ConfigModal, setShowZ3ConfigModal] = useState(false);
  const [numericalAttributesList, setNumericalAttributesList] = useState([]); 
  const [selectedAttributes, setSelectedAttributes] = useState([]); 
  // Referencias para resolver las Promesas de respuestas del Worker
  const numericalAttributesPromiseRef = useRef(null); 
  const validationPromiseRef = useRef(null); 
  const downloadPromiseRef = useRef(null); // Añadida por si se necesitara una respuesta síncrona de download

  const editorRef = useRef(null);
  
  // =========================================================================
  // FUNCIONES PEQUEÑAS REQUERIDAS (handleResize, getConstraints)
  // =========================================================================

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
    if (startIndex !== -1) {
      const constraintsSection = code.substring(startIndex);
      const constraintsLines = constraintsSection.split("\n").slice(1);
      const constraints = constraintsLines
        .map((line) => line.trim())
        .filter((line) => line !== "");
      return constraints;
    } else {
      return null;
    }
  }

  // =========================================================================
  // DEFINICIONES DE OPERACIONES (INCLUYENDO Z3)
  // =========================================================================

  const SATOperations = [
    { label: "Configurations", value: "PySATConfigurations" },
    { label: "Number of configurations", value: "PySATConfigurationsNumber" },
    { label: "Dead features", value: "PySATDeadFeatures" },
    { label: "Diagnosis", value: "PySATDiagnosis" },
    { label: "False optional features", value: "PySATFalseOptionalFeatures" },
    { label: "Satisfiable", value: "PySATSatisfiable" },
  ];
  const BDDOperations = [
    { label: "Configurations", value: "BDDConfigurations" },
    { label: "Number of configurations", value: "BDDConfigurationsNumber" },
    { label: "Dead features", value: "BDDDeadFeatures" },
    { label: "Satisfiable", value: "BDDSatisfiable" },
    { label: "Configuration distribution", value: "BDDProductDistribution" },
    {
      label: "Feature Inclusion Probability",
      value: "BDDFeatureInclusionProbability",
    },
    { label: "Unique Features", value: "BDDUniqueFeatures" },
    { label: "Homogeneity", value: "BDDHomogeneity" },
    { label: "Variability", value: "BDDVariability" },
    { label: "Variant Features", value: "BDDVariantFeatures" },
  ];
  const Z3Operations = [ // AÑADIDO Y CORREGIDO
    { label: "Satisfiable", value: "Z3Satisfiable" },
    { label: "Configurations", value: "Z3Configurations" },
    { label: "Number of configurations", value: "Z3ConfigurationsNumber" },
    { label: "Core features", value: "Z3CoreFeatures" },
    { label: "Dead features", value: "Z3DeadFeatures" },
    { label: "False-optional features", value: "Z3FalseOptionalFeatures" },
    { label: "Attribute optimization", value: "Z3AttributeOptimization" },
  ];

  const exportOperations = [
    { label: "AFM", value: "afm" },
    { label: "Glencoe", value: "gfm.json" },
    { label: "JSON", value: "json" },
    { label: "SPLOT", value: "sxfm" },
    { label: "Download UVL", value: "uvl" },
  ];

  const viewOptions = [
    { label: "Source View", value: "source" },
    { label: "Graph View", value: "graph" },
  ];


  // =========================================================================
  // INICIALIZACIÓN Y HANDLER CENTRALIZADO (¡CRÍTICO!)
  // =========================================================================
  function initializeWorker() {
    const flamapyWorker = new Worker("/webworker.js");
    
    // Handler de mensajes centralizado: gestiona TODAS las respuestas
    flamapyWorker.onmessage = (event) => {
      const { action, status, results, error, data } = event.data;
      
      // 1. INTERCEPCIÓN DE PROMESAS
      if (action === "getNumericalAttributes" && numericalAttributesPromiseRef.current) {
          numericalAttributesPromiseRef.current(results);
          numericalAttributesPromiseRef.current = null;
          return; 
      }
      if (action === "validateModel" && validationPromiseRef.current) {
          validationPromiseRef.current({ results, error });
          validationPromiseRef.current = null;
          return; 
      }
      if (action === "downloadFile" && downloadPromiseRef.current) {
          downloadPromiseRef.current({ results, error, actionData: data?.action });
          downloadPromiseRef.current = null;
          return;
      }

      // 2. LÓGICA PERMANENTE: Feature Tree
      if (action === "getFeatureTree" && results !== undefined) {
          setFeatureTree(results);
          return;
      }
      
      // 3. LÓGICA PERMANENTE: Import Model
      if (action === "importModel") {
        if (results !== undefined) {
          editorRef.current.setValue(results);
          editorRef.current.layout();
          setIsImported(true);
        } else if (error) {
          if (error.includes("not_supported")) {
            setOutput({ label: "Import error", result: `The provided file extension is not a supported model...` });
          } else {
            setOutput({ label: "Import error", result: `There was an error when trying to import the model...` });
          }
          setIsImported(true);
        }
        return;
      }
      
      // 4. LÓGICA PERMANENTE: Ejecución General (executeAction, executeActionWithConf)
      if (action === "executeAction" || action === "executeActionWithConf") {
          setIsRunning(false);
          if (results !== undefined) {
              const resultData = results;
              if (resultData.result && typeof resultData.result === 'string') {
                  try {
                      resultData.result = JSON.parse(resultData.result);
                  } catch (e) { /* silent fail */ }
              }
              setOutput(resultData);
          } else if (error) {
              setOutput({
                  label: data?.action?.label || 'Operation',
                  result: `An exception has occurred when trying to execute the operation. Details: ${error}`,
              });
          }
          return;
      }
      
      // 5. LÓGICA DE INICIALIZACIÓN (Status)
      if (status === "loaded") {
        setIsLoaded(true);
        setOutput({
          label: "Flamapy is ready",
          result: "Here you will see the result of executing an operation",
        });
        if (selectedFile) setIsImported(false);
      } else if (status === "error") {
        setOutput({
          label: "Initialization exception",
          result: `An exception has occurred when trying to initialize FlamapyIDE: ${error}`,
        });
      }
    };
    setWorker(flamapyWorker);
    return flamapyWorker;
  }

  // =========================================================================
  // USE EFFECTS (SOLO ENVÍO DE PETICIONES)
  // =========================================================================
  
  // Efecto de inicialización
  useEffect(() => {
    try {
      const flamapyWorker = initializeWorker();
      return () => {
        flamapyWorker.terminate();
      };
    } catch (error) {
      setOutput({
        label: "Initialization exception",
        result: `An exception has occurred when trying to initialize FlamapyIDE: ${error.toString()}`,
      });
    }
  }, []);

  // Efecto de importación
  useEffect(() => {
    if (selectedFile && isLoaded && !isImported) {
      const reader = new FileReader();
      const fileName = selectedFile.name;
      const extensionIndexStart = fileName.indexOf(".") + 1;
      const fileExtension = fileName.substring(
        extensionIndexStart,
        fileName.length
      );
      reader.onload = (e) => {
        const fileContent = e.target.result;
        if (fileExtension === "uvl") {
          editorRef.current.setValue(fileContent);
          editorRef.current.layout();
          setIsImported(true);
        } else {
          worker.postMessage({
            action: "importModel",
            data: { fileContent, fileExtension },
          });
        }
      };
      reader.readAsText(selectedFile);
    }
  }, [isLoaded, worker, isImported, selectedFile]);

  // Efecto de Feature Tree y precarga de atributos
  useEffect(() => {
    if (validation?.valid && worker) {
      worker.postMessage({
        action: "getFeatureTree",
      });
      worker.postMessage({
        action: "getNumericalAttributes",
      });
    }
  }, [validation, worker]);


  // =========================================================================
  // FUNCIONES DE SOPORTE PARA PROMESA
  // =========================================================================
  
  const getNumericAttributes = async () => {
    if (!worker || !isLoaded) return [];

    const promise = new Promise((resolve) => {
        numericalAttributesPromiseRef.current = resolve;
    });

    worker.postMessage({ action: "getNumericalAttributes" });
    
    const attrs = await promise; 
    
    const attributesArray = Array.isArray(attrs) 
        ? attrs 
        : Object.keys(attrs || {});
        
    return attributesArray;
  };

  const validateModelAsync = async () => {
    if (!isLoaded) return { valid: false };

    const code = editorRef.current.getValue();
    
    const promise = new Promise((resolve) => {
        validationPromiseRef.current = resolve;
    });

    worker.postMessage({ action: "validateModel", data: code });
    
    const { results, error } = await promise;
    
    if (results !== undefined) {
        const newValidation = results;
        setValidation(newValidation);
        setConstraints(getConstraints(code));
        return newValidation;
    } else if (error) {
        setOutput({
            label: "Validation error",
            result: `An exception has occurred when trying to validate the model. Details: ${error}`,
        });
        return { valid: false };
    }
  };

  // =========================================================================
  // FUNCIONES DE ACCIÓN
  // =========================================================================
  
  // Función para ser usada en llamadas síncronas/asíncronas
  async function validateModel() {
      return await validateModelAsync();
  }

  // Lógica del modal de selección
  const updateAttributeGoal = (name, value) => {
    setSelectedAttributes(selectedAttributes.map(a =>
      a.name === name ? { ...a, optimizationGoal: value } : a
    ));
  };

  const toggleAttributeSelection = (name, checked) => {
    if (checked) {
      setSelectedAttributes([...selectedAttributes, { name, optimizationGoal: "minimize" }]);
    } else {
      setSelectedAttributes(selectedAttributes.filter(a => a.name !== name));
    }
  };


  async function executeAction(action) {
    if (!isLoaded) return;
    
    // Lógica Z3 Attribute Optimization (Abre el Modal)
    if (action.value === "Z3AttributeOptimization") {
        setSelectedAttributes([]);
        const attrs = await getNumericAttributes(); 
        setNumericalAttributesList(attrs); 
        setShowZ3ConfigModal(true);
        return;
    }
    
    // Lógica para otras operaciones
    if (validation == null) {
        await validateModel();
    }
    if (validation?.valid) {
        worker.postMessage({ action: "executeAction", data: action });
        setIsRunning(true);
        setOutput({ label: action.label, result: "Executing operation" });
    } else {
        setOutput({
            label: action.label,
            result: "Error executing operation: the model is not valid. Check for syntax errors and retry once the model is valid",
        });
    }
  }

  async function executeActionWithConf(action, configuration) {
    if (!isLoaded) return;
    
    // 1. Manejo de la Optimización Z3 (Llamada desde el Modal)
    if (action.value === "Z3AttributeOptimization") {
        if (validation == null) {
            await validateModel();
        }
        if (validation.valid) {
            worker.postMessage({
                action: "executeActionWithConf", 
                data: { action, configuration }, 
            });
            setIsRunning(true);
            setOutput({ label: action.label, result: "Executing optimization..." });
        }
        return;
    }
    
    // 2. Lógica Original de Configurador/TreeView
    if (validation == null) {
        await validateModel();
    }
    if (validation.valid) {
        if (action.isOperationWithConf) {
            // Operaciones normales del TreeView con configuración (e.g., set feature value)
            worker.postMessage({
                action: "executeActionWithConf",
                data: { action, configuration },
            });
            setIsRunning(true);
            setOutput({ label: action.label, result: "Executing operation" });
        } else {
            // Lógica de Wizzard/Configurator
            if (action.value === "configurator") {
                toggleView(action);
            } else if (action.value === "downloadConfigurator") {
                const zip = new JSZip();

                try {
                    // Fetch base ZIP
                    const response = await fetch("/assets/flamapy.conf.zip");
                    if (!response.ok) throw new Error("Failed to load base.zip");
                    const baseZipBlob = await response.blob();
                    const baseZipArrayBuffer = await baseZipBlob.arrayBuffer();
                    const baseZip = await JSZip.loadAsync(baseZipArrayBuffer);

                    baseZip.forEach((relativePath, file) => {
                        zip.file(relativePath, file.async("arraybuffer"));
                    });

                    const featureModel = new File(
                        [editorRef.current.getValue()],
                        "FeatureModel.uvl",
                        { type: "text/plain" }
                    );
                    zip.file(`models/${featureModel.name}`, featureModel);

                    const newZipBlob = await zip.generateAsync({ type: "blob" });
                    saveAs(newZipBlob, "configurator.zip");
                } catch (err) {
                    console.error("Error processing ZIP:", err);
                    alert("Failed to generate ZIP.");
                }
            }
        }
    } else {
        setOutput({
            label: action.label,
            result: "Error executing operation: the model is not valid. Check for syntax errors and retry once the model is valid",
        });
    }
}


  function interruptExecution() {
    if (isLoaded) {
      worker.terminate();
      setIsLoaded(false);
      setIsRunning(false);
      setOutput({
        label: "Execution has been interrupted",
        result: "Re-starting Flamapy...",
      });
      initializeWorker();
    }
  }

  async function downloadFile(action) {
    if (!isLoaded || !worker) return;

    // 1. Crear Promesa y guardar el resolvedor en la ref
    const promise = new Promise((resolve) => {
        downloadPromiseRef.current = resolve;
    });
    
    // 2. Enviar la petición al Worker, incluyendo la extensión para usarla después
    worker.postMessage({ 
        action: "downloadFile", 
        data: { action, fileExtension: action.value } 
    });
    
    // 3. Esperar la respuesta del Worker (interceptada en initializeWorker)
    const { results, error, actionData } = await promise;
    
    // 4. Manejar el resultado
    if (results !== undefined) {
      const file = new File([results], `model.${actionData.value}`, {
        type: "text/plain;charset=utf-8",
      });
      saveAs(file);
    } else if (error) {
      setOutput({ label: "Export failed", result: error });
    }
  };

  const toggleView = async (option) => {
    if (isLoaded) {
      if (validation == null) {
        await validateModel();
      }
      if (validation?.valid) {
        setCurrentView(option.value);
      } else {
        if (option.value === "graph") {
          setOutput({
            label: "Visualize model",
            result:
              "The model is not valid. Check for syntax errors and retry once the model is valid",
          });
        } else if (option.value === "configurator") {
          setOutput({
            label: "Configure model",
            result:
              "The model is not valid. Check for syntax errors and retry once the model is valid",
          });
        }
      }
    }
  };

  // =========================================================================
  // COMPONENTE MODAL DE CONFIGURACIÓN Z3
  // =========================================================================

  const Z3ConfigModal = () => {
      const attributes = numericalAttributesList || [];
      
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96 max-h-[80vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">Z3 Attribute Optimization</h2>

            {attributes.length === 0 && (
              <p className="text-gray-600 mb-4">No numeric attributes found in the model.</p>
            )}
            
            {attributes.map((attrName) => {
              const selected = selectedAttributes.find(a => a.name === attrName);
              const isChecked = !!selected;

              return (
                <div key={attrName} className="mb-3 border-b pb-2">
                  <label className="flex justify-between items-center cursor-pointer">
                    <span className="font-medium">{attrName}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => toggleAttributeSelection(attrName, e.target.checked)}
                      className="form-checkbox h-5 w-5 text-blue-600"
                    />
                  </label>
                  {isChecked && (
                    <select
                      value={selected.optimizationGoal}
                      onChange={(e) => updateAttributeGoal(attrName, e.target.value)}
                      className="border border-gray-300 p-1 w-full mt-1 rounded text-sm"
                    >
                      <option value="minimize">Minimize</option>
                      <option value="maximize">Maximize</option>
                    </select>
                  )}
                </div>
              );
            })}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowZ3ConfigModal(false)}
                className="bg-gray-300 px-4 py-2 rounded text-gray-800 hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowZ3ConfigModal(false);
                  executeActionWithConf(
                    { label: "Z3 Attribute Optimization", value: "Z3AttributeOptimization" },
                    selectedAttributes
                  );
                }}
                disabled={selectedAttributes.length === 0}
                className={`px-4 py-2 rounded text-white ${selectedAttributes.length === 0 ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                Run Optimization
              </button>
            </div>
          </div>
        </div>
      );
    };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Top Section */}

      <div className="flex flex-row flex-grow p-2 gap-2 overflow-auto">
        {/* Left Side Panel */}
        <TreeView
          treeData={featureTree}
          // Función de configuración original
          executeAction={executeActionWithConf} 
          history={history}
        />

        {/* Center Section (Text Editor/Feature Model + Bottom Panel) */}
        <div className="flex flex-1 flex-col">
          {/* Toolbar */}
          <Toolbar>
            <DropdownMenu
              buttonLabel={"SAT Operations"}
              options={SATOperations}
              executeAction={executeAction}
            ></DropdownMenu>
            <DropdownMenu
              buttonLabel={"BDD Operations"}
              options={BDDOperations}
              executeAction={executeAction}
            ></DropdownMenu>
            <DropdownMenu
              buttonLabel={"Z3 Operations"}
              options={Z3Operations}
              executeAction={executeAction}
            ></DropdownMenu>
            <DropdownMenu
              buttonLabel={"Export To"}
              options={exportOperations}
              executeAction={downloadFile}
            />
            <DropdownMenu
              buttonLabel={"Select View"}
              options={viewOptions}
              executeAction={toggleView}
              className="bg-blue-500 text-white p-2 rounded"
            />
          </Toolbar>
          {/* Text Editor or feature model */}
          <UVLEditor
            editorRef={editorRef}
            validateModel={validateModel}
            defaultCode={editorRef?.current?.getValue()}
            hide={currentView !== "source"}
          />
          {currentView === "graph" && (
            <FeatureModelVisualization
              treeData={featureTree}
              constraints={constraints}
            />
          )}
          {currentView === "configurator" && <Wizzard worker={worker} setHistory={setHistory} />}

          {/* Bottom Panel */}
          <ExecutionOutput
            handleResize={handleResize}
            handleStop={interruptExecution}
            isAwaiting={isRunning || !isImported || !isLoaded}
          >
            {output}
          </ExecutionOutput>
        </div>
        {/* Right Side Panel */}
        <ModelInformation
          onValidateModel={validateModel}
          validation={validation}
        />
      </div>

      {/* MODAL Z3 */}
      {showZ3ConfigModal && <Z3ConfigModal />}
    </div>
  );
}

export default EditorPage;