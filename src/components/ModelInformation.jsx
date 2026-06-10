/* eslint-disable react/prop-types */
import { ResizableBox } from "react-resizable";
import ModelProperties from "./ModelProperties";
import Card from "./ui/Card";
import { vsBtnPrimary, ACCENT } from "./ui/styles";

// Right-hand "Model information" panel. Validation errors/warnings now live in the
// bottom PROBLEMS tab; this panel keeps the validate action and the model metrics.
// Metrics (modelInfo) are computed on demand via the button — not on keystroke
// validation — because some of them are full analyses.
const ModelInformation = ({
  width = 300,
  minWidth = 180,
  maxWidth = 460,
  buttonText = "Validate & compute metrics",
  onValidateModel,
  validation,
  modelInfo,
}) => {
  return (
    <ResizableBox
      width={width}
      height={Infinity}
      axis="x"
      minConstraints={[minWidth, Infinity]}
      maxConstraints={[maxWidth, Infinity]}
      className="bg-panel dark:bg-gray-900 border-l border-black/10 dark:border-white/10 p-3 overflow-auto relative"
      handle={<div className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize" />}
      resizeHandles={["w"]}
    >
      <Card title="Model information" accent={ACCENT}>
        <button className={`${vsBtnPrimary} w-full justify-center`} onClick={onValidateModel}>
          {buttonText}
        </button>
        {validation?.valid && modelInfo ? (
          <ModelProperties modelProperties={modelInfo} />
        ) : (
          <p className="text-[12px] text-gray-500 dark:text-gray-400">
            {validation && !validation.valid
              ? "The model has problems — see the Problems tab."
              : "Use the button above to compute the model metrics."}
          </p>
        )}
      </Card>
    </ResizableBox>
  );
};

export default ModelInformation;
