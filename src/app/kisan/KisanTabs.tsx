'use client';

// The four Kisan tabs (K1) on the shared bottom bar (src/components/BottomTabs.tsx). The tab lives in
// the URL (/kisan?tab=help), so a link in an SMS can open it and the back button goes to the previous tab.
import React from 'react';

import { BottomTabs, tabFromSearch, useUrlTab } from '../../components/BottomTabs';
import type { Language } from './kisanApi';
import { say, type StringKey } from './strings';

export const TABS = ['plan', 'machines', 'shop', 'help'] as const;
export type Tab = (typeof TABS)[number];

const GREEN = '#15803d';

const LABELS: Record<Tab, { icon: string; key: StringKey }> = {
  plan: { icon: '💬', key: 'tabPlan' },
  machines: { icon: '🚜', key: 'tabMachines' },
  shop: { icon: '🛒', key: 'tabShop' },
  help: { icon: '📞', key: 'tabHelp' },
};

export function tabFrom(search: string): Tab {
  return tabFromSearch(search, TABS);
}

export function useTab(): [Tab, (tab: Tab) => void] {
  return useUrlTab(TABS);
}

export function KisanTabs({ tab, onChange, language }: { tab: Tab; onChange: (tab: Tab) => void; language: Language }) {
  return (
    <BottomTabs
      tabs={TABS.map((t) => ({ id: t, icon: LABELS[t].icon, label: say(LABELS[t].key, language) }))}
      current={tab}
      onChange={onChange}
      prefix="kisan"
      label={say('tabs', language)}
      accent={GREEN}
    />
  );
}
