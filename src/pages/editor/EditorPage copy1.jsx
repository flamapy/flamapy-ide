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
  const [history, setHistory] = useState(null);

  const [showZ3ConfigModal, setShowZ3ConfigModal] = useState(false);
  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const [modelAttributes, setModelAttributes] = useState([]); // Atributos numéricos
  
  // REF para guardar el handler original del worker, clave para la corrección
  const workerOriginalOnMessageHandlerRef = useRef(null);

  const editorRef = useRef(null);

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
  const Z3Operations = [
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
  // Lógica de Atributos Numéricos y Modal - CORRECCIÓN
  // =========================================================================

  useEffect(() => {
    if (showZ3ConfigModal && worker && isLoaded) {
      // 1. Guardar el handler original
      workerOriginalOnMessageHandlerRef.current = worker.onmessage;

      // 2. Definir un handler temporal para "getNumericalAttributes"
      worker.onmessage = (event) => {
        if (event.data.action === "getNumericalAttributes") {
            const attrs = event.data.results;
            console.log("Received numeric attributes: ", attrs); 
            
            const attributesArray = Array.isArray(attrs) 
                ? attrs 
                : Object.keys(attrs || {}); // Esto ya casi no es necesario si el Worker funciona bien
                
            setModelAttributes(attributesArray);

          // 3. Restablecer el handler original
          if (workerOriginalOnMessageHandlerRef.current) {
             worker.onmessage = workerOriginalOnMessageHandlerRef.current;
          }
        } else {
          // Si el worker responde a otra cosa (ej: validación) mientras el modal está abierto,
          // usa el handler original si existe.
          if (workerOriginalOnMessageHandlerRef.current) {
            workerOriginalOnMessageHandlerRef.current(event);
          }
        }
      };
      
      // 4. Disparar la acción para obtener los atributos
      worker.postMessage({ action: "getNumericalAttributes" });

      // Función de limpieza para restablecer el handler al cerrar/desmontar
      return () => {
        if (workerOriginalOnMessageHandlerRef.current) {
          worker.onmessage = workerOriginalOnMessageHandlerRef.current;
          workerOriginalOnMessageHandlerRef.current = null;
        }
      };

    } else if (!showZ3ConfigModal && workerOriginalOnMessageHandlerRef.current) {
        // Asegurar que se limpia al cerrar el modal si no se disparó la limpieza en el 'return'
        worker.onmessage = workerOriginalOnMessageHandlerRef.current;
        workerOriginalOnMessageHandlerRef.current = null;
    }
  }, [showZ3ConfigModal, worker, isLoaded]);


  const updateAttribute = (name, key, value) => {
    setSelectedAttributes(selectedAttributes.map(a =>
      a.name === name ? { ...a, [key]: value } : a
    ));
  };

  const toggleAttribute = (name, checked) => {
    if (checked) {
      setSelectedAttributes([...selectedAttributes, { name, optimizationGoal: "minimize" }]);
    } else {
      setSelectedAttributes(selectedAttributes.filter(a => a.name !== name));
    }
  };
  
  // =========================================================================
  // Funciones de Worker e Inicialización
  // =========================================================================

  function initializeWorker() {
    const flamapyWorker = new Worker("/webworker.js");
    flamapyWorker.onmessage = (event) => {
      if (event.data.status === "loaded") {
        setIsLoaded(true);
        setOutput({
          label: "Flamapy is ready",
          result: "Here you will see the result of executing an operation",
        });
        if (selectedFile) setIsImported(false);
      } else {
        setOutput({
          label: "Initialization exception",
          result: `An exception has occurred when trying to initialize FlamapyIDE: ${event.data.exeption}`,
        });
      }
    };
    setWorker(flamapyWorker);
    return flamapyWorker;
  }

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

          // Este handler de 'onmessage' se debe eliminar o manejar de forma centralizada. 
          // Por simplicidad, se deja, pero es una fuente potencial de conflicto con el modal.
          worker.onmessage = async (event) => { 
            if (event.data.results !== undefined) {
              editorRef.current.setValue(event.data.results);
              await editorRef.current.layout();
              setIsImported(true);
            } else if (event.data.error) {
              if (event.data.error.includes("not_supported")) {
                setOutput({
                  label: "Import error",
                  result: `The provided file extension is not a supported model. Please try with a model in one of the following types: .gfm.json, .afm, .fide, .json, .xml or .uvl`,
                });
              } else {
                setOutput({
                  label: "Import error",
                  result: `There was an error when trying to import the model. Please make sure that the model is valid, and try again.`,
                });
              }
              setIsImported(true);
            }
          };
        }
      };
      reader.readAsText(selectedFile);
    }
  }, [isLoaded, worker, isImported, selectedFile]);

  useEffect(() => {
    if (validation?.valid) {
      worker.postMessage({
        action: "getFeatureTree",
      });
      // Este handler de 'onmessage' se debe eliminar o manejar de forma centralizada. 
      // Por simplicidad, se deja, pero es una fuente potencial de conflicto con el modal.
      worker.onmessage = (event) => {
        if (event.data.results !== undefined) {
          setFeatureTree(event.data.results);
        }
      };
    }
  }, [validation, worker]);


  // =========================================================================
  // Funciones de Validación y Ejecución
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

  async function validateModel() {
    if (isLoaded) {
      const code = editorRef.current.getValue();
      worker.postMessage({ action: "validateModel", data: code });

      // Este handler de 'onmessage' se debe eliminar o manejar de forma centralizada. 
      // Por simplicidad, se deja, pero es una fuente potencial de conflicto con el modal.
      worker.onmessage = (event) => { 
        if (event.data.results !== undefined) {
          setValidation(() => {
            return event.data.results;
          });
          setConstraints(getConstraints(code));
        } else if (event.data.error) {
          setOutput({
            label: "Validation error",
            result: `An exception has occurred when trying to validate the model.\nTry restarting Flamapy by pressing on the stop button.`,
          });
        }
      };
    }
  }

  async function executeAction(action) {
    // Lógica para abrir el modal
    if (action.value === "Z3AttributeOptimization") {
      setSelectedAttributes([]);
      setShowZ3ConfigModal(true);
      return;
    }
    
    if (isLoaded) {
      if (validation == null) {
        await validateModel();
      }
      if (validation.valid) {
        worker.postMessage({ action: "executeAction", data: action });
        setIsRunning(true);
        setOutput({ label: action.label, result: "Executing operation" });
        
        // Este handler de 'onmessage' se debe eliminar o manejar de forma centralizada. 
        // Por simplicidad, se deja, pero es una fuente potencial de conflicto con el modal.
        worker.onmessage = (event) => { 
          console.log("Received message from worker " + JSON.stringify(event.data));
          if (event.data.results !== undefined) {
            event.data.results.result = JSON.parse(event.data.results.result);
            setOutput(event.data.results);
          } else if (event.data.error) {
            setOutput({
              label: action.label,
              result: `An exception has occurred when trying to execute the operation. Please check if the model is well defined.`,
            });
          }
          setIsRunning(false);
        };
      } else {
        setOutput({
          label: action.label,
          result:
            "Error executing operation: the model is not valid. Check for syntax errors and retry once the model is valid",
        });
      }
    }
  }

  async function executeActionWithConf(action, configuration) {
    if (isLoaded) {
      if (validation == null) {
        await validateModel();
      }
      if (validation.valid) {
        if (action.isOperationWithConf) {
          worker.postMessage({
            action: "executeActionWithConf",
            data: { action, configuration },
          });
          setIsRunning(true);
          setOutput({ label: action.label, result: "Executing operation" });
          
          // Este handler de 'onmessage' se debe eliminar o manejar de forma centralizada. 
          // Por simplicidad, se deja, pero es una fuente potencial de conflicto con el modal.
          worker.onmessage = (event) => { 
            if (event.data.results !== undefined) {
              setOutput(event.data.results);
            } else if (event.data.error) {
              setOutput({
                label: action.label,
                result: `An exception has occurred when trying to execute the operation with configuration. Please check if the model is well defined.`,
              });
            }
            setIsRunning(false);
          };
        } else {
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

              // Load the ZIP content
              const baseZip = await JSZip.loadAsync(baseZipArrayBuffer);

              // Copy contents from base ZIP into our new ZIP
              baseZip.forEach((relativePath, file) => {
                zip.file(relativePath, file.async("arraybuffer"));
              });

              // Add the feature model file
              const featureModel = new File(
                [editorRef.current.getValue()],
                "FeatureModel.uvl",
                { type: "text/plain" }
              );
              zip.file(`models/${featureModel.name}`, featureModel);

              // Generate and trigger download
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
          result:
            "Error executing operation: the model is not valid. Check for syntax errors and retry once the model is valid",
        });
      }
    }
  }

  async function executeActionWithAttributes(action, attributes) {
    if (!isLoaded) return;
    if (validation == null) await validateModel();

    if (validation.valid) {
      worker.postMessage({
        action: "executeActionWithAttributes",
        data: { action, attributes },
      });
      setIsRunning(true);
      setOutput({ label: action.label, result: "Executing operation with attributes..." });

      // Este handler de 'onmessage' se debe eliminar o manejar de forma centralizada. 
      // Por simplicidad, se deja, pero es una fuente potencial de conflicto con el modal.
      worker.onmessage = (event) => {
        if (event.data.results !== undefined) setOutput(event.data.results);
        else if (event.data.error) {
          setOutput({
            label: action.label,
            result: `Error executing operation with attributes.`,
          });
        }
        setIsRunning(false);
      };
    } else {
      setOutput({
        label: action.label,
        result: "Error: the model is not valid. Fix syntax errors and retry.",
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
    if (isLoaded) {
      worker.postMessage({ action: "downloadFile", data: action });

      // Este handler de 'onmessage' se debe eliminar o manejar de forma centralizada. 
      // Por simplicidad, se deja, pero es una fuente potencial de conflicto con el modal.
      worker.onmessage = (event) => {
        if (event.data.results !== undefined) {
          const file = new File([event.data.results], `model.${action.value}`, {
            type: "text/plain;charset=utf-8",
          });
          saveAs(file);
        } else if (event.data.error) {
          setOutput({ label: "Export failed", result: event.data.error });
        }
      };
    }
  }

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
  // Componente Modal Z3
  // =========================================================================

  const Z3ConfigModal = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded shadow-lg w-96 max-h-[80vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">Z3 Attribute Optimization</h2>

        {modelAttributes.length === 0 && (
          <p className="text-gray-600 mb-4">No numeric attributes found...</p>
        )}
        
        {modelAttributes.map((attr) => {
          const selected = selectedAttributes.find(a => a.name === attr);
          return (
            <div key={attr} className="mb-3 border-b pb-2">
              <label className="flex justify-between items-center">
                <span>{attr}</span>
                <input
                  type="checkbox"
                  checked={!!selected}
                  onChange={(e) => toggleAttribute(attr, e.target.checked)}
                />
              </label>
              {selected && (
                <select
                  value={selected.optimizationGoal}
                  onChange={(e) => updateAttribute(attr, "optimizationGoal", e.target.value)}
                  className="border p-1 w-full mt-1"
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
            onClick={() => {
                setShowZ3ConfigModal(false);
            }}
            className="bg-gray-300 px-3 py-1 rounded"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setShowZ3ConfigModal(false);
              executeActionWithAttributes(
                { label: "Z3 Attribute Optimization", value: "Z3AttributeOptimization" },
                selectedAttributes
              );
            }}
            // Deshabilitar si no hay atributos seleccionados
            disabled={selectedAttributes.length === 0}
            className={`px-3 py-1 rounded ${selectedAttributes.length === 0 ? 'bg-blue-300' : 'bg-blue-500 text-white'}`}
          >
            Run
          </button>
        </div>
      </div>
    </div>
  );
  
  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Top Section */}

      <div className="flex flex-row flex-grow p-2 gap-2 overflow-auto">
        {/* Left Side Panel */}
        <TreeView
          treeData={featureTree}
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

      {showZ3ConfigModal && <Z3ConfigModal />}
    </div>
  );
}

export default EditorPage;