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
  const [isAttributeOptimizationModalOpen, setIsAttributeOptimizationModalOpen] = useState(false);
  const [numericalAttributes, setNumericalAttributes] = useState(null);
  const [optimizationGoals, setOptimizationGoals] = useState({});

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

      worker.onmessage = (event) => {
        if (event.data.results !== undefined) {
          setFeatureTree(event.data.results);
        }
      };
    }
  }, [validation, worker]);

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

  // 🟢 FUNCIÓN NUEVA: Para obtener atributos numéricos del worker
  async function get_attributes() {
    if (!isLoaded) return null; // Asegura que el worker esté listo

    return new Promise((resolve, reject) => {
      // 1. Envía la acción al worker
      worker.postMessage({ action: "getNumericalAttributes" });
      
      // 2. Define el manejador para la respuesta
      worker.onmessage = (event) => {
        if (event.data.results !== undefined) {
          // Asumiendo que 'results' contiene la lista de atributos
          resolve(event.data.results); 
        } else if (event.data.error) {
          setOutput({
            label: "Attribute Extraction Error",
            result: `Error getting numerical attributes: ${event.data.error}`,
          });
          reject(new Error("Worker error during attribute extraction"));
        }
      };
    });
  }

  async function validateModel() {
    if (isLoaded) {
      const code = editorRef.current.getValue();
      worker.postMessage({ action: "validateModel", data: code });

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
    if (isLoaded) {
      if (validation == null) {
        await validateModel();
      }
      if (validation.valid) {
        if (action.value === "Z3AttributeOptimization") {
          const attributes = await get_attributes();
          setNumericalAttributes(attributes);
          setIsAttributeOptimizationModalOpen(true);
          return;
        }
        worker.postMessage({ action: "executeAction", data: action });
        setIsRunning(true);
        setOutput({ label: action.label, result: "Executing operation" });
        worker.onmessage = (event) => {
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
          worker.onmessage = (event) => {
            if (event.data.results !== undefined) {
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

  // 🟢 FUNCIÓN NUEVA: Maneja el cambio del checkbox (seleccionar/deseleccionar)
  function handleAttributeSelection(attribute, isChecked) {
    setOptimizationGoals(prevGoals => {
      // Si se selecciona, inicializa el goal a 'Minimize' por defecto
      if (isChecked) {
        return {
          ...prevGoals,
          [attribute]: { selected: true, goal: prevGoals[attribute]?.goal || 'Minimize' }
        };
      } else {
        // Si se deselecciona, marca como no seleccionado (mantiene el goal anterior por si se vuelve a seleccionar)
        return {
          ...prevGoals,
          [attribute]: { ...prevGoals[attribute], selected: false }
        };
      }
    });
  }

  // 🟢 FUNCIÓN NUEVA: Maneja el cambio del selector (Minimize/Maximize)
  function handleGoalChange(attribute, newGoal) {
    setOptimizationGoals(prevGoals => ({
      ...prevGoals,
      [attribute]: { ...prevGoals[attribute], goal: newGoal }
    }));
  }

  // 🟢 FUNCIÓN NUEVA: Maneja la acción final (ejecutar la optimización)
  function executeOptimization() {
    // 1. Filtra solo los atributos seleccionados
    const selectedGoals = Object.entries(optimizationGoals)
      .filter(([, data]) => data.selected)
      .map(([attribute, data]) => ({ 
          attribute: attribute, 
          goal: data.goal 
      }));

    if (selectedGoals.length === 0) {
        setOutput({ label: "Optimization Error", result: "No attributes selected for optimization." });
        return;
    }

    // 2. Aquí iría la llamada al worker para ejecutar la operación de optimización
    // Ejemplo: worker.postMessage({ action: "executeOptimization", data: selectedGoals });
    worker.postMessage({ action: "executeAttributeOptimization", data: selectedGoals });
        setIsRunning(true);
        setOutput({ label: 'Attribute Optimization', result: "Executing operation" });
        worker.onmessage = (event) => {
          if (event.data.results !== undefined) {
            console.log("Raw result from worker:", event.data.results);
            //event.data.results.result = JSON.parse(event.data.results.result);
            setOutput(event.data.results);
          } else if (event.data.error) {
            setOutput({
              label: 'Attribute Optimization',
              result: `An exception has occurred when trying to execute the operation. Please check if the model is well defined.`,
            });
          }
          setIsRunning(false);
        };
    
    // 3. Muestra el resultado de la selección en la consola (temporalmente)
    setOutput({
      label: "Optimization Configuration",
      result: JSON.stringify(selectedGoals, null, 2)
    });
    
    // 4. Cierra el modal
    closeAttributeOptimizationModal();
  }

  // 🟢 FUNCIÓN NUEVA: Para cerrar el modal
  function closeAttributeOptimizationModal() {
    setIsAttributeOptimizationModalOpen(false);
    // Limpia el estado de selección al cerrar el modal.
    setOptimizationGoals({});
  }

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

      {/* 🟢 NUEVO: Implementación del Modal */}
      {isAttributeOptimizationModalOpen && (
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
                      const goal = optimizationGoals[attribute]?.goal || 'Minimize';
                      
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
                              disabled={!isSelected} // Deshabilita el selector si no está seleccionado
                              onChange={(e) => handleGoalChange(attribute, e.target.value)}
                              className={`mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${!isSelected ? 'bg-gray-200 text-gray-500' : 'bg-white'}`}
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
                <p className="text-sm text-red-500">
                  ⚠️ No hay atributos numéricos disponibles o la operación falló.
                </p>
              )}
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md hover:bg-gray-400 transition duration-150"
                onClick={closeAttributeOptimizationModal}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition duration-150"
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
