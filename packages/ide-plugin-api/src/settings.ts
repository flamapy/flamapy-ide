import type { PluginSettings } from './types';

/**
 * localStorage-backed settings, one namespace per plugin id
 * (key layout: `flamapy-ide.<pluginId>.<key>`, JSON-encoded values).
 * Falls back to in-memory storage when localStorage is unavailable (tests, SSR).
 */
export function createPluginSettings(namespace: string): PluginSettings {
  const memory = new Map<string, string>();

  function storageKey(key: string): string {
    return `flamapy-ide.${namespace}.${key}`;
  }

  function read(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(storageKey(key)) ?? memory.get(storageKey(key)) ?? null;
    } catch {
      return memory.get(storageKey(key)) ?? null;
    }
  }

  function write(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(storageKey(key), value);
    } catch {
      memory.set(storageKey(key), value);
    }
  }

  return {
    get<T>(key: string, fallback: T): T {
      const raw = read(key);
      if (raw === null) {
        return fallback;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set<T>(key: string, value: T): void {
      write(key, JSON.stringify(value));
    },
  };
}
