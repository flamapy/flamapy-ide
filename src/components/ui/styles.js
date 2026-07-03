// Shared VSCode-style / featuredraw-inspired class strings.
//
// These are plain Tailwind class strings (not @apply) so Tailwind's JIT picks
// them up via the `content` glob. Light surfaces by default with `dark:`
// variants, matching the app's `darkMode: "class"` strategy. The accent is
// VSCode blue (#2b6cff). Keep these as the single source of truth for the
// IDE chrome so panels, toolbars and menus stay visually consistent.

// Compact toolbar / menu action button (icon + label).
export const vsBtn =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] text-gray-700 dark:text-gray-200 hover:bg-black/[.06] dark:hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

// Primary (accent) action button.
export const vsBtnPrimary =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium bg-[#2b6cff] text-white hover:bg-[#1d5cf0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

// Square icon-only button (activity bar, tab close, etc.).
export const vsIconBtn =
  "w-7 h-7 grid place-items-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-black/[.06] dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

// Thin vertical divider between toolbar groups.
export const vsGroupSep = "w-px self-stretch my-1 bg-black/10 dark:bg-white/10";

// Small caption above a toolbar group.
export const vsGroupLabel =
  "text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 leading-none";

// Card container + header (model info, side panels).
export const vsCard =
  "bg-white/95 dark:bg-gray-800 border border-black/10 dark:border-white/10 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]";
export const vsCardHeader =
  "flex items-center gap-2 px-3 py-2 border-b border-black/10 dark:border-white/10 bg-black/[.02] dark:bg-white/[.03]";
export const vsCardTitle =
  "text-[11px] font-semibold uppercase tracking-wider text-black/70 dark:text-gray-300 flex-1";

// Small status / type pill.
export const chip =
  "px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 text-black/60 dark:text-gray-300";

// The VSCode accent blue, exported for inline styles where a class won't do.
export const ACCENT = "#2b6cff";
