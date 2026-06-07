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
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between shrink-0 pb-2 border-b border-gray-500 dark:border-gray-600">
          <div className="flex items-center gap-2 font-semibold text-base leading-tight">
            {isAwaiting && <Spinner />}
            <span>{children.label}</span>
          </div>
          {isAwaiting && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded transition-colors duration-150"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              Stop
            </button>
          )}
        </div>
        <div className="font-mono text-sm mt-2 overflow-auto flex-1">
          {children.result == null ||
          (Array.isArray(children.result) && children.result.length === 0) ? (
            <div className="text-gray-400 italic">There are no {children.label}.</div>
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
