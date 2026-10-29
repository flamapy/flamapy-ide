import { describe, expect, it, vi } from 'vitest';

import { createContributionStore } from './contributions';

interface Item {
  id: string;
  order?: number;
  label: string;
}

describe('contribution store', () => {
  it('register/dispose updates the snapshot and notifies subscribers', () => {
    const store = createContributionStore<Item>();
    const listener = vi.fn();
    store.subscribe(listener);

    const registration = store.register({ id: 'a', label: 'A' });
    expect(store.getSnapshot().map((item) => item.id)).toEqual(['a']);
    expect(listener).toHaveBeenCalledTimes(1);

    registration.dispose();
    expect(store.getSnapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps a stable snapshot identity between changes (useSyncExternalStore contract)', () => {
    const store = createContributionStore<Item>();
    store.register({ id: 'a', label: 'A' });
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('sorts by order, then registration order', () => {
    const store = createContributionStore<Item>();
    store.register({ id: 'late', label: '', order: 10 });
    store.register({ id: 'first', label: '', order: -1 });
    store.register({ id: 'default-a', label: '' });
    store.register({ id: 'default-b', label: '' });
    expect(store.getSnapshot().map((item) => item.id)).toEqual([
      'first', 'default-a', 'default-b', 'late',
    ]);
  });

  it('rejects duplicate ids; disposing twice is safe', () => {
    const store = createContributionStore<Item>();
    const registration = store.register({ id: 'a', label: '' });
    expect(() => store.register({ id: 'a', label: '' })).toThrow(/already registered/);
    registration.dispose();
    registration.dispose();
    expect(store.getSnapshot()).toEqual([]);
  });
});
