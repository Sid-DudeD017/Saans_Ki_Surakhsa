'use client';

// Where the farmer's request for help is: sent, seen, machine assigned (which, from which CHC, when),
// in the field, done. Saans Command reports each step to the agent; this page asks every 15 seconds.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { use, useEffect, useState } from 'react';

import { Alert, Card, Container } from '../../../../components/ui';
import { useLanguage } from '../../../../lib/i18n';
import { getStatus, KisanError, type KisanStatus, type Language } from '../../kisanApi';
import { FONT, STATUS_ORDER, indiaClock, say, statusLabel } from '../../strings';

const GREEN = '#15803d';
const POLL_MS = 15_000;

function isLanguage(value: string | null): value is Language {
  return value === 'pa' || value === 'hi' || value === 'en';
}

export default function KisanStatusPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const query = useSearchParams().get('lang');
  const { language: shellLanguage } = useLanguage();
  const lang: Language = isLanguage(query) ? query : shellLanguage;

  const [status, setStatus] = useState<KisanStatus | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      getStatus(sessionId)
        .then((s) => {
          if (!live) return;
          setStatus(s);
          setProblem(null);
        })
        .catch((e) => {
          if (!live) return;
          setProblem(e instanceof KisanError && e.status === 404 ? 'unknown' : e instanceof KisanError && e.status ? e.message : 'network');
        });
    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  const reached = new Map((status?.history ?? []).map((h) => [h.status, h]));
  const current = status?.current ? STATUS_ORDER.indexOf(status.current) : -1;

  return (
    <Container maxWidth="md" style={{ paddingTop: '1.5rem', paddingBottom: '6rem', fontFamily: FONT }}>
      <Link href="/kisan" style={{ color: '#0369a1', fontSize: '0.95rem' }}>
        ← {say('back', lang)}
      </Link>
      <h1 style={{ margin: '0.75rem 0 0.25rem', fontSize: '1.6rem', color: '#0f172a' }}>{say('statusTitle', lang)}</h1>
      {status?.helpRequestId && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{status.helpRequestId}</div>}

      {problem && (
        <div style={{ marginTop: '1rem' }}>
          <Alert variant={problem === 'unknown' ? 'warning' : 'danger'}>
            {problem === 'unknown' ? say('unknownSession', lang) : problem === 'network' ? say('network', lang) : problem}
          </Alert>
        </div>
      )}

      {status && !status.current && (
        <p style={{ marginTop: '1rem', fontSize: '1.05rem', color: '#334155' }}>{say('notFiled', lang)}</p>
      )}

      {status?.current && (
        <ol style={{ listStyle: 'none', margin: '1.25rem 0 0', padding: 0, display: 'grid', gap: '0.75rem' }}>
          {STATUS_ORDER.filter((s) => s !== 'closed' || reached.has('closed')).map((step, i) => {
            const entry = reached.get(step);
            // Command may skip a step (straight from filed to machine_assigned); skipped steps aren't ticked.
            const done = !!entry;
            const passed = !entry && i < current;
            const now = step === status.current;
            return (
              <li key={step}>
                <Card
                  padding="md"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2rem 1fr',
                    gap: '0.75rem',
                    alignItems: 'start',
                    borderColor: now ? GREEN : '#e2e8f0',
                    borderWidth: now ? 2 : 1,
                    opacity: done ? 1 : passed ? 0.4 : 0.55,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: done ? GREEN : '#e2e8f0',
                      color: done ? '#ffffff' : '#64748b',
                      fontWeight: 700,
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{statusLabel(step, lang)}</div>
                    {entry && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{indiaClock(entry.at, lang)}</div>}
                    {entry?.machine && (
                      <div style={{ marginTop: '0.5rem', fontSize: '1.05rem', color: '#0f172a' }}>
                        ⚙️ {entry.machine}
                        {entry.date && <strong style={{ marginLeft: '0.5rem', fontSize: '1.3rem' }}>{entry.date}</strong>}
                      </div>
                    )}
                    {entry?.chc && <div style={{ fontSize: '0.95rem', color: '#334155' }}>{entry.chc}</div>}
                    {entry?.chc_phone && (
                      <div style={{ fontSize: '0.95rem', color: '#334155' }}>
                        📞 {say('callChc', lang)}: <a href={`tel:${entry.chc_phone.replace(/\s/g, '')}`}>{entry.chc_phone}</a>
                      </div>
                    )}
                    {entry?.note && <div style={{ marginTop: '0.25rem', fontSize: '0.95rem', color: '#334155' }}>{entry.note}</div>}
                    {entry?.sms && !entry.sms.error && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#64748b' }}>
                        ✉️ {say('smsTo', lang)} {entry.sms.to}
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      {status && <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>{say('refreshes', lang)}</p>}
    </Container>
  );
}
