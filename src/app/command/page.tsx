'use client';

// Saans Command's case console (P4): the officer's queue (nearest deadline first) and map, and one case at a
// time with the farmer's help request before any penalty. Mock mode runs on example cases; live, on
// /v1/cases from the local stack.
import React, { useCallback, useEffect, useState } from 'react';

import { Alert, Badge, Card, Container } from '../../components/ui';
import { CaseDetailPanel, when } from './CaseDetailPanel';
import { CaseMap } from './CaseMap';
import { USE_MOCKS, getCase, listCases, type CaseDetail, type CaseStatus, type CaseSummary } from './commandApi';

const STATUSES: [CaseStatus | '', string][] = [['OPEN', 'Open'], ['ACTION_APPROVED', 'Help approved'], ['ACTION_CHANGED', 'Changed'], ['CLOSED', 'Closed'], ['', 'All']];
const DISTRICTS = ['', 'Sangrur', 'Patiala', 'unassigned'];
const TYPE_ICONS: Record<string, string> = { farm_fire: '🔥', garbage: '🗑️', vehicle: '🚚', firecrackers: '🎆', farmer_support: '🌾' };

const select: React.CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9rem' };

export default function CommandPage() {
  const [status, setStatus] = useState<CaseStatus | ''>('OPEN');
  const [district, setDistrict] = useState('');
  const [queue, setQueue] = useState<{ cases?: CaseSummary[]; error?: string }>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ case?: CaseDetail; error?: string }>({});
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let on = true;
    listCases({ status: status || undefined, district: district || undefined }).then(
      (cases) => on && setQueue({ cases }),
      (e: Error) => on && setQueue({ error: e.message }),
    );
    return () => {
      on = false;
    };
  }, [status, district, reloads]);

  useEffect(() => {
    if (!selected) return;
    let on = true;
    getCase(selected).then(
      (c) => on && setDetail({ case: c }),
      (e: Error) => on && setDetail({ error: e.message }),
    );
    return () => {
      on = false;
    };
  }, [selected, reloads]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const cases = queue.cases ?? [];
  const shown = selected && detail.case?.case.id === selected ? detail.case : null;

  return (
    <Container maxWidth="lg" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <Badge variant="danger" size="md">P4 MODULE</Badge>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Saans Command · case console</span>
        </div>
        <h1 style={{ margin: '0.25rem 0', fontSize: '1.75rem', color: '#0f172a' }}>🛡️ Command Console</h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>Reports and farmers&apos; help requests, nearest deadline first. Where a farmer has asked for a machine, help comes before any penalty.</p>
      </div>

      {USE_MOCKS && (
        <div style={{ marginBottom: '1rem' }}>
          <Alert variant="info" title="Example cases">Mock mode: these are example cases, and decisions last until the page reloads. Set NEXT_PUBLIC_USE_MOCKS=false to use the local stack.</Alert>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))', gap: '1rem', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
          <Card padding="md">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#334155' }}>
                Status{' '}
                <select style={select} value={status} onChange={(e) => setStatus(e.target.value as CaseStatus | '')}>
                  {STATUSES.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: '0.85rem', color: '#334155' }}>
                District{' '}
                <select style={select} value={district} onChange={(e) => setDistrict(e.target.value)}>
                  {DISTRICTS.map((d) => <option key={d} value={d}>{d || 'All'}</option>)}
                </select>
              </label>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{queue.cases ? `${cases.length} case${cases.length === 1 ? '' : 's'}` : 'Loading…'}</span>
            </div>
            {queue.error && <Alert variant="danger" title="No queue">{queue.error}</Alert>}
            {queue.cases && cases.length === 0 && <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>No cases match.</p>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
              {cases.map((s) => (
                <li key={s.case.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s.case.id)}
                    aria-current={selected === s.case.id}
                    style={{
                      width: '100%', textAlign: 'left', display: 'grid', gap: '0.2rem', padding: '0.6rem 0.75rem', borderRadius: '0.6rem', cursor: 'pointer',
                      border: selected === s.case.id ? '2px solid #0f172a' : '1px solid #e2e8f0', background: s.hasHelpRequest ? '#f0fdf4' : '#ffffff',
                    }}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.95rem', color: '#0f172a' }}>
                      <strong>{TYPE_ICONS[s.type] ?? '•'} {s.district}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#b91c1c', whiteSpace: 'nowrap' }}>by {when(s.deadline)}</span>
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                      {s.hasHelpRequest ? '🌾 Help request: offer a machine first · ' : ''}
                      {s.case.status === 'OPEN' ? 'Open' : s.case.status === 'CLOSED' ? 'Closed' : 'Acted on'} · {s.case.evidenceSummary}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {cases.length > 0 && (
            <CaseMap
              title="Cases on the map"
              onPick={setSelected}
              points={cases.map((s) => ({ id: s.case.id, label: `${s.type} · ${s.district}`, kind: s.case.status === 'CLOSED' ? 'closed' : s.hasHelpRequest ? 'help' : 'report', selected: s.case.id === selected, ...s.location }))}
            />
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          {!selected && <Card padding="lg"><p style={{ margin: 0, color: '#475569' }}>Pick a case from the queue or the map.</p></Card>}
          {selected && detail.error && <Alert variant="danger" title="Couldn't open the case">{detail.error}</Alert>}
          {shown && <CaseDetailPanel key={`${shown.case.id}-${shown.case.version}`} detail={shown} onChanged={reload} />}
        </div>
      </div>
    </Container>
  );
}
