import type { Disposable, DocumentChange, DocumentStore } from '../types';

/**
 * The shell-owned UVL document: the single source of truth for the model text.
 *
 * Monaco (the source view) writes with origin 'editor'; imports, share-link restores and
 * plugins write with their own origins so consumers can tell their echo from foreign
 * edits. Persistence to localStorage stays a caller concern (the shell
 * already persists on validation and collab sessions must not persist locally).
 */
export function createDocumentStore(initialText = ''): DocumentStore {
  let text = initialText;
  let version = 0;
  let dirty = false;
  const listeners = new Set<(change: DocumentChange) => void>();

  return {
    getText: () => text,
    get version() {
      return version;
    },
    get dirty() {
      return dirty;
    },
    setText(nextText: string, origin: string): void {
      if (nextText === text) {
        return;
      }
      text = nextText;
      version += 1;
      dirty = true;
      const change: DocumentChange = { text, version, origin };
      for (const listener of [...listeners]) {
        listener(change);
      }
    },
    markSaved(): void {
      dirty = false;
    },
    onDidChange(listener: (change: DocumentChange) => void): Disposable {
      listeners.add(listener);
      return { dispose: () => void listeners.delete(listener) };
    },
  };
}
