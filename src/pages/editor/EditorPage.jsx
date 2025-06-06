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
    </div>
  );
}

export default EditorPage;
