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
      className="bg-neutral-300 text-neutral-900 p-4 resize-handle-left rounded-lg overflow-auto"
      handle={
        <div className="absolute left-0 top-0 h-full w-2 cursor-ew-resize" />
      }
      resizeHandles={["w"]}
    >
      <div>
        <button
          className="w-full bg-[#356C99] text-white py-2 px-4 rounded active:bg-[#0D486C] shadow-lg"
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
