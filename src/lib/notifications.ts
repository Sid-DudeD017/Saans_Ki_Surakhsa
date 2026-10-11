// The bell's notifications, kept on this phone (localStorage) so "read" survives a reload. They come from
// real events: a report or a farmer's complaint you sent (lib/api.ts), a change in its status
// (components/NotificationWatcher.tsx), and the air near you turning poor or worse (components/AppHeader.tsx).
import { useSyncExternalStore } from 'react';

export type Severity = 'info' | 'warning' | 'urgent';

type Lang = 'en' | 'hi' | 'pa';
/** Text in all three languages, or plain text (what a server sent, say). */
export type Text = string | Record<Lang, string>;

export const textIn = (t: Text, lang: string): string => (typeof t === 'string' ? t : t[lang as Lang] ?? t.en);

export interface AppNotification {
  /** Also the de-duplication key: notifying an id that's already here does nothing. */
  id: string;
  title: Text;
  message: Text;
  severity: Severity;
  /** ISO time it happened. */
  at: string;
  read: boolean;
  /** Where tapping it goes. */
  href?: string;
}

const KEY = 'saans_notifications_v1';
const MAX = 50;
const EMPTY: AppNotification[] = [];
const listeners = new Set<() => void>();

let lastRaw: string | null | undefined;
let lastList: AppNotification[] = EMPTY;

function read(): AppNotification[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return lastList;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    try {
      const parsed = raw ? (JSON.parse(raw) as AppNotification[]) : EMPTY;
      lastList = Array.isArray(parsed) ? parsed.filter((n) => n && typeof n.id === 'string') : EMPTY;
    } catch {
      lastList = EMPTY;
    }
  }
  return lastList;
}

function write(list: AppNotification[]) {
  const next = list.slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    lastRaw = JSON.stringify(next);
    lastList = next;
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export const notifications = {
  /** Newest first. Empty until the page has read this phone's storage. */
  use(): AppNotification[] {
    return useSyncExternalStore(subscribe, read, () => EMPTY);
  },
  useUnread(): number {
    return useSyncExternalStore(
      subscribe,
      () => read().filter((n) => !n.read).length,
      () => 0,
    );
  },
  list: read,
  /** Adds a notification unless one with this id is already here. Returns whether it was added. */
  notify(n: Omit<AppNotification, 'read' | 'at'> & { at?: string }): boolean {
    if (typeof window === 'undefined') return false;
    const list = read();
    if (list.some((x) => x.id === n.id)) return false;
    write([{ ...n, at: n.at ?? new Date().toISOString(), read: false }, ...list]);
    return true;
  },
  markRead(id: string) {
    const list = read();
    if (list.some((n) => n.id === id && !n.read)) write(list.map((n) => (n.id === id ? { ...n, read: true } : n)));
  },
  markAllRead() {
    const list = read();
    if (list.some((n) => !n.read)) write(list.map((n) => ({ ...n, read: true })));
  },
  clear() {
    write([]);
  },
};

const AGO = {
  now: { en: 'Just now', hi: 'अभी', pa: 'ਹੁਣੇ' },
  min: { en: '{n} min ago', hi: '{n} मिनट पहले', pa: '{n} ਮਿੰਟ ਪਹਿਲਾਂ' },
  hour: { en: '{n} h ago', hi: '{n} घंटे पहले', pa: '{n} ਘੰਟੇ ਪਹਿਲਾਂ' },
  day: { en: '{n} d ago', hi: '{n} दिन पहले', pa: '{n} ਦਿਨ ਪਹਿਲਾਂ' },
};

/** How long ago, in the reader's language: "Just now", "5 min ago", "3 h ago", "2 d ago". */
export function ago(iso: string, lang: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  const say = (k: keyof typeof AGO, n = 0) => textIn(AGO[k], lang).replace('{n}', String(n));
  if (!Number.isFinite(s) || s < 60) return say('now');
  const m = Math.round(s / 60);
  if (m < 60) return say('min', m);
  const h = Math.round(m / 60);
  if (h < 24) return say('hour', h);
  return say('day', Math.round(h / 24));
}
