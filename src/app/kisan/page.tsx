'use client';

// Kisan Saathi (P1): four tabs along the bottom (K1). Plan is the conversation with the agent; Machines
// holds the farm card, machine photos and the "is it enough?" check; Shop and Help come next. Every
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
import { MachinePhotos } from './MachinePhotos';
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

  const confirmed = useCallback((readback: Readback) => {
    farmStore.set((farm) => mergeFromChat(farm, farmFromReadback(readback), machinesFromReadback(readback)));
  }, []);
  // A new conversation starts from what the farm card and machine photos already say (K9).
  const startFrom = useCallback(() => farmHint(farmStore.get()), []);

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
        <Soon
          text="helpSoon"
          language={lang}
          extra={
            <p style={{ margin: '0.75rem 0 0', fontSize: '1.05rem', fontWeight: 700, color: '#b91c1c' }}>{say('emergency', lang)}</p>
          }
        />
      </Panel>

      <KisanTabs tab={tab} onChange={go} language={lang} />
    </Container>
  );
}
