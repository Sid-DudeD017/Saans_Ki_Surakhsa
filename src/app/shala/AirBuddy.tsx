// Air Buddy (P2): a puff of air in today's CPCB colour, whose face follows the category, with one thing
// a child can do about it. Drawn in SVG so it stays sharp on a classroom projector.
import React from 'react';

import { BUDDY, CATEGORY_COLOURS, CATEGORY_NAMES, WORDS, type Category, type Language, type Mood } from './airQuality';

const INK = '#1f2937';

function Face({ mood }: { mood: Mood }) {
  const eyes =
    mood === 'happy' ? (
      <>
        <path d="M44 58 q6 -8 12 0" />
        <path d="M74 58 q6 -8 12 0" />
      </>
    ) : mood === 'unwell' ? (
      <>
        <path d="M44 56 l12 4 M44 60 l12 -4" />
        <path d="M74 56 l12 4 M74 60 l12 -4" />
      </>
    ) : (
      <>
        <circle cx="50" cy="58" r="4.5" fill={INK} stroke="none" />
        <circle cx="80" cy="58" r="4.5" fill={INK} stroke="none" />
      </>
    );
  const brows =
    mood === 'worried' || mood === 'masked' ? (
      <>
        <path d="M42 47 l14 -5" />
        <path d="M88 47 l-14 -5" />
      </>
    ) : null;
  const mouth = {
    happy: <path d="M48 74 q17 16 34 0" />,
    okay: <path d="M52 76 q13 8 26 0" />,
    bothered: <path d="M53 79 h24" />,
    worried: <path d="M52 83 q13 -9 26 0" />,
    unwell: <path d="M52 84 q13 -10 26 0" />,
    masked: null,
  }[mood];
  return (
    <g fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      {eyes}
      {brows}
      {mouth}
      {mood === 'unwell' && <path d="M98 44 q4 7 0 10 q-4 -3 0 -10" fill="#7dd3fc" stroke="#0369a1" strokeWidth="2" />}
      {mood === 'masked' && (
        <>
          <path d="M30 70 L44 72 M100 70 L86 72" strokeWidth="2.5" />
          <rect x="44" y="66" width="42" height="24" rx="8" fill="#ffffff" />
          <path d="M50 74 h30 M50 82 h30" strokeWidth="2" stroke="#94a3b8" />
        </>
      )}
    </g>
  );
}

export function AirBuddy({ category, language, aqi }: { category: Category; language: Language; aqi?: number }) {
  const buddy = BUDDY[category];
  const colour = CATEGORY_COLOURS[category];
  const label = `${WORDS.buddy[language]}: ${buddy.name[language]}`;
  return (
    <section
      aria-label={WORDS.buddy[language]}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(6.5rem, 9rem) 1fr',
        gap: '1rem',
        alignItems: 'center',
        padding: '1rem',
        borderRadius: '1rem',
        background: colour.tint,
        border: `2px solid ${colour.fill}`,
      }}
    >
      <svg viewBox="0 0 130 120" role="img" aria-label={label} style={{ width: '100%', height: 'auto', maxWidth: '9rem' }}>
        <path
          d="M28 96 C8 96 6 70 22 64 C14 44 34 28 50 36 C56 16 88 14 94 36 C112 30 126 48 116 64 C130 72 124 96 104 96 Z"
          fill={colour.fill}
          stroke={INK}
          strokeWidth="3"
        />
        <Face mood={buddy.mood} />
      </svg>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: colour.ink }}>
          {WORDS.buddy[language]} · {buddy.name[language]}
        </div>
        <p style={{ margin: '0.35rem 0 0', fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4, color: '#0f172a', textWrap: 'balance' }}>
          {buddy.says[language]}
        </p>
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#334155' }}>
          {WORDS.todaysAir[language]}: <strong>{CATEGORY_NAMES[category][language]}</strong>
          {aqi !== undefined && <> · AQI <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{aqi}</strong></>}
        </div>
      </div>
    </section>
  );
}
