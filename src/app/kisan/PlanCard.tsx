'use client';

// The read-back as a card: every number the agent understood, in big digits, so the farmer can check it
// by eye while the same details are read aloud. "Yes" files the request; "No" goes back to the agent.
import React, { useRef, useState } from 'react';

import { Button, Card } from '../../components/ui';
import { audioUrl, type CardItem, type Language, type Readback } from './kisanApi';
import { cardIcon, cardLabel, say } from './strings';

const GREEN = '#15803d';
const AMBER = '#b45309';

function Percent({ value }: { value: string }) {
  const pct = Math.max(0, Math.min(100, parseFloat(value)));
  return (
    <div aria-hidden style={{ height: 8, background: '#e2e8f0', borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: pct >= 90 ? GREEN : AMBER }} />
    </div>
  );
}

function Row({ item, language }: { item: CardItem; language: Language }) {
  const short = item.kind === 'short';
  const isPercent = item.kind === 'coverage' || item.kind === 'coverage_after';
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '2.25rem 1fr',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '0.75rem 0',
        borderTop: '1px solid #e2e8f0',
      }}
    >
      <span aria-hidden style={{ fontSize: '1.6rem', textAlign: 'center' }}>{cardIcon(item.icon)}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', color: '#475569' }}>
          {cardLabel(item.kind, language)}
          {item.label && item.kind !== 'paddy' ? ` · ${item.label}` : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
              color: short ? AMBER : '#0f172a',
            }}
          >
            {item.value}
          </span>
          {item.unit && <span style={{ fontSize: '1.1rem', color: '#334155' }}>{item.unit}</span>}
        </div>
        {item.kind === 'booking' && (
          <div style={{ fontSize: '0.875rem', color: '#334155', marginTop: 2 }}>
            {item.chc}
            {item.acres !== undefined && ` · ${item.acres} ${say('acres', language)}`}
            {item.cost_inr !== undefined && ` · ₹${item.cost_inr.toLocaleString('en-IN')}`}
          </div>
        )}
        {isPercent && <Percent value={item.value} />}
      </div>
    </li>
  );
}

export function PlanCard({
  readback,
  language,
  busy,
  onAnswer,
}: {
  readback: Readback;
  language: Language;
  busy: boolean;
  onAnswer: (yes: boolean) => void;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const src = audioUrl(readback);

  const listen = () => {
    if (!src) return;
    audio.current ??= new Audio(src);
    audio.current.onended = () => setPlaying(false);
    audio.current.currentTime = 0;
    audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <Card padding="lg" style={{ borderColor: GREEN, borderWidth: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>{say('planTitle', language)}</h2>
        {src && (
          <Button variant="outline" size="lg" onClick={listen} aria-pressed={playing}>
            {playing ? '🔊' : '▶'} {say('listen', language)}
          </Button>
        )}
      </div>
      <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0 }}>
        {readback.card.items.map((item, i) => (
          <Row key={`${item.kind}-${i}`} item={item} language={language} />
        ))}
      </ul>
      <p style={{ margin: '1rem 0 0.75rem', fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>
        {say('confirmQuestion', language)}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '0.75rem' }}>
        <Button size="lg" disabled={busy} onClick={() => onAnswer(true)} style={{ background: GREEN, minHeight: '3.5rem', fontSize: '1.1rem' }}>
          ✓ {say('yes', language)}
        </Button>
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => onAnswer(false)} style={{ minHeight: '3.5rem', fontSize: '1.1rem' }}>
          ✎ {say('no', language)}
        </Button>
      </div>
    </Card>
  );
}
