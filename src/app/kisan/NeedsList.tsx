'use client';

// "What I need to know": one chip per detail the agent needs (MessageResponse.missing), ticking green
// as the farmer says them. Chips that tick on this reply pop one after another, so a single voice note
// that covers everything visibly fills the list.
import React, { useState } from 'react';

import type { Language } from './kisanApi';
import { say, type StringKey } from './strings';
import { CHECKLIST, type Need } from './voice';

const GREEN = '#15803d';

export function NeedsList({ done, language }: { done: ReadonlySet<Need>; language: Language }) {
  // Which chips just ticked: compared by content, since the chat makes a new set on every render.
  const key = CHECKLIST.filter((n) => done.has(n)).join(',');
  const [seen, setSeen] = useState(key);
  const [fresh, setFresh] = useState<Need[]>(() => CHECKLIST.filter((n) => done.has(n)));
  if (seen !== key) {
    const was = new Set(seen.split(','));
    setSeen(key);
    setFresh(CHECKLIST.filter((n) => done.has(n) && !was.has(n)));
  }

  const all = done.size === CHECKLIST.length;
  return (
    <section aria-labelledby="kisan-needs-title" style={{ display: 'grid', gap: '0.5rem' }}>
      <div id="kisan-needs-title" style={{ fontSize: '0.9rem', fontWeight: 600, color: all ? GREEN : '#475569' }}>
        {all ? `✓ ${say('needAll', language)}` : say('needTitle', language)}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {CHECKLIST.map((need) => {
          const has = done.has(need);
          const pop = fresh.indexOf(need);
          return (
            <li
              key={need}
              data-need={need}
              data-done={has}
              className="kisan-motion"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                minHeight: '2rem',
                padding: '0.2rem 0.7rem',
                borderRadius: '999px',
                fontSize: '0.95rem',
                background: has ? '#dcfce7' : '#ffffff',
                color: has ? '#14532d' : '#64748b',
                border: has ? '1px solid #86efac' : '1px dashed #cbd5e1',
                animation: pop >= 0 ? `kisan-pop 360ms ease-out ${pop * 140}ms both` : undefined,
              }}
            >
              <span>{has ? '✓' : '○'}</span>
              {say(`need_${need}` as StringKey, language)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
