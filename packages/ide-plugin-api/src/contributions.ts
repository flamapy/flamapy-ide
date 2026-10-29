import type { Disposable } from './types';

/**
 * An observable, ordered collection of contributions (views, menus, status items...).
 *
 * `subscribe`/`getSnapshot` match React's `useSyncExternalStore` contract: the snapshot
 * is a cached array identity that only changes when the contents change, so chrome
 * components re-render exactly when a plugin registers or disposes a contribution.
 */
export interface ContributionStore<T extends { id: string; order?: number }> {
  register(item: T): Disposable;
  get(id: string): T | undefined;
  subscribe(listener: () => void): () => void;
  getSnapshot(): readonly T[];
}

export function createContributionStore<
  T extends { id: string; order?: number },
>(): ContributionStore<T> {
  const items = new Map<string, T>();
  const listeners = new Set<() => void>();
  let sequence = 0;
  const insertionOrder = new Map<string, number>();
  let snapshot: readonly T[] = [];

  function rebuild(): void {
    snapshot = Object.freeze(
      [...items.values()].sort((a, b) => {
        const byOrder = (a.order ?? 0) - (b.order ?? 0);
        if (byOrder !== 0) {
          return byOrder;
        }
        return (insertionOrder.get(a.id) ?? 0) - (insertionOrder.get(b.id) ?? 0);
      }),
    );
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    register(item: T): Disposable {
      if (items.has(item.id)) {
        throw new Error(`Contribution '${item.id}' is already registered.`);
      }
      items.set(item.id, item);
      insertionOrder.set(item.id, sequence++);
      rebuild();
      return {
        dispose() {
          if (items.get(item.id) === item) {
            items.delete(item.id);
            insertionOrder.delete(item.id);
            rebuild();
          }
        },
      };
    },
    get(id: string): T | undefined {
      return items.get(id);
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot(): readonly T[] {
      return snapshot;
    },
  };
}
