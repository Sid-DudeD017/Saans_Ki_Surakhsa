'use client';

// The four Kisan tabs (K1) and the bar along the bottom of the phone. The tab lives in the URL
// (/kisan?tab=help), so a link in an SMS can open it and the back button goes to the previous tab.
import React, { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { Language } from './kisanApi';
import { say, type StringKey } from './strings';

export const TABS = ['plan', 'machines', 'shop', 'help'] as const;
export type Tab = (typeof TABS)[number];

const GREEN = '#15803d';
const BAR_HEIGHT = '4.25rem';

const LABELS: Record<Tab, { icon: string; key: StringKey }> = {
  plan: { icon: '💬', key: 'tabPlan' },
  machines: { icon: '🚜', key: 'tabMachines' },
  shop: { icon: '🛒', key: 'tabShop' },
  help: { icon: '📞', key: 'tabHelp' },
};

export function tabFrom(search: string): Tab {
  const t = new URLSearchParams(search).get('tab');
  return (TABS as readonly string[]).includes(t ?? '') ? (t as Tab) : 'plan';
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

export function useTab(): [Tab, (tab: Tab) => void] {
  const tab = useSyncExternalStore(subscribe, () => tabFrom(window.location.search), () => 'plan' as Tab);
  const go = useCallback((next: Tab) => {
    if (next === tabFrom(window.location.search)) return;
    const url = new URL(window.location.href);
    if (next === 'plan') url.searchParams.delete('tab');
    else url.searchParams.set('tab', next);
    window.history.pushState(null, '', url);
    listeners.forEach((l) => l());
    window.scrollTo({ top: 0 });
  }, []);
  return [tab, go];
}

export function KisanTabs({ tab, onChange, language }: { tab: Tab; onChange: (tab: Tab) => void; language: Language }) {
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

  return (
    <nav
      aria-label={say('tabs', language)}
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
      <div role="tablist" style={{ maxWidth: '48rem', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {TABS.map((t) => {
          const on = t === tab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              id={`kisan-tab-${t}`}
              aria-selected={on}
              aria-controls={`kisan-panel-${t}`}
              onClick={() => onChange(t)}
              style={{
                minHeight: BAR_HEIGHT,
                border: 'none',
                background: 'transparent',
                boxShadow: on ? `inset 0 3px 0 ${GREEN}` : 'none',
                color: on ? GREEN : '#475569',
                fontWeight: on ? 700 : 500,
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                alignContent: 'center',
                gap: '0.15rem',
                padding: '0.4rem 0.25rem',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '1.35rem', lineHeight: 1 }}>
                {LABELS[t].icon}
              </span>
              <span>{say(LABELS[t].key, language)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
