'use client';

// My complaints (K21): every ticket this phone sent, with where it has got to, from Command's
// GET /v1/complaints/{id}. Statuses load when the list is shown and on Refresh. A ticket whose deadline
// passed with no officer acting puts the number to call at its top (K24).
import React, { useEffect, useState } from 'react';

import { Button, Card } from '../../components/ui';
import { subtypeKey } from './ComplaintSheet';
import { TICKET_STEPS, escalationLine, stepOf, stillIgnored, ticketStore } from './help';
import { HelplineRow } from './Helplines';
import { getTicketStatus, type Language, type TicketStatus } from './kisanApi';
import { indiaClock, say, sayWith, type StringKey } from './strings';

type Loaded = Record<string, TicketStatus | 'failed'>;

async function statusesOf(ids: string): Promise<Loaded> {
  const list = ids ? ids.split(',') : [];
  const results = await Promise.all(list.map(async (id) => [id, await getTicketStatus(id).catch(() => 'failed' as const)] as const));
  return Object.fromEntries(results);
}

export function MyTickets({ district, language }: { district: string | null; language: Language }) {
  const { tickets } = ticketStore.use();
  const [statuses, setStatuses] = useState<Loaded>({});
  const ids = tickets.map((t) => t.id).join(',');

  useEffect(() => {
    let live = true;
    void statusesOf(ids).then((loaded) => {
      if (live) setStatuses(loaded);
    });
    return () => {
      live = false;
    };
  }, [ids]);

  return (
    <Card padding="md">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>🎫 {say('myTickets', language)}</h2>
        {tickets.length > 0 && (
          <Button variant="ghost" onClick={() => void statusesOf(ids).then(setStatuses)} style={{ minHeight: '2.75rem' }}>
            ↻ {say('refresh', language)}
          </Button>
        )}
      </div>
      {tickets.length === 0 ? (
        <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>{say('noTickets', language)}</p>
      ) : (
        <>
          <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0, display: 'grid', gap: '0.6rem' }}>
            {tickets.map((t) => {
              const status = statuses[t.id];
              const known = status && status !== 'failed' ? status : null;
              const step = known ? stepOf(known.status) : -1;
              const ignored = known ? stillIgnored(known) : false;
              return (
                <li
                  key={t.id}
                  style={{ border: `1px solid ${ignored ? '#b45309' : '#e2e8f0'}`, borderRadius: '0.75rem', padding: '0.7rem 0.85rem', display: 'grid', gap: '0.35rem' }}
                >
                  {ignored && (
                    <div style={{ display: 'grid', gap: '0.5rem', background: '#fffbeb', borderRadius: '0.5rem', padding: '0.6rem', marginBottom: '0.25rem' }}>
                      <strong style={{ color: '#b45309' }}>⚠️ {say('ignoredTitle', language)}</strong>
                      <span style={{ color: '#334155', fontSize: '0.95rem' }}>{say('ignoredCall', language)}</span>
                      <HelplineRow line={escalationLine(district)} language={language} />
                    </div>
                  )}
                  <strong style={{ color: '#0f172a' }}>{say(subtypeKey(t.subtype), language)}</strong>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8rem', color: '#475569', overflowWrap: 'anywhere', userSelect: 'all' }}>{t.id}</span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{sayWith('sentOn', language, { date: indiaClock(t.sentAt, language) })}</span>
                  <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: `repeat(${TICKET_STEPS.length}, 1fr)`, gap: '0.25rem', marginTop: '0.2rem' }}>
                    {TICKET_STEPS.map((s, i) => (
                      <span key={s} style={{ height: '0.35rem', borderRadius: '1rem', background: i <= step ? '#15803d' : '#e2e8f0' }} />
                    ))}
                  </div>
                  <span role="status" style={{ fontWeight: 600, color: known ? '#15803d' : '#64748b' }}>
                    {known ? say(`t_${known.status}` as StringKey, language) : status === 'failed' ? say('statusUnknown', language) : '…'}
                  </span>
                </li>
              );
            })}
          </ul>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', color: '#475569' }}>{say('notHappy', language)}</p>
        </>
      )}
    </Card>
  );
}

