import { useState, type PointerEvent } from 'react';

import type { SidebarPanelDescriptor } from '@flamapy/ide-plugin-api';

// @ts-expect-error untyped JSX (shell component)
import ErrorBoundary from '../../components/ErrorBoundary';
import { PANEL_WIDTH_LIMITS, type Side } from '../sidePanels';

const iconButton =
  'w-6 h-6 grid place-items-center rounded text-gray-500 dark:text-gray-400 hover:bg-black/[.06] dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-gray-100';

/**
 * The panel showing on one side, in the shell's frame: a header with its title and the
 * move / close buttons, its content, and a drag handle on the editor-facing edge.
 */
export function SidebarSlot({
  panel,
  side,
  width,
  onClose,
  onMove,
  onResize,
}: {
  panel: SidebarPanelDescriptor | undefined;
  side: Side;
  width: number;
  onClose(panel: SidebarPanelDescriptor): void;
  onMove(panel: SidebarPanelDescriptor): void;
  onResize(panel: SidebarPanelDescriptor, width: number): void;
}) {
  // Width while dragging; committed (and remembered) on release.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  if (!panel) {
    return null;
  }
  const other = side === 'left' ? 'right' : 'left';

  function startResize(event: PointerEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    const startX = event.clientX;
    const startWidth = width;
    const direction = side === 'left' ? 1 : -1;
    target.setPointerCapture(event.pointerId);
    const widthAt = (x: number) =>
      Math.min(PANEL_WIDTH_LIMITS.max, Math.max(PANEL_WIDTH_LIMITS.min, startWidth + (x - startX) * direction));
    target.onpointermove = (move) => setDragWidth(widthAt(move.clientX));
    target.onpointerup = (up) => {
      target.onpointermove = null;
      target.onpointerup = null;
      setDragWidth(null);
      onResize(panel!, widthAt(up.clientX));
    };
  }

  return (
    <aside
      aria-label={panel.title}
      style={{ width: dragWidth ?? width }}
      className={`relative shrink-0 flex flex-col min-h-0 bg-panel dark:bg-gray-900 text-neutral-900 dark:text-gray-100 border-black/10 dark:border-white/10 ${
        side === 'left' ? 'border-r' : 'border-l'
      }`}
    >
      <header className="flex items-center gap-1 pl-3 pr-1.5 h-9 shrink-0">
        <h2 className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {panel.title}
        </h2>
        <button
          className={iconButton}
          title={`Move to the ${other} side`}
          aria-label={`Move ${panel.title} to the ${other} side`}
          onClick={() => onMove(panel)}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>
        <button className={iconButton} title="Close" aria-label={`Close ${panel.title}`} onClick={() => onClose(panel)}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-3 pb-3">
        <ErrorBoundary>
          <panel.component />
        </ErrorBoundary>
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${panel.title}`}
        onPointerDown={startResize}
        className={`absolute top-0 h-full w-1.5 cursor-ew-resize z-20 hover:bg-accent/30 ${
          side === 'left' ? 'right-0' : 'left-0'
        }`}
      />
    </aside>
  );
}
