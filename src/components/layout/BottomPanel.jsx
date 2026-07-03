/* eslint-disable react/prop-types */
import { ResizableBox } from "react-resizable";
import Spinner from "../Spinner";

// VSCode-style bottom panel with OUTPUT / PROBLEMS tabs. Replaces the standalone
// ExecutionOutput: OUTPUT renders the latest operation result (with the Stop button
// while awaiting); PROBLEMS lists the model's validation errors and warnings.
function BottomPanel({
  panelTab,
  setPanelTab,
  output,
  validation,
  isAwaiting,
  handleResize,
  handleStop,
  height = 170,
}) {
  const errors = validation?.errors ?? [];
  const warnings = validation?.warnings
    ? Array.isArray(validation.warnings)
      ? validation.warnings
      : [validation.warnings]
    : [];
  const problemCount = errors.length + warnings.length;

  const Tab = ({ id, label, badge }) => {
    const active = panelTab === id;
    return (
      <button
        onClick={() => setPanelTab(id)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${
          active
            ? "border-accent text-gray-900 dark:text-white"
            : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        }`}
      >
        {label}
        {badge > 0 && (
          <span className="px-1.5 rounded-full bg-red-500 text-white text-[10px] leading-tight">{badge}</span>
        )}
      </button>
    );
  };

  return (
    <ResizableBox
      width={Infinity}
      height={height}
      axis="y"
      minConstraints={[Infinity, 110]}
      maxConstraints={[Infinity, 360]}
      className="bg-white dark:bg-gray-900 border-t border-black/10 dark:border-white/10 relative"
      handle={<div className="absolute top-0 left-0 w-full h-1.5 cursor-ns-resize z-10" />}
      resizeHandles={["n"]}
      onResize={handleResize}
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between shrink-0 px-2 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center">
            <Tab id="output" label="Output" />
            <Tab id="problems" label="Problems" badge={problemCount} />
          </div>
          <div className="flex items-center gap-2 pr-1">
            {isAwaiting && <Spinner />}
            {isAwaiting && (
              <button
                onClick={handleStop}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                Stop
              </button>
            )}
          </div>
        </div>

        {panelTab === "output" ? (
          <div className="flex flex-col flex-1 overflow-hidden px-3 py-2">
            <div className="font-semibold text-[13px] text-gray-800 dark:text-gray-200 shrink-0">
              {output.label}
            </div>
            <div className="font-mono text-[12.5px] mt-1 overflow-auto flex-1 text-gray-700 dark:text-gray-300">
              {output.result == null ||
              (Array.isArray(output.result) && output.result.length === 0) ? (
                <div className="text-gray-400 italic">There are no {output.label}.</div>
              ) : Array.isArray(output.result) ? (
                output.result.map((item, i) => <div key={i}>{item.toString()}</div>)
              ) : (
                output.result.toString()
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto px-3 py-2 space-y-1 text-[12.5px]">
            {problemCount === 0 ? (
              <div className="text-gray-400 italic">No problems detected.</div>
            ) : (
              <>
                {errors.map((e, i) => (
                  <div key={`e${i}`} className="flex items-start gap-2 text-red-600 dark:text-red-400">
                    <span aria-hidden="true">✗</span>
                    <span className="font-mono">{e}</span>
                  </div>
                ))}
                {warnings.map((w, i) => (
                  <div key={`w${i}`} className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                    <span aria-hidden="true">⚠</span>
                    <span className="font-mono">{w}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </ResizableBox>
  );
}

export default BottomPanel;
