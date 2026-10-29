import type { ContributionStore, ViewDescriptor } from '@flamapy/ide-plugin-api';

// @ts-expect-error untyped JSX (shell component)
import ErrorBoundary from '../../components/ErrorBoundary';
import { useContributionStore } from '../useContributionStore';

/**
 * Renders plugin-contributed main views. The active one renders normally; views marked
 * `keepMounted` stay in the tree (hidden) so expensive components survive tab switches.
 */
export function ViewOutlet({
  store,
  activeViewId,
}: {
  store: ContributionStore<ViewDescriptor>;
  activeViewId: string;
}) {
  const views = useContributionStore(store);
  return (
    <>
      {views.map((view) => {
        const active = view.id === activeViewId;
        if (!active && !view.keepMounted) {
          return null;
        }
        return (
          <div key={view.id} className={active ? 'flex flex-1 flex-col overflow-auto' : 'hidden'}>
            <ErrorBoundary>
              <view.component />
            </ErrorBoundary>
          </div>
        );
      })}
    </>
  );
}
