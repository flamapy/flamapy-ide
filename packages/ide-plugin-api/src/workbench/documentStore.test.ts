import { describe, expect, it, vi } from 'vitest';

import { createDocumentStore } from './documentStore';

describe('document store', () => {
  it('bumps the version and notifies with the origin on every distinct write', () => {
    const doc = createDocumentStore('a');
    const listener = vi.fn();
    doc.onDidChange(listener);
    doc.setText('b', 'editor');
    doc.setText('c', 'acme.diagram');
    expect(doc.getText()).toBe('c');
    expect(doc.version).toBe(2);
    expect(listener).toHaveBeenNthCalledWith(1, { text: 'b', version: 1, origin: 'editor' });
    expect(listener).toHaveBeenNthCalledWith(2, { text: 'c', version: 2, origin: 'acme.diagram' });
  });

  it('ignores identical writes (no version bump, no echo)', () => {
    const doc = createDocumentStore('same');
    const listener = vi.fn();
    doc.onDidChange(listener);
    doc.setText('same', 'editor');
    expect(doc.version).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('tracks dirty until markSaved', () => {
    const doc = createDocumentStore();
    expect(doc.dirty).toBe(false);
    doc.setText('x', 'editor');
    expect(doc.dirty).toBe(true);
    doc.markSaved();
    expect(doc.dirty).toBe(false);
  });

  it('unsubscribing stops notifications', () => {
    const doc = createDocumentStore();
    const listener = vi.fn();
    const subscription = doc.onDidChange(listener);
    subscription.dispose();
    doc.setText('x', 'editor');
    expect(listener).not.toHaveBeenCalled();
  });
});
