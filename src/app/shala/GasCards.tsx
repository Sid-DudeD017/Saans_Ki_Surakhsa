// Gas cards (P2): one card per pollutant, saying what it is, where it comes from, and today's sub-index
// in its CPCB colour. The dominant pollutant comes first (gasCards in airQuality.ts).
import React from 'react';

import { CATEGORY_COLOURS, CATEGORY_NAMES, GASES, WORDS, gasCards, unitLabel, type AqiResponse, type GasCard, type Language } from './airQuality';

function Card({ card, language }: { card: GasCard; language: Language }) {
  const gas = GASES[card.pollutant];
  const colour = card.reading ? CATEGORY_COLOURS[card.reading.category] : null;
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        gap: '0.5rem',
        minWidth: 0,
        padding: '1rem',
        borderRadius: '0.75rem',
        background: '#ffffff',
        border: card.dominant && colour ? `2px solid ${colour.fill}` : '1px solid #e2e8f0',
        borderTop: `6px solid ${colour ? colour.fill : '#cbd5e1'}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
          <span aria-hidden style={{ marginRight: '0.35rem' }}>{gas.icon}</span>
          {gas.symbol}
        </span>
        {card.dominant && (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: colour?.ink ?? '#334155' }}>
            {WORDS.biggest[language]}
          </span>
        )}
      </div>
      <div style={{ fontSize: '0.95rem', lineHeight: 1.5, color: '#1e293b' }}>
        <p style={{ margin: 0 }}>{gas.what[language]}</p>
        <p style={{ margin: '0.4rem 0 0', color: '#475569' }}>
          <strong style={{ color: '#334155' }}>{WORDS.from[language]}:</strong> {gas.from[language]}
        </p>
      </div>
      {card.reading && colour ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.5rem',
            flexWrap: 'wrap',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            background: colour.tint,
            color: colour.ink,
          }}
        >
          <strong style={{ fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums' }}>{card.reading.subIndex}</strong>
          <span style={{ fontSize: '0.85rem' }}>
            {WORDS.index[language]} · {CATEGORY_NAMES[card.reading.category][language]} · {Number(card.reading.concentration.toFixed(1))} {unitLabel(card.reading.unit)}
          </span>
        </div>
      ) : (
        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{WORDS.notMeasured[language]}</div>
      )}
    </li>
  );
}

export function GasCards({ aqi, language }: { aqi: AqiResponse; language: Language }) {
  return (
    <section aria-labelledby="gas-cards-title">
      <h3 id="gas-cards-title" style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', color: '#0f172a' }}>
        {WORDS.cardsTitle[language]}
      </h3>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 15rem), 1fr))',
          gap: '0.75rem',
        }}
      >
        {gasCards(aqi).map((card) => (
          <Card key={card.pollutant} card={card} language={language} />
        ))}
      </ul>
    </section>
  );
}
