'use client';

// The tab bar along the bottom of the phone, shared by Kisan Saathi, Saans Shala and Ghar ki Hawa so the
// three modules look and work the same. The tab lives in the URL (?tab=rooms), so a link can open it
// and the back button goes to the previous tab; the first tab has no ?tab. Panels stay mounted when
// hidden, so a tab keeps what was typed and fetched in it.
import React, { useCallback, useEffect, useSyncExternalStore } from 'react';

export interface TabItem<T extends string> {
  id: T;
  icon: string;
  label: string;
}

export const BAR_HEIGHT = '4.25rem';

/** The tab named in a query string, or the first tab. */
export function tabFromSearch<T extends string>(search: string, tabs: readonly T[]): T {
  const t = new URLSearchParams(search).get('tab');
  return (tabs as readonly string[]).includes(t ?? '') ? (t as T) : tabs[0];
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

/** The current tab and a way to change it (pushes a history entry and scrolls to the top). */
export function useUrlTab<T extends string>(tabs: readonly T[]): [T, (tab: T) => void] {
  const tab = useSyncExternalStore(subscribe, () => tabFromSearch(window.location.search, tabs), () => tabs[0]);
  const go = useCallback(
    (next: T) => {
      if (next === tabFromSearch(window.location.search, tabs)) return;
      const url = new URL(window.location.href);
      if (next === tabs[0]) url.searchParams.delete('tab');
      else url.searchParams.set('tab', next);
      window.history.pushState(null, '', url);
      listeners.forEach((l) => l());
      window.scrollTo({ top: 0 });
    },
    [tabs],
  );
  return [tab, go];
}

/** One tab's content. Hidden tabs stay mounted. */
export function TabPanel<T extends string>({ id, current, prefix, children }: { id: T; current: T; prefix: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`${prefix}-panel-${id}`} aria-labelledby={`${prefix}-tab-${id}`} hidden={id !== current}>
      {children}
    </div>
  );
}

export function BottomTabs<T extends string>({
  tabs,
  current,
  onChange,
  prefix,
  label,
  accent,
}: {
  tabs: readonly TabItem<T>[];
  current: T;
  onChange: (tab: T) => void;
  /** Ids are `${prefix}-tab-${id}`, matching TabPanel's `${prefix}-panel-${id}`. */
  prefix: string;
  /** What the bar is, for screen readers. */
  label: string;
  /** The module's colour for the chosen tab. */
  accent: string;
}) {
  // The bar is fixed to the bottom: lift the shell's floating Report button above it, and pad the
  // page so the footer isn't hidden underneath.
  useEffect(() => {
    const root = document.documentElement.style;
    const body = document.body.style;
    const before = body.paddingBottom;
    root.setProperty('--saans-bottom-bar', BAR_HEIGHT);
    body.paddingBottom = `calc(${BAR_HEIGHT} + env(safe-area-inset-bottom, 0px))`;
    return () => {
      root.removeProperty('--saans-bottom-bar');
      body.paddingBottom = before;
    };
  }, []);

  // Arrow keys move between tabs, as screen-reader users expect of a tab list.
  function keys(e: React.KeyboardEvent, i: number) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = tabs[(i + step + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(`${prefix}-tab-${next.id}`)?.focus();
  }

  return (
    <nav
      aria-label={label}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        boxShadow: '0 -4px 12px rgba(15, 23, 42, 0.06)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div role="tablist" style={{ maxWidth: '48rem', margin: '0 auto', display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t, i) => {
          const on = t.id === current;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${prefix}-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`${prefix}-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => keys(e, i)}
              style={{
                minHeight: BAR_HEIGHT,
                minWidth: 0,
                border: 'none',
                background: on ? `color-mix(in srgb, ${accent} 8%, #ffffff)` : 'transparent',
                boxShadow: on ? `inset 0 3px 0 ${accent}` : 'none',
                color: on ? accent : '#475569',
                fontWeight: on ? 700 : 500,
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                alignContent: 'center',
                gap: '0.15rem',
                padding: '0.4rem 0.2rem',
                transition: 'background 150ms, color 150ms',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '1.35rem', lineHeight: 1, transform: on ? 'scale(1.1)' : 'none', transition: 'transform 150ms' }}>
                {t.icon}
              </span>
              <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
