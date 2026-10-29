import { describe, expect, it } from 'vitest';

import type { SidebarPanelDescriptor } from '@flamapy/ide-plugin-api';

import {
  activePanel,
  movePanel,
  panelWidth,
  resizePanel,
  showPanel,
  togglePanel,
  type SidePanelLayout,
} from './sidePanels';

const panel = (id: string, side: 'left' | 'right'): SidebarPanelDescriptor => ({
  id,
  title: id,
  side,
  component: () => null,
});

const configurator = panel('configurator', 'left');
const outline = panel('outline', 'left');
const info = panel('info', 'right');
const panels = [configurator, outline, info];
const empty: SidePanelLayout = { active: {}, sides: {}, widths: {} };

describe('side panel layout', () => {
  it('shows the first panel of each side until the user chooses', () => {
    expect(activePanel(panels, empty, 'left')).toBe(configurator);
    expect(activePanel(panels, empty, 'right')).toBe(info);
  });

  it('shows one panel per side: toggling another swaps it, toggling the shown one closes the side', () => {
    let layout = togglePanel(empty, panels, outline);
    expect(activePanel(panels, layout, 'left')).toBe(outline);
    expect(activePanel(panels, layout, 'right')).toBe(info); // the other side is untouched
    layout = togglePanel(layout, panels, outline);
    expect(activePanel(panels, layout, 'left')).toBeUndefined();
    layout = togglePanel(layout, panels, configurator);
    expect(activePanel(panels, layout, 'left')).toBe(configurator);
  });

  it('moves a panel to the other side, where it shows, and back to its default', () => {
    let layout = movePanel(empty, panels, configurator);
    expect(activePanel(panels, layout, 'right')).toBe(configurator);
    expect(activePanel(panels, layout, 'left')).toBe(outline); // first remaining panel
    expect(layout.sides).toEqual({ configurator: 'right' });
    layout = movePanel(layout, panels, configurator);
    expect(layout.sides).toEqual({});
    expect(activePanel(panels, layout, 'left')).toBe(configurator);
  });

  it('falls back to the first panel when the chosen one is gone (plugin turned off)', () => {
    const layout = togglePanel(empty, panels, outline);
    expect(activePanel([configurator, info], layout, 'left')).toBe(configurator);
  });

  it('remembers widths within limits', () => {
    expect(panelWidth(empty, info)).toBe(300);
    expect(panelWidth(resizePanel(empty, info, 9999), info)).toBe(560);
    expect(panelWidth(resizePanel(empty, info, 250.4), info)).toBe(250);
  });

  it('shows a panel on request, e.g. when its plugin opens a related view', () => {
    const closed = togglePanel(empty, panels, configurator); // left side closed
    expect(activePanel(panels, showPanel(closed, outline), 'left')).toBe(outline);
  });
});
