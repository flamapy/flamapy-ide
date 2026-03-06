/* eslint-disable react/prop-types */
import { ResizableBox } from "react-resizable";
import Spinner from "./Spinner";

const ExecutionOutput = ({
  width = Infinity,
  height = 150,
  axis = "y",
  minConstraints = [Infinity, 100],
  maxConstraints = [Infinity, 300],
  className = "bg-gray-700 dark:bg-gray-900 text-white p-4 resize-handle-top rounded-lg",
  handleResize,
  handleStop,
  children,
  isAwaiting,
}) => {
  return (
    <ResizableBox
      width={width}
      height={height}
      axis={axis}
      minConstraints={minConstraints}
      maxConstraints={maxConstraints}
      className={className}
      handle={
        <div className="absolute top-0 left-0 w-full h-2 cursor-ns-resize" />
      }
      resizeHandles={["n"]}
      onResize={handleResize}
    >
      <div className="overflow-auto h-full">
        <button
          onClick={handleStop}
          className="absolute top-0 right-0 m-2 p-2 bg-red-600 text-white rounded"
        >
          Stop
        </button>
        <div className="flex items-center font-semibold text-xl">
          {isAwaiting ? (
            <>
              <Spinner /> {children.label}
            </>
          ) : (
            children.label
          )}
        </div>
        <div className="font-mono text-sm">
          {children.result == null ||
          (Array.isArray(children.result) && children.result.length === 0) ? (
            <div>There are no {children.label}.</div>
          ) : Array.isArray(children.result) ? (
            children.result.map((item, index) => (
              <div key={index}>{item.toString()}</div>
            ))
          ) : (
            children.result.toString()
          )}
        </div>
      </div>
    </ResizableBox>
  );
};

export default ExecutionOutput;
