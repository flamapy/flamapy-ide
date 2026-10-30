/* eslint-disable react/prop-types */

// Thin vertical icon rail (VSCode activity bar). At the top, one button per side panel
// contributed by plugins (left-side panels, then right-side ones): each side shows one
// panel at a time, and the active ones get the accent border. At the bottom, a
// puzzle-piece opens the Plugins view and a gear opens the compute backend settings.
function RailButton({ active, onClick, title, label, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={label ?? title}
      aria-pressed={active}
      className={`relative w-12 h-12 grid place-items-center transition-colors ${
        active
          ? "text-accent dark:text-white"
          : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
      }`}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" />}
      {children}
    </button>
  );
}

function initials(title) {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function PanelButton({ panel, onToggle }) {
  const where = panel.side === "left" ? "left" : "right";
  return (
    <RailButton
      active={panel.active}
      onClick={() => onToggle(panel.id)}
      title={`${panel.title} (${where} side)`}
      label={panel.title}
    >
      {panel.icon ?? <span className="text-[11px] font-semibold">{initials(panel.title)}</span>}
    </RailButton>
  );
}

function ActivityBar({ panels = [], onTogglePanel, onOpenBackend, pluginsOpen, onOpenPlugins }) {
  const left = panels.filter((panel) => panel.side === "left");
  const right = panels.filter((panel) => panel.side === "right");
  return (
    <nav
      aria-label="Activity bar"
      className="w-12 shrink-0 flex flex-col items-center justify-between bg-panel dark:bg-gray-900 border-r border-black/10 dark:border-white/10 py-1"
    >
      <div className="flex flex-col items-center">
        {left.map((panel) => (
          <PanelButton key={panel.id} panel={panel} onToggle={onTogglePanel} />
        ))}
        {left.length > 0 && right.length > 0 && (
          <div className="w-6 h-px my-1 bg-black/10 dark:bg-white/10" aria-hidden="true" />
        )}
        {right.map((panel) => (
          <PanelButton key={panel.id} panel={panel} onToggle={onTogglePanel} />
        ))}
      </div>
      <div className="flex flex-col items-center">
        <RailButton active={pluginsOpen} onClick={onOpenPlugins} title="Plugins">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.5 4.5a1.5 1.5 0 113 0V6h2.25A1.25 1.25 0 0117.25 7.25V9.5h1.5a1.5 1.5 0 010 3h-1.5v3.25A1.25 1.25 0 0116 17h-3.25v-1.5a1.5 1.5 0 00-3 0V17H6.5A1.5 1.5 0 015 15.5V12.5H6.5a1.5 1.5 0 000-3H5V7.25A1.25 1.25 0 016.25 6H10.5V4.5z" />
          </svg>
        </RailButton>
        <RailButton active={false} onClick={onOpenBackend} title="Compute backend settings">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </RailButton>
      </div>
    </nav>
  );
}

export default ActivityBar;
