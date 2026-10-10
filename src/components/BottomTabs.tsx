'use client';

// The tab bar floating along the bottom of the phone (a white pill, after Blinkit's), with the round
// Switch button beside it, shared by Kisan Saathi, Saans Shala and Ghar ki Hawa so the
// three modules look and work the same. The tab lives in the URL (?tab=rooms), so a link can open it
// and the back button goes to the previous tab; the first tab has no ?tab. Panels stay mounted when
// hidden, so a tab keeps what was typed and fetched in it.
import React, { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { SpaceId } from '../lib/space';
import { SpaceSwitch } from './SpaceSwitch';

export interface TabItem<T extends string> {
  id: T;
  icon: string;
  label: string;
}

/** One tab's height, and the room the floating bar takes at the bottom of the page. */
export const TAB_HEIGHT = '3.4rem';
export const BAR_SPACE = '5.5rem';

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
  space,
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
  /** Puts the round Switch button beside the bar, for moving to another part of the app. */
  space?: SpaceId;
}) {
  // The bar floats over the bottom of the page: lift the shell's Report button above it (and centre
  // it, globals.css), and pad the page so the last card can scroll clear of it.
  useEffect(() => {
    const root = document.documentElement.style;
    const body = document.body;
    const before = body.style.paddingBottom;
    root.setProperty('--saans-bottom-bar', BAR_SPACE);
    body.style.paddingBottom = `calc(${BAR_SPACE} + env(safe-area-inset-bottom, 0px))`;
    body.dataset.bottomBar = '';
    return () => {
      root.removeProperty('--saans-bottom-bar');
      body.style.paddingBottom = before;
      delete body.dataset.bottomBar;
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
        padding: '0 0.75rem calc(0.6rem + env(safe-area-inset-bottom, 0px))',
        // Only the pill and the button take taps; the page shows (and scrolls) around them.
        pointerEvents: 'none',
      }}
    >
      <div style={{ maxWidth: '40rem', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <div
          role="tablist"
          style={{
            flex: 1,
            minWidth: 0,
            pointerEvents: 'auto',
            display: 'grid',
            gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
            gap: '0.15rem',
            padding: '0.3rem',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '2rem',
            boxShadow: '0 10px 28px rgba(15, 23, 42, 0.16)',
          }}
        >
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
                  minHeight: TAB_HEIGHT,
                  minWidth: 0,
                  border: 'none',
                  borderRadius: '1.6rem',
                  background: on ? `color-mix(in srgb, ${accent} 13%, #ffffff)` : 'transparent',
                  color: on ? '#0f172a' : '#475569',
                  fontWeight: on ? 800 : 500,
                  fontSize: '0.75rem',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  alignContent: 'center',
                  gap: '0.15rem',
                  padding: '0.35rem 0.15rem',
                  transition: 'background 150ms, color 150ms',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: '1.35rem', lineHeight: 1, transform: on ? 'scale(1.12)' : 'none', transition: 'transform 150ms' }}>
                  {t.icon}
                </span>
                <span style={{ maxWidth: '100%', lineHeight: 1.1, textAlign: 'center', overflowWrap: 'anywhere', color: on ? `color-mix(in srgb, ${accent} 80%, #000000)` : undefined }}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
        {space && (
          <div style={{ pointerEvents: 'auto', flex: 'none' }}>
            <SpaceSwitch current={space} />
          </div>
        )}
      </div>
    </nav>
  );
}
