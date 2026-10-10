'use client';

// Kisan Saathi (P1): four tabs along the bottom (K1). Plan is the conversation with the agent; Machines
// holds the farm card, machine photos and the "is it enough?" check; Shop; Help has numbers to call,
// complaints and their tickets. Every
// tab shares the farm's location and profile, kept on the phone (farmProfile.ts). All tabs stay
// mounted, so switching never loses a conversation or a photo half-way through.
import React, { useCallback, useState } from 'react';

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
  // "Ask Saathi to book it" on the Machines and Shop tabs: open the conversation and send the request there.
  const [ask, setAsk] = useState<{ id: number; text: string } | null>(null);
  const askSaathi = useCallback(
    (text: string) => {
      setAsk({ id: Date.now(), text });
      go('plan');
    },
    [go],
  );

  return (
    <Container maxWidth="md" style={{ paddingTop: '1.5rem', paddingBottom: '2rem', fontFamily: FONT }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0f172a' }}>🌾 {say('title', lang)}</h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.95rem', color: '#475569' }}>{say('subtitle', lang)}</p>
        {USE_MOCKS && (
          <div style={{ marginTop: '0.4rem' }}>
            <Badge variant="warning" size="sm">
              {say('demo', lang)}
            </Badge>
          </div>
        )}
      </header>

      <FarmLocationBar language={lang} />

      <Panel tab="plan" current={tab}>
        <KisanChat onConfirmed={confirmed} farm={startFrom} ask={ask} />
      </Panel>

      <Panel tab="machines" current={tab}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <MachineCheck language={lang} onGo={go} onAsk={askSaathi} />
          <FarmCard language={lang} />
          <MachinePhotos language={lang} />
        </div>
      </Panel>

      <Panel tab="shop" current={tab}>
        <Shop language={lang} onAsk={askSaathi} />
      </Panel>

      <Panel tab="help" current={tab}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Helplines district={district} language={lang} />
          <ComplaintSheet language={lang} />
          <MyTickets district={district} language={lang} />
        </div>
      </Panel>

      <KisanTabs tab={tab} onChange={go} language={lang} />
    </Container>
  );
}
