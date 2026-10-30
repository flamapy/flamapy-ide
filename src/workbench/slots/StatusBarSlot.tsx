import type { ContributionStore, StatusBarItemDescriptor } from '@flamapy/ide-plugin-api';

import { useContributionStore } from '../useContributionStore';

/** Plugin-contributed status-bar items for one side of the bar. */
export function StatusBarSlot({
  store,
  side,
}: {
  store: ContributionStore<StatusBarItemDescriptor>;
  side: 'left' | 'right';
}) {
  const items = useContributionStore(store).filter((item) => item.side === side);
  return (
    <>
      {items.map((item) => (
        <item.component key={item.id} />
      ))}
    </>
  );
}
