/* eslint-disable react/prop-types */

// VSCode-style editor tab strip driving `currentView`. `tabs` is [{ label, value }];
// selecting a tab calls `onSelect(tab)` (EditorPage's toggleView), which keeps all
// the existing per-view side effects (chart computation, configurator panel, etc.).
function EditorTabs({ tabs, currentView, onSelect }) {
  return (
    <div className="h-9 flex items-stretch gap-0.5 px-1 bg-tabbar dark:bg-gray-900 border-b border-black/10 dark:border-white/10 overflow-x-auto select-none shrink-0">
      {tabs.map((t) => {
        const active = currentView === t.value;
        return (
          <button
            key={t.value}
            onClick={() => onSelect(t)}
            className={`group relative flex items-center gap-1.5 px-3 text-[12.5px] border-t-2 transition-colors ${
              active
                ? "bg-white dark:bg-gray-800 border-accent text-gray-900 dark:text-white"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:bg-black/[.04] dark:hover:bg-white/[.05] hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                active ? "bg-accent" : "bg-black/20 dark:bg-white/20"
              }`}
            />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default EditorTabs;
