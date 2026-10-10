'use client';

// Saans Command's case console (P4): the officer's queue (nearest deadline first) and map, and one case at a
// time with the farmer's help request before any penalty. Mock mode runs on example cases; live, on
// /v1/cases from the local stack, signed in as one of the demo officers, so Cedar shows their district only.
import React, { useCallback, useEffect, useState } from 'react';

import { Alert, Badge, Card, Container } from '../../components/ui';
import { CaseDetailPanel, when } from './CaseDetailPanel';
import { CaseMap } from './CaseMap';
import { DEFAULT_OFFICER, OFFICERS, USE_MOCKS, getTicket, listTickets, type CaseDetail, type CaseStatus } from './commandApi';
import { translations, type Lang } from './i18n';

const STATUSES: [CaseStatus | '', string][] = [['OPEN', 'Open'], ['ACTION_APPROVED', 'Help approved'], ['ACTION_CHANGED', 'Changed'], ['CLOSED', 'Closed'], ['', 'All']];
const DISTRICTS = ['', 'Sangrur', 'Patiala', 'unassigned'];
const TYPE_ICONS: Record<string, string> = { farm_fire: '🔥', garbage: '🗑️', vehicle: '🚚', firecrackers: '🎆', farmer_support: '🌾' };

const select: React.CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', minHeight: '44px' };

export default function CommandPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [status, setStatus] = useState<string>('submitted');
  const [district, setDistrict] = useState('');
  const [category, setCategory] = useState('');
  const [queue, setQueue] = useState<{ tickets?: any[]; total?: number; error?: string }>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>({});
  const [reloads, setReloads] = useState(0);
  const [officer, setOfficer] = useState(DEFAULT_OFFICER);

  const fetchTickets = (cursor?: string) => {
    return listTickets({ status: status || undefined, district: district || undefined, category: category || undefined, cursor }, officer);
  };

  useEffect(() => {
    let on = true;
    fetchTickets().then(
      (res) => { if (on) { setQueue({ tickets: res.tickets, total: res.total }); setNextCursor(res.next_cursor); } },
      (e: Error) => { if (on) setQueue({ error: e.message }); }
    );
    return () => { on = false; };
  }, [status, district, category, officer, reloads]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    try {
      const res = await fetchTickets(nextCursor);
      setQueue((q) => ({ tickets: [...(q.tickets || []), ...res.tickets] }));
      setNextCursor(res.next_cursor);
    } catch (e: any) {
      alert(e.message);
    }
  }, [nextCursor, status, district, category, officer]);

  useEffect(() => {
    if (!selected) return;
    let on = true;
    getTicket(selected, officer).then(
      (c) => on && setDetail(c),
      (e: Error) => on && setDetail({ error: e.message }),
    );
    return () => {
      on = false;
    };
  }, [selected, officer, reloads]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const tickets = queue.tickets ?? [];
  const shown = selected && detail.ticket?.id === selected ? detail : null;
  const t = translations[lang];

  const STATUS_OPTS = [['submitted', 'Submitted'], ['under_review', 'Under Review'], ['assigned', 'Assigned'], ['in_progress', 'In Progress'], ['resolved', 'Resolved'], ['closed', 'Closed'], ['', 'All']];
  const CAT_OPTS = [['farm_fire', 'Stubble Burning'], ['garbage', 'Burning waste'], ['vehicle', 'Vehicle idling'], ['firecrackers', 'Firecrackers'], ['farmer_support', 'Farmer Support'], ['', 'All']];

  return (
    <Container maxWidth="lg" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Badge variant="danger" size="md">P4 MODULE</Badge>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Saans Command · case console</span>
          </div>
          <h1 style={{ margin: '0.25rem 0', fontSize: '1.75rem', color: '#0f172a' }}>🛡️ {t.queue}</h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>{t.desc}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['en', 'hi', 'pa'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ padding: '0.5rem 1rem', minHeight: '44px', minWidth: '44px', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: lang === l ? '#e2e8f0' : '#fff', cursor: 'pointer' }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {USE_MOCKS && (
        <div style={{ marginBottom: '1rem' }}>
          <Alert variant="info" title="Example cases">{t.mock}</Alert>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))', gap: '1rem', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
          <Card padding="md">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
              {!USE_MOCKS && (
                <label style={{ fontSize: '0.85rem', color: '#334155' }}>
                  {t.signed_in}{' '}
                  <select style={select} value={officer} onChange={(e) => { setOfficer(e.target.value); setSelected(null); }}>
                    {OFFICERS.map((o) => <option key={o.token} value={o.token}>{o.name}</option>)}
                  </select>
                </label>
              )}
              <label style={{ fontSize: '0.85rem', color: '#334155' }}>
                {t.status}{' '}
                <select style={select} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUS_OPTS.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: '0.85rem', color: '#334155' }}>
                {t.category}{' '}
                <select style={select} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CAT_OPTS.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: '0.85rem', color: '#334155' }}>
                {t.district}{' '}
                <select style={select} value={district} onChange={(e) => setDistrict(e.target.value)}>
                  {DISTRICTS.map((d) => <option key={d} value={d}>{d || 'All'}</option>)}
                </select>
              </label>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{queue.tickets ? `${queue.total || tickets.length} ticket${tickets.length === 1 ? '' : 's'}` : t.loading}</span>
            </div>
            {queue.error && <Alert variant="danger" title="No queue">{queue.error}</Alert>}
            {queue.tickets && tickets.length === 0 && <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>{t.no_tickets}</p>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
              {tickets.map((s) => {
                const catName = CAT_OPTS.find(o => o[0] === s.type)?.[1] || s.type;
                const locText = s.district ? s.district : t.supervisor_queue;
                return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s.id)}
                    aria-current={selected === s.id}
                    style={{
                      width: '100%', textAlign: 'left', display: 'grid', gap: '0.2rem', padding: '0.6rem 0.75rem', borderRadius: '0.6rem', cursor: 'pointer',
                      border: selected === s.id ? '2px solid #0f172a' : '1px solid #e2e8f0', background: s.help_request ? '#f0fdf4' : '#ffffff', minHeight: '44px'
                    }}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.95rem', color: '#0f172a' }}>
                      <strong>{TYPE_ICONS[s.type] ?? '•'} {catName} · {locText}</strong>
                      {s.threat_level && (
                        <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', backgroundColor: s.threat_level === 'critical' ? '#fee2e2' : s.threat_level === 'high' ? '#ffedd5' : '#fef3c7', color: s.threat_level === 'critical' ? '#b91c1c' : s.threat_level === 'high' ? '#c2410c' : '#b45309' }}>
                          {s.threat_level.toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                      {s.help_request ? '🌾 Help request · ' : ''}
                      {s.status.replace('_', ' ')}
                      {' · '}{s.deadline ? `SLA: ${when(s.deadline)}` : `created ${new Date(s.created_at).toLocaleString()}`}
                    </span>
                  </button>
                </li>
              )})}
            </ul>
            {nextCursor && (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <button type="button" onClick={loadMore} style={{ padding: '0.5rem 1rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', minHeight: '44px' }}>{t.load_more}</button>
              </div>
            )}
          </Card>
          {tickets.length > 0 && (
            <CaseMap
              title="Tickets on the map"
              onPick={setSelected}
              points={tickets.filter(t => t.location).map((s) => ({ id: s.id, label: `${s.type} · ${s.district}`, kind: s.status === 'closed' ? 'closed' : s.help_request ? 'help' : 'report', selected: s.id === selected, ...s.location }))}
            />
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          {!selected && <Card padding="lg"><p style={{ margin: 0, color: '#475569' }}>{t.pick_case}</p></Card>}
          {selected && detail.error && <Alert variant="danger" title="Couldn't open the case">{detail.error}</Alert>}
          {shown && <CaseDetailPanel key={`${shown.ticket.id}-${shown.ticket.status}`} detail={shown} officer={officer} lang={lang} onChanged={reload} />}
        </div>
      </div>
    </Container>
  );
}
