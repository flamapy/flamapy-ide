import { useSyncExternalStore } from 'react';

import type { ContributionStore } from '@flamapy/ide-plugin-api';

/** Chrome components re-render exactly when a plugin registers/disposes a contribution. */
export function useContributionStore<T extends { id: string; order?: number }>(
  store: ContributionStore<T>,
): readonly T[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
