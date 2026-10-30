/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
// Direct file imports: the web-ui barrel pulls monaco (untestable in node).
import { vsBtnPrimary } from "@flamapy/web-ui/src/ui/styles.js";
import ModelProperties from "./ModelProperties.jsx";

// The "Model information" side panel: validates the model and computes its metrics on
// demand. Validation problems live in the bottom PROBLEMS tab; metrics are not computed
// on every keystroke because some of them are full analyses.
function ModelInformationPanel({ analysis, worker, onError }) {
  const [validation, setValidation] = useState(analysis.validation);
  const [metrics, setMetrics] = useState(null);

  // Metrics describe the model they were computed for: drop them when it changes.
  useEffect(() => {
    const subscription = analysis.onValidationChange(() => {
      setValidation(analysis.validation);
      setMetrics(null);
    });
    return () => subscription.dispose();
  }, [analysis]);

  async function validateAndCompute() {
    const result = await analysis.validateNow();
    setValidation(result);
    if (!result?.valid) return;
    try {
      setMetrics(await worker.call("getModelInformation"));
    } catch (error) {
      onError(error);
    }
  }

  return (
    <div className="space-y-2">
      <button className={`${vsBtnPrimary} w-full justify-center`} onClick={validateAndCompute}>
        Validate &amp; compute metrics
      </button>
      {validation?.valid && metrics ? (
        <ModelProperties modelProperties={metrics} />
      ) : (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">
          {validation && !validation.valid
            ? "The model has problems — see the Problems tab."
            : "Use the button above to compute the model metrics."}
        </p>
      )}
    </div>
  );
}

export default ModelInformationPanel;
