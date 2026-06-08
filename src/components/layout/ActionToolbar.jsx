/* eslint-disable react/prop-types */
import DropdownMenu from "../DropdownMenu";
import Segmented from "../ui/Segmented";
import { vsBtn, vsGroupSep, vsGroupLabel } from "../ui/styles";

// Compact VSCode-style action bar. Stateless: every callback/list is supplied by
// EditorPage. Groups (Structural · Analyze · Export/Share) are separated by thin
// vertical dividers. View switching lives in EditorTabs and compute backend in the
// StatusBar, so they are intentionally not here.

// Dropdown trigger styled to match the slim toolbar buttons.
const dropdownTrigger =
  "inline-flex items-center justify-between gap-1 px-2.5 py-1 text-[12px] rounded-md text-gray-700 dark:text-gray-200 hover:bg-black/[.06] dark:hover:bg-white/10 transition-colors";

function Group({ label, children }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={vsGroupLabel}>{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function ActionToolbar({
  structuralOptions,
  executeAction,
  solverOptions,
  selectedSolver,
  setSelectedSolver,
  analysisOptions,
  exportOptions,
  downloadFile,
  onShareLink,
  shareMessage,
  onUvlhub,
  uvlhubMessage,
  collab,
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-white dark:bg-gray-800 border-b border-black/10 dark:border-white/10 overflow-x-auto whitespace-nowrap shrink-0">
      <Group label="Structural">
        <DropdownMenu
          buttonLabel="Operations"
          options={structuralOptions}
          executeAction={executeAction}
          className={`${dropdownTrigger} min-w-[120px]`}
        />
      </Group>

      <div className={vsGroupSep} />

      <Group label="Automated analysis">
        {solverOptions.length > 0 && (
          <Segmented
            value={selectedSolver}
            onChange={setSelectedSolver}
            options={solverOptions.map((o) => ({ value: o.value, label: o.label }))}
          />
        )}
        <DropdownMenu
          buttonLabel="Operations"
          options={analysisOptions}
          executeAction={executeAction}
          className={`${dropdownTrigger} min-w-[120px]`}
        />
      </Group>

      <div className={vsGroupSep} />

      <Group label="Export & share">
        <DropdownMenu
          buttonLabel="Export"
          options={exportOptions}
          executeAction={downloadFile}
          className={`${dropdownTrigger} min-w-[90px]`}
        />
        <button className={vsBtn} onClick={onShareLink} title="Copy a shareable link to this model">
          Share link
        </button>
        {shareMessage && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">{shareMessage}</span>
        )}
        <button className={vsBtn} onClick={onUvlhub} title="Save this model to UVLHub">
          UVLHub
        </button>
        {uvlhubMessage && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">{uvlhubMessage}</span>
        )}
        {collab?.enabled && (
          <>
            <button className={vsBtn} onClick={collab.onCopySession} title="Copy the collaboration session link">
              Copy session
            </button>
            {collab.copyMessage && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{collab.copyMessage}</span>
            )}
          </>
        )}
        {!collab?.enabled && collab?.available && (
          <>
            <button className={vsBtn} onClick={collab.onStart} title="Start a real-time collaboration session">
              Collaborate
            </button>
            {collab.status && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{collab.status}</span>
            )}
          </>
        )}
      </Group>
    </div>
  );
}

export default ActionToolbar;
