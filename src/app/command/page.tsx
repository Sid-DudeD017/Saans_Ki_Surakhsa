'use client';

// Saans Command's case console (P4): the officer's queue (nearest deadline first) and map, and one case at a
// time with the farmer's help request before any penalty. Mock mode runs on example cases; live, on
// /v1/cases from the local stack, signed in as one of the demo officers, so Cedar shows their district only.
import React, { useCallback, useEffect, useState } from 'react';

import { Alert, Badge, Card, Container } from '../../components/ui';
import { useLanguage } from '../../lib/i18n';
import { CaseDetailPanel, when } from './CaseDetailPanel';
import { CaseMap } from './CaseMap';
import { DEFAULT_OFFICER, OFFICERS, USE_MOCKS, getTicket, listTickets, type CaseDetail, type CaseStatus } from './commandApi';
import { translations, type Lang } from './i18n';

const ALLOWED_OFFICER_IDS = new Set([
  '633870',
  '608628',
  '879821',
  '672665',
  '847544',
  '797567',
]);

const STATUSES: [CaseStatus | '', string][] = [['OPEN', 'Open'], ['ACTION_APPROVED', 'Help approved'], ['ACTION_CHANGED', 'Changed'], ['CLOSED', 'Closed'], ['', 'All']];
const DISTRICTS = ['', 'Sangrur', 'Patiala', 'unassigned'];
const TYPE_ICONS: Record<string, string> = { farm_fire: '🔥', garbage: '🗑️', vehicle: '🚚', firecrackers: '🎆', farmer_support: '🌾', kisan_grievance: '📣' };

const select: React.CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', minHeight: '44px' };

export default function CommandPage() {
  const { language } = useLanguage();
  const lang: Lang = (language as Lang) || 'en';
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState('');
  const [queue, setQueue] = useState<{ tickets?: any[]; total?: number; error?: string }>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>({});
  const [reloads, setReloads] = useState(0);

  // Authentication & Officer ID verification (lazy initialized from session storage to avoid cascading renders)
  const [verifiedOfficerId, setVerifiedOfficerId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = sessionStorage.getItem('saans_officer_id');
    return saved && ALLOWED_OFFICER_IDS.has(saved) ? saved : null;
  });

  const [officer, setOfficer] = useState<string>(() => {
    if (typeof window === 'undefined') return 'local-citizen-1';
    const saved = sessionStorage.getItem('saans_officer_id');
    return saved && ALLOWED_OFFICER_IDS.has(saved) ? 'local-state-command' : 'local-citizen-1';
  });

  const [showOfficerModal, setShowOfficerModal] = useState<boolean>(false);
  const [officerInputId, setOfficerInputId] = useState<string>('');
  const [officerAuthError, setOfficerAuthError] = useState<string | null>(null);

  const handleRoleChange = (newToken: string) => {
    if (newToken === 'local-state-command') {
      if (!verifiedOfficerId) {
        setOfficerInputId('');
        setOfficerAuthError(null);
        setShowOfficerModal(true);
        return;
      }
      setOfficer('local-state-command');
      setSelected(null);
    } else {
      setOfficer(newToken);
      setSelected(null);
    }
  };

  const handleVerifyOfficer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = officerInputId.trim();
    if (ALLOWED_OFFICER_IDS.has(trimmed)) {
      setVerifiedOfficerId(trimmed);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('saans_officer_id', trimmed);
      }
      setOfficer('local-state-command');
      setShowOfficerModal(false);
      setOfficerAuthError(null);
      setSelected(null);
    } else {
      setOfficerAuthError('Invalid Officer ID. Access denied.');
    }
  };

  const handleCancelModal = () => {
    setShowOfficerModal(false);
    setOfficerAuthError(null);
    setOfficerInputId('');
  };

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  const fetchTickets = useCallback((cursor?: string) => {
    return listTickets({ status: status || undefined, category: category || undefined, cursor }, officer);
  }, [status, category, officer]);

  useEffect(() => {
    let on = true;
    fetchTickets().then(
      (res) => { if (on) { setQueue({ tickets: res.tickets, total: res.total }); setNextCursor(res.next_cursor); } },
      (e: Error) => { if (on) setQueue({ error: e.message }); }
    );
    return () => { on = false; };
  }, [fetchTickets, reloads]);

  // Real-time background polling every 2.5s so newly submitted reports show up immediately
  useEffect(() => {
    const timer = setInterval(() => {
      fetchTickets().then(
        (res) => {
          setQueue((prev) => {
            const prevIds = (prev.tickets || []).map((t: any) => `${t.id}-${t.status}`).join(',');
            const nextIds = (res.tickets || []).map((t: any) => `${t.id}-${t.status}`).join(',');
            if (prevIds !== nextIds || prev.total !== res.total) {
              return { tickets: res.tickets, total: res.total };
            }
            return prev;
          });
        },
        () => {}
      );
    }, 2500);
    return () => clearInterval(timer);
  }, [fetchTickets]);

  // Instant cross-tab, cross-window, and focus synchronization
  useEffect(() => {
    const handleSync = () => reload();
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reload();
    });

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('saans_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'ticket_created' || event.data?.type === 'report_submitted') {
            reload();
          }
        };
      } catch {}
    }

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
      if (bc) bc.close();
    };
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    try {
      const res = await fetchTickets(nextCursor);
      setQueue((q) => ({ tickets: [...(q.tickets || []), ...res.tickets] }));
      setNextCursor(res.next_cursor);
    } catch (e: any) {
      alert(e.message);
    }
  }, [nextCursor, fetchTickets]);

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
  const tickets = queue.tickets ?? [];
  const shown = selected && detail.ticket?.id === selected ? detail : null;
  const t = translations[lang];

  const STATUS_OPTS = [
    ['submitted', t.status_submitted],
    ['in_progress', t.status_in_progress],
    ['resolved', t.status_resolved],
    ['', t.status_all],
  ];
  const CAT_OPTS = [
    ['farm_fire', t.type_farm_fire],
    ['garbage', t.type_garbage],
    ['vehicle', t.type_vehicle],
    ['firecrackers', t.type_firecrackers],
    ['dust', t.type_dust],
    ['industrial', t.type_industrial],
    ['farmer_support', t.type_farmer_support],
    ['', t.status_all],
  ];

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.85rem', color: '#334155' }}>
                    {t.signed_in}{' '}
                    <select
                      style={select}
                      value={officer}
                      onChange={(e) => handleRoleChange(e.target.value)}
                    >
                      {OFFICERS.map((o) => (
                        <option key={o.token} value={o.token}>
                          {o.token === 'local-state-command' ? t.role_officer : t.role_citizen}
                        </option>
                      ))}
                    </select>
                  </label>
                  {officer === 'local-citizen-1' && (
                    <button
                      type="button"
                      onClick={() => {
                        const cur = typeof window !== 'undefined' ? sessionStorage.getItem('saans_view_citizen_id') : null;
                        if (cur === '*') {
                          sessionStorage.removeItem('saans_view_citizen_id');
                        } else {
                          sessionStorage.setItem('saans_view_citizen_id', '*');
                        }
                        reload();
                      }}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.375rem',
                        backgroundColor: (typeof window !== 'undefined' && sessionStorage.getItem('saans_view_citizen_id') === '*') ? '#dbeafe' : '#f1f5f9',
                        color: (typeof window !== 'undefined' && sessionStorage.getItem('saans_view_citizen_id') === '*') ? '#1d4ed8' : '#475569',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                      title="Toggle between all demo reports and current session only"
                    >
                      {(typeof window !== 'undefined' && sessionStorage.getItem('saans_view_citizen_id') === '*') ? '🌐 Showing all citizen reports' : '👤 My session only'}
                    </button>
                  )}
                  {officer === 'local-state-command' && verifiedOfficerId && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        fontWeight: 600,
                      }}
                      title="Verified Officer ID"
                    >
                      ID: {verifiedOfficerId}
                    </span>
                  )}
                </div>
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
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{queue.tickets ? `${queue.total || tickets.length} ticket${tickets.length === 1 ? '' : 's'}` : t.loading}</span>
            </div>
            {queue.error && <Alert variant="danger" title="No queue">{queue.error}</Alert>}
            {queue.tickets && tickets.length === 0 && <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>{t.no_tickets}</p>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
              {tickets.map((s) => {
                const catName = CAT_OPTS.find(o => o[0] === s.type)?.[1] || s.type;
                const locText = s.district && s.district !== 'unassigned' ? ` · ${s.district}` : '';
                const statusName =
                  s.status === 'submitted' ? t.status_submitted :
                  s.status === 'under_review' ? t.status_under_review :
                  s.status === 'assigned' ? t.status_assigned :
                  s.status === 'in_progress' ? t.status_in_progress :
                  s.status === 'resolved' ? t.status_resolved :
                  s.status === 'closed' ? t.status_closed : s.status;
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
                      <strong>{TYPE_ICONS[s.type] ?? '•'} {catName}{locText}</strong>
                      <span style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        {s.total_reports > 1 && (
                          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                            👥 {s.total_reports} reports
                          </span>
                        )}
                        {s.threat_level && (
                          <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', backgroundColor: s.threat_level === 'critical' ? '#fee2e2' : s.threat_level === 'high' ? '#ffedd5' : '#fef3c7', color: s.threat_level === 'critical' ? '#b91c1c' : s.threat_level === 'high' ? '#c2410c' : '#b45309' }}>
                            {s.threat_level.toUpperCase()}
                          </span>
                        )}
                      </span>
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                      {s.help_request ? `🌾 ${t.help_request_badge} · ` : ''}
                      {statusName}
                      {' · '}{s.deadline ? `${t.sla} ${when(s.deadline)}` : `${t.created} ${new Date(s.created_at).toLocaleString()}`}
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

      {/* Officer ID Verification Popup Modal */}
      {showOfficerModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="officer-auth-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 9999,
          }}
          onClick={handleCancelModal}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              padding: '1.75rem',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '9999px',
                  backgroundColor: '#e0f2fe',
                  color: '#0284c7',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem',
                  marginBottom: '0.75rem',
                }}
              >
                🛡️
              </div>
              <h2
                id="officer-auth-title"
                style={{ margin: '0 0 0.35rem', fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}
              >
                Officer Verification
              </h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#64748b', lineHeight: 1.4 }}>
                Enter your authorized 6-digit Officer PIN to access the enforcement console.
              </p>

              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0',
                  marginBottom: '1.15rem',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                  Demo Prototype Access
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Use any of these authorized PIN values to log in:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {['633870', '608628', '879821', '672665', '847544', '797567'].map((pin) => (
                    <button
                      key={pin}
                      type="button"
                      onClick={() => {
                        setOfficerInputId(pin);
                        setOfficerAuthError(null);
                      }}
                      title={`Click to fill ${pin}`}
                      style={{
                        padding: '0.3rem 0.55rem',
                        backgroundColor: '#ffffff',
                        border: officerInputId === pin ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                        borderRadius: '0.375rem',
                        fontSize: '0.825rem',
                        fontWeight: 700,
                        color: officerInputId === pin ? '#0284c7' : '#1e293b',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      • {pin}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <form onSubmit={handleVerifyOfficer}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}
                >
                  Officer PIN
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={officerInputId}
                  onChange={(e) => {
                    setOfficerInputId(e.target.value.replace(/\D/g, ''));
                    setOfficerAuthError(null);
                  }}
                  placeholder="• • • • • •"
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    borderRadius: '0.5rem',
                    border: officerAuthError ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    letterSpacing: '0.25em',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              {officerAuthError && (
                <div style={{ marginBottom: '1rem' }}>
                  <Alert variant="danger">{officerAuthError}</Alert>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={handleCancelModal}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={officerInputId.trim().length !== 6}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    backgroundColor: officerInputId.trim().length === 6 ? '#0284c7' : '#94a3b8',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: officerInputId.trim().length === 6 ? 'pointer' : 'not-allowed',
                    minHeight: '44px',
                    transition: 'background-color 0.15s',
                  }}
                >
                  Verify & Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Container>
  );
}
