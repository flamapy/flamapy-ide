import type { ContributionStore, SidebarPanelDescriptor } from '@flamapy/ide-plugin-api';

import { useContributionStore } from '../useContributionStore';

/**
 * Plugin-contributed sidebar panels for one side of the workbench. `visible` is the
 * shell's per-side toggle (the activity-bar buttons).
 */
export function SidebarSlot({
  store,
  side,
  visible = true,
}: {
  store: ContributionStore<SidebarPanelDescriptor>;
  side: 'left' | 'right';
  visible?: boolean;
}) {
  const panels = useContributionStore(store).filter((panel) => panel.side === side);
  if (!visible) {
    return null;
  }
  return (
    <>
      {panels.map((panel) => (
        <panel.component key={panel.id} />
      ))}
    </>
  );
}
