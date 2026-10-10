// A value kept on the phone (localStorage) that React screens can read and change. Reads go through
// useSyncExternalStore, so the server render and hydration use the fallback and the saved value
// arrives right after, with no setState-in-effect. If storage is blocked (private mode, quota), the
// value still lives in memory for this visit.
import { useSyncExternalStore } from 'react';

export interface LocalStore<T> {
  get(): T;
  set(update: T | ((old: T) => T)): void;
  subscribe(listener: () => void): () => void;
  use(): T;
}

export function localStore<T extends object>(key: string, fallback: T, clean: (saved: unknown) => T = (saved) => ({ ...fallback, ...(saved as T) })): LocalStore<T> {
  let raw: string | null | undefined;
  let value = fallback;
  const listeners = new Set<() => void>();

  function stored(): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function get(): T {
    if (typeof window === 'undefined') return fallback;
    const now = stored();
    if (now !== raw) {
      raw = now;
      try {
        value = now ? clean(JSON.parse(now)) : fallback;
      } catch {
        value = fallback;
      }
    }
    return value;
  }

  function set(update: T | ((old: T) => T)) {
    const next = typeof update === 'function' ? (update as (old: T) => T)(get()) : update;
    const text = JSON.stringify(next);
    try {
      localStorage.setItem(key, text);
      raw = text;
    } catch {
      raw = stored(); // not saved; keep the new value in memory until the stored one changes
    }
    value = next;
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }

  return {
    get,
    set,
    subscribe,
    use: function useLocalStore() {
      return useSyncExternalStore(subscribe, get, () => fallback);
    },
  };
}
