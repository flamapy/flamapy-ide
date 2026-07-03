/* eslint-disable react/prop-types */

// Slim VSCode-style status bar. Accent blue normally, red when the model is
// invalid. Left: ready/loading state + validity (click → Problems tab). Right:
// compute backend (click to switch / configure) and the active solver.
function StatusBar({
  isLoaded,
  isAwaiting,
  validation,
  onShowProblems,
  computeBackend,
  WASM,
  onToggleBackend,
  restApiUrl,
  selectedSolver,
}) {
  const errors = validation?.errors ?? [];
  const warnings = validation?.warnings
    ? Array.isArray(validation.warnings)
      ? validation.warnings
      : [validation.warnings]
    : [];
  const problemCount = errors.length + warnings.length;
  const invalid = validation && !validation.valid;

  const bar = invalid
    ? "bg-red-600 text-white"
    : "bg-accent text-white";
  const item =
    "flex items-center gap-1 px-2 h-full hover:bg-white/15 transition-colors cursor-pointer";

  const isWasm = computeBackend === WASM;

  return (
    <footer className={`flex items-center justify-between h-[22px] text-[11px] ${bar} shrink-0 select-none`}>
      <div className="flex items-center h-full">
        <span className="flex items-center gap-1.5 px-2 h-full">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              !isLoaded || isAwaiting ? "bg-white/70 animate-pulse" : "bg-white"
            }`}
          />
          {!isLoaded ? "Loading Flamapy…" : isAwaiting ? "Working…" : "Ready"}
        </span>
        {validation && (
          <button className={item} onClick={onShowProblems} title="Show problems">
            {validation.valid ? "✓ Valid model" : `✗ ${problemCount} problem${problemCount === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      <div className="flex items-center h-full">
        <button
          className={item}
          onClick={onToggleBackend}
          title={isWasm ? "Running in your browser — click to use a remote API" : `Remote API: ${restApiUrl} — click to switch to in-browser`}
        >
          {isWasm ? "In-browser" : "Remote API"}
        </button>
        <span className="px-2 h-full flex items-center uppercase">{selectedSolver}</span>
      </div>
    </footer>
  );
}

export default StatusBar;
