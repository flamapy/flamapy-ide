/* eslint-disable react/prop-types */
import { ResizableBox } from "react-resizable";
import ModelProperties from "./ModelProperties";

const ModelInformation = ({
  width = 300,
  minWidth = 150,
  maxWidth = 400,
  buttonText = "Syntax Validation",
  onValidateModel,
  validation,
}) => {
  return (
    <ResizableBox
      width={width}
      height={Infinity}
      axis="x"
      minConstraints={[minWidth, Infinity]}
      maxConstraints={[maxWidth, Infinity]}
      className="bg-neutral-300 dark:bg-gray-700 text-neutral-900 dark:text-gray-100 p-4 resize-handle-left rounded-lg overflow-auto"
      handle={
        <div className="absolute left-0 top-0 h-full w-2 cursor-ew-resize" />
      }
      resizeHandles={["w"]}
    >
      <div>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">
          Model Information
        </h2>
        <button
          className="w-full bg-[#356C99] hover:bg-[#0D486C] active:bg-[#0a3a57] text-white py-2 px-4 rounded shadow-lg transition-colors duration-150"
          onClick={onValidateModel}
        >
          {buttonText}
        </button>
        {validation?.errors?.length > 0 &&
          validation.errors.map((error, index) => {
            return (
              <div
                className="w-full bg-red-700 text-white py-2 px-4 rounded mt-1"
                key={index}
              >
                {error}
              </div>
            );
          })}
        {validation?.warnings?.length > 0 && (
          <div className="w-full bg-yellow-700 text-white py-2 px-4 rounded mt-1">
            The model presents warnings: {validation.warnings}
          </div>
        )}
        {validation?.valid && (
          <ModelProperties modelProperties={validation.modelInformation} />
        )}
      </div>
    </ResizableBox>
  );
};

export default ModelInformation;
