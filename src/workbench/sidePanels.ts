import { createPluginSettings, type SidebarPanelDescriptor } from '@flamapy/ide-plugin-api';

export type Side = 'left' | 'right';

/**
 * What the user chose for the side panels, remembered across sessions:
 * - `active[side]`: the panel shown on that side; `null` = the side is closed;
 *   missing = never chosen, so the side shows its first panel.
 * - `sides[id]`: a panel the user moved away from its default side.
 * - `widths[id]`: a panel's width after the user resized it.
 */
export interface SidePanelLayout {
  active: Partial<Record<Side, string | null>>;
  sides: Record<string, Side>;
  widths: Record<string, number>;
}

export const DEFAULT_PANEL_WIDTH = 300;
export const PANEL_WIDTH_LIMITS = { min: 200, max: 560 } as const;

const settings = createPluginSettings('shell');
const LAYOUT_KEY = 'sidePanels.layout';

export function loadLayout(): SidePanelLayout {
  const stored = settings.get<Partial<SidePanelLayout>>(LAYOUT_KEY, {});
  return { active: stored.active ?? {}, sides: stored.sides ?? {}, widths: stored.widths ?? {} };
}

export function saveLayout(layout: SidePanelLayout): void {
  settings.set(LAYOUT_KEY, layout);
}

export function sideOf(panel: SidebarPanelDescriptor, layout: SidePanelLayout): Side {
  return layout.sides[panel.id] ?? panel.side;
}

export function panelsOn(
  panels: readonly SidebarPanelDescriptor[],
  layout: SidePanelLayout,
  side: Side,
): SidebarPanelDescriptor[] {
  return panels.filter((panel) => sideOf(panel, layout) === side);
}

/** The panel showing on `side`, if any (a chosen panel that is gone falls back to the first). */
export function activePanel(
  panels: readonly SidebarPanelDescriptor[],
  layout: SidePanelLayout,
  side: Side,
): SidebarPanelDescriptor | undefined {
  const choice = layout.active[side];
  if (choice === null) {
    return undefined;
  }
  const candidates = panelsOn(panels, layout, side);
  return candidates.find((panel) => panel.id === choice) ?? candidates[0];
}

/** Show the panel on its side, or close the side when it is the one showing. */
export function togglePanel(
  layout: SidePanelLayout,
  panels: readonly SidebarPanelDescriptor[],
  panel: SidebarPanelDescriptor,
): SidePanelLayout {
  const side = sideOf(panel, layout);
  const showing = activePanel(panels, layout, side)?.id === panel.id;
  return { ...layout, active: { ...layout.active, [side]: showing ? null : panel.id } };
}

/** Show the panel on its side (whatever that side showed before). */
export function showPanel(layout: SidePanelLayout, panel: SidebarPanelDescriptor): SidePanelLayout {
  return { ...layout, active: { ...layout.active, [sideOf(panel, layout)]: panel.id } };
}

/** Move the panel to the other side and show it there. */
export function movePanel(
  layout: SidePanelLayout,
  panels: readonly SidebarPanelDescriptor[],
  panel: SidebarPanelDescriptor,
): SidePanelLayout {
  const from = sideOf(panel, layout);
  const to: Side = from === 'left' ? 'right' : 'left';
  const sides = { ...layout.sides };
  if (panel.side === to) {
    delete sides[panel.id]; // back to its default side
  } else {
    sides[panel.id] = to;
  }
  const active = { ...layout.active, [to]: panel.id };
  if (activePanel(panels, layout, from)?.id === panel.id) {
    delete active[from]; // the side it left shows its first remaining panel
  }
  return { ...layout, sides, active };
}

export function panelWidth(layout: SidePanelLayout, panel: SidebarPanelDescriptor): number {
  return layout.widths[panel.id] ?? DEFAULT_PANEL_WIDTH;
}

export function resizePanel(
  layout: SidePanelLayout,
  panel: SidebarPanelDescriptor,
  width: number,
): SidePanelLayout {
  const clamped = Math.round(
    Math.min(PANEL_WIDTH_LIMITS.max, Math.max(PANEL_WIDTH_LIMITS.min, width)),
  );
  return { ...layout, widths: { ...layout.widths, [panel.id]: clamped } };
}
