'use client';

// Kisan Saathi (P1): four tabs along the bottom (K1). Plan is the conversation with the agent; Machines
// holds the farm card, machine photos and the "is it enough?" check; Shop; Help has numbers to call,
// complaints and their tickets. Every
// tab shares the farm's location and profile, kept on the phone (farmProfile.ts). All tabs stay
// mounted, so switching never loses a conversation or a photo half-way through.
import React, { useCallback } from 'react';

import { Badge, Card, Container } from '../../components/ui';
import { useLanguage } from '../../lib/i18n';
import { FarmCard } from './FarmCard';
import { FarmLocationBar } from './FarmLocationBar';
import { farmFromReadback, farmHint, farmStore, machinesFromReadback, mergeFromChat } from './farmProfile';
import { KisanChat } from './KisanChat';
import { USE_MOCKS, type Language, type Readback } from './kisanApi';
import { KisanTabs, useTab, type Tab } from './KisanTabs';
import { MachineCheck } from './MachineCheck';
import { ComplaintSheet } from './ComplaintSheet';
import { farmDistrict } from './help';
import { Helplines } from './Helplines';
import { MachinePhotos } from './MachinePhotos';
import { MyTickets } from './MyTickets';
import { Shop } from './Shop';
import { FONT, say, type StringKey } from './strings';

function Panel({ tab, current, children }: { tab: Tab; current: Tab; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`kisan-panel-${tab}`} aria-labelledby={`kisan-tab-${tab}`} hidden={tab !== current}>
      {children}
    </div>
  );
}

function Soon({ text, language, extra }: { text: StringKey; language: Language; extra?: React.ReactNode }) {
  return (
    <Card padding="lg">
      <Badge variant="neutral" size="sm">
        {say('comingSoon', language)}
      </Badge>
      <p style={{ margin: '0.75rem 0 0', fontSize: '1.05rem', lineHeight: 1.5, color: '#334155' }}>{say(text, language)}</p>
      {extra}
    </Card>
  );
}

export default function KisanPage() {
  const { language } = useLanguage();
  const lang: Language = language;
  const [tab, go] = useTab();
  const district = farmDistrict(farmStore.use());

  const confirmed = useCallback((readback: Readback) => {
    farmStore.set((farm) => mergeFromChat(farm, farmFromReadback(readback), machinesFromReadback(readback)));
  }, []);
  // A new conversation starts from what the farm card and machine photos already say (K9).
  const startFrom = useCallback(() => farmHint(farmStore.get()), []);

  return (
    <Container maxWidth="md" style={{ paddingTop: '0.25rem', paddingBottom: '2rem', fontFamily: FONT }}>
      {/* The app header (src/components/AppHeader.tsx) carries the name. */}
      {USE_MOCKS && (
        <Badge variant="warning" size="sm">
          {say('demo', lang)}
        </Badge>
      )}

      <FarmLocationBar language={lang} />

      <Panel tab="plan" current={tab}>
        <KisanChat onConfirmed={confirmed} farm={startFrom} />
      </Panel>

      <Panel tab="machines" current={tab}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <FarmCard language={lang} />
          <MachinePhotos language={lang} />
          <MachineCheck language={lang} onGo={go} />
        </div>
      </Panel>

      <Panel tab="shop" current={tab}>
        <Shop language={lang} />
      </Panel>

      <Panel tab="help" current={tab}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Helplines district={district} language={lang} />
          <ComplaintSheet language={lang} />
          <MyTickets language={lang} />
        </div>
      </Panel>

      <KisanTabs tab={tab} onChange={go} language={lang} />
    </Container>
  );
}
