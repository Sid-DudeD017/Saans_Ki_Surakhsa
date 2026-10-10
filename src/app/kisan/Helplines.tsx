'use client';

// Numbers to call (K23): emergency first, then the farm district's offices, then the Kisan Call Centre.
// Each number is shown as text the farmer can read out or copy, with a Call button, and its source.
import React, { useState } from 'react';

import { Card } from '../../components/ui';
import { HELPLINES, helplinesFor, type Helpline } from './help';
import type { Language } from './kisanApi';
import { dayMonth, say, sayWith } from './strings';

export function Helplines({ district, language }: { district: string | null; language: Language }) {
  const lines = helplinesFor(district);
  const sources = [...new Set(lines.map((l) => l.source))].map((id) => HELPLINES.sources[id]);
  return (
    <Card padding="md">
      <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>📞 {say('callTitle', language)}</h2>
      <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0, display: 'grid', gap: '0.6rem' }}>
        {lines.map((line) => (
          <li key={line.id}>
            <HelplineRow line={line} language={language} />
          </li>
        ))}
      </ul>
      <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
        {!district && <>{say('setLocationForNumbers', language)} </>}
        {say('onlyChecked', language)}{' '}
        {sources.map((s, i) => (
          <React.Fragment key={s.url}>
            {i > 0 && ' · '}
            <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1' }}>
              {s.publisher}
            </a>
          </React.Fragment>
        ))}{' '}
        ({sayWith('checkedOn', language, { date: `${dayMonth(sources[0].checked_on, language)} ${sources[0].checked_on.slice(0, 4)}` })})
      </p>
    </Card>
  );
}

function HelplineRow({ line, language }: { line: Helpline; language: Language }) {
  const [copied, setCopied] = useState(false);
  const red = '#b91c1c';

  function copy(e: React.MouseEvent<HTMLButtonElement>) {
    const text = line.number;
    const target = e.currentTarget.parentElement?.querySelector('[data-number]');
    navigator.clipboard
      ?.writeText(text)
      .then(() => setCopied(true))
      .catch(() => {
        // Older browsers and some app views refuse the clipboard: select the number instead.
        if (target) window.getSelection()?.selectAllChildren(target);
      });
  }

  return (
    <div
      style={{
        border: `1px solid ${line.emergency ? red : '#e2e8f0'}`,
        background: line.emergency ? '#fef2f2' : '#ffffff',
        borderRadius: '0.75rem',
        padding: '0.7rem 0.85rem',
        display: 'grid',
        gap: '0.35rem',
      }}
    >
      <div style={{ fontWeight: 700, color: line.emergency ? red : '#0f172a' }}>{line.names[language]}</div>
      <div style={{ fontSize: '0.9rem', color: '#475569' }}>{line.when[language]}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span data-number style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '0.02em', color: '#0f172a', fontVariantNumeric: 'tabular-nums', userSelect: 'all' }}>
          {line.number}
        </span>
        <a
          href={`tel:${line.number.replace(/[^\d+]/g, '')}`}
          style={{ minHeight: '2.75rem', display: 'inline-flex', alignItems: 'center', padding: '0 1rem', borderRadius: '0.5rem', background: line.emergency ? red : '#15803d', color: '#ffffff', fontWeight: 700, textDecoration: 'none' }}
        >
          📞 {say('call', language)}
        </a>
        <button
          type="button"
          onClick={copy}
          style={{ minHeight: '2.75rem', padding: '0 0.9rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontFamily: 'inherit', fontSize: '0.95rem', cursor: 'pointer' }}
        >
          {copied ? `✓ ${say('copied', language)}` : say('copy', language)}
        </button>
      </div>
    </div>
  );
}
