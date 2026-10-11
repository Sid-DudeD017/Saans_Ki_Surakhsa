'use client';

// One case in the console (P4). The farmer's open help request comes first, with the machine that can be
// sent, and only then the report and the actions, so help is offered before any penalty.
import React, { useState } from 'react';

import { Alert, Badge, Button, Card } from '../../components/ui';
import { SlippyMap, type Pin } from '../../components/SlippyMap';
import { ApiError, actOnCase, type CaseAction, type CaseDetail } from './commandApi';
import { PIN_COLOURS, TONE } from './tones';
import { DETAIL as D, WORDS, fill, typeName } from './words';
import { useLanguage } from '../../lib/i18n';

/** "9 Oct, 18:02" from an India-time ISO string, without the browser's time zone. */
export function when(iso: string) {
  const [date, time] = iso.split('T');
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}, ${time.slice(0, 5)}`;
}

/** "9 Oct" for dates that have no meaningful time. */
const day = (iso: string) => when(iso).split(',')[0];

/** "40 m" under a kilometre, "1.2 km" above (as the API writes it). */
const distanceText = (m: number) => {
  const tens = Math.max(10, Math.round(m / 10) * 10);
  return tens < 1000 ? `${tens} m` : `${(m / 1000).toFixed(1)} km`;
};

const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.875rem', color: '#334155', flexWrap: 'wrap' };

export function CaseDetailPanel({ detail, officer, onChanged }: { detail: CaseDetail; officer: string; onChanged: () => void }) {
  const { language: l } = useLanguage();
  const t = (w: Record<'en' | 'hi' | 'pa', string>, vars?: Record<string, string | number>) => fill(w, l, vars);
  const actionName = (a: string) => (D.action[a] ? t(D.action[a]) : a);
  const c = detail.case;
  const help = detail.helpRequest;
  const machine = detail.recommendedMachine;
  const closed = c.status === 'CLOSED';
  const [reason, setReason] = useState('');
  const [machineId, setMachineId] = useState(machine?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null);

  const act = async (action: CaseAction) => {
    if (!reason.trim()) {
      setMessage({ tone: 'warning', text: t(D.needReason) });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const sendsMachine = action === 'APPROVE' || action === 'CHANGE';
      await actOnCase(c.id, { action, reason: reason.trim(), previousCaseVersion: c.version, ...(sendsMachine && machineId ? { selectedMachineId: machineId } : {}) }, officer);
      setReason('');
      setMessage({ tone: 'success', text: t(D.recorded, { action: actionName(action) }) });
      onChanged();
    } catch (e) {
      const conflict = e instanceof ApiError && e.code === 'version_conflict';
      const refused = e instanceof ApiError && e.code === 'forbidden';
      setMessage({ tone: 'danger', text: conflict ? t(D.conflict) : refused ? t(D.notAllowed, { why: e.message }) : (e as Error).message });
      if (conflict) onChanged();
    } finally {
      setBusy(false);
    }
  };

  const points: Pin[] = [
    { id: 'report', colour: PIN_COLOURS[detail.type === 'farmer_support' ? 'farm' : 'report'], label: detail.type === 'farmer_support' ? t(D.theFarm) : t(D.theReport), ...detail.report.location },
    ...(help && detail.type !== 'farmer_support' ? [{ id: 'farm', colour: PIN_COLOURS.farm, label: `The farm with the open help request (${help.id})`, ...help.farmLocation }] : []),
    ...(machine ? [{ id: 'chc', colour: PIN_COLOURS.chc, label: `${machine.chcName}: ${machine.machineType}`, ...machine.location }] : []),
    ...(detail.observation ? [{ id: 'firms', colour: PIN_COLOURS.fire, label: `FIRMS fire, ${when(detail.observation.observedAt)}`, ...detail.observation.location }] : []),
  ];
  const key: [string, string][] = [
    [points[0].colour, points[0].label],
    ...points.slice(1).map((p): [string, string] => [p.colour, p.id === 'farm' ? t(D.farmAsking) : p.id === 'chc' ? `CHC: ${machine?.chcName}` : t(D.satelliteFire)]),
  ];

  return (
    <div style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
      <Card padding="lg">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <Badge variant={closed ? 'neutral' : 'primary'}>{D.status[c.status] ? t(D.status[c.status]) : c.status}</Badge>
          {D.verification[c.verificationStatus] && <Badge variant={c.verificationStatus === 'NEEDS_REVIEW' ? 'warning' : 'neutral'}>{t(D.verification[c.verificationStatus])}</Badge>}
          {(detail.reports ?? 1) > 1 && <Badge variant="neutral">{t(D.reportsMerged, { n: detail.reports ?? 1 })}</Badge>}
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.id} · {t(D.version)} {c.version}</span>
        </div>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem', color: '#0f172a' }}>{typeName(detail.type ?? '', l)} · {detail.report.district}</h2>
        <div style={row}>
          <span>{t(D.reported)} {when(detail.report.reportedAt)}</span>
          {detail.deadline && <span>{t(D.actBy)} <strong>{when(detail.deadline)}</strong></span>}
        </div>
        {detail.escalatedAt && (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert variant="danger" title={t(D.escalated)}>{t(D.escalatedText, { to: (detail.escalatedTo ?? []).join(', '), at: when(detail.escalatedAt) })}</Alert>
          </div>
        )}
      </Card>

      {help && (
        <Card padding="lg" style={{ background: TONE.good.wash, border: `1.5px solid ${TONE.good.edge}` }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#14532d' }}>
            {help.status === 'OPEN' ? t(D.helpFirst) : t(D.helpIs, { status: help.status.toLowerCase() })}
          </h3>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <div style={row}><span>{t(D.farmLine, { crop: help.crop, acres: help.acreage, pct: help.coveragePercent })}</span><strong>{t(D.stillNeed, { acres: help.uncoveredAcres, machine: help.machineType })}</strong></div>
            <div style={row}><span>{t(D.neededBetween)}</span><span>{t(D.fromTo, { from: day(help.requiredFrom), to: day(help.requiredUntil) })}</span></div>
            {detail.helpLink && <div style={row}><span>{t(D.farm)}</span><span>{t(D.fromReport, { d: distanceText(detail.helpLink.distanceMeters) })}</span></div>}
          </div>
          {detail.helpLink?.ambiguous && (
            <div style={{ marginTop: '0.75rem' }}>
              <Alert variant="warning" title="Two farms are about as close">Another open request ({detail.helpLink.otherHelpRequestId}) is within 100 m of the same distance. Check which farm is burning before you send a machine.</Alert>
            </div>
          )}
          {machine ? (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', background: '#ffffff', border: `1px solid ${TONE.good.edge}`, fontSize: '0.9rem', color: '#14532d' }}>
              <strong>{t(D.machineFree, { machine: machine.machineType, chc: machine.chcName, from: day(machine.availableFrom), to: day(machine.availableUntil) })}</strong>
            </div>
          ) : (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#92400e' }}>{t(D.noMachine)}</p>
          )}
          {c.recommendationReason && <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#334155' }}>{c.recommendationReason}</p>}
        </Card>
      )}

      <Card padding="lg">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>
          {detail.type === 'farmer_support' ? t(D.theRequest) : detail.type === 'kisan_grievance' ? t(D.theComplaint) : t(D.theReport)}
        </h3>
        {detail.grievance && (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
            {D.grievance[detail.grievance.subtype] ? t(D.grievance[detail.grievance.subtype]) : detail.grievance.subtype}
            {detail.grievance.chcName ? ` · ${detail.grievance.chcName}` : ''}
          </p>
        )}
        {detail.report.description && <p style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#1e293b' }}>“{detail.report.description}”</p>}
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <div style={row}><span>{t(D.evidence)}</span><span>{c.evidenceSummary}</span></div>
          {detail.observation && (
            <div style={row}><span>{t(D.satellite)}</span><span>{t(D.firmsFire, { d: distanceText(detail.observation.distanceFromReportMeters ?? 0), at: when(detail.observation.observedAt) })}</span></div>
          )}
          <div style={row}><span>{t(D.sentTo)}</span><span>{(detail.authorities ?? []).join(', ')}</span></div>
          <div style={row}><span>{t(D.penalty)}</span><span>{detail.penalty ? (help?.status === 'OPEN' ? t(D.penaltyFirst) : t(D.penaltyPossible)) : detail.type === 'kisan_grievance' ? t(D.penaltyNeverComplaint) : t(D.penaltyNeverHelp)}</span></div>
        </div>
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
          <SlippyMap pins={points} label={t(D.mapLabel)} height="18rem" maxZoom={14} />
          <ul aria-label={fill(WORDS.mapKey, l)} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: '0.8rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#334155' }}>
            {key.map(([colour, name]) => (
              <li key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span aria-hidden="true" style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: colour, border: '2px solid #ffffff', boxShadow: '0 0 0 1px #cbd5e1' }} />
                {name}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card padding="lg">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>{t(D.decide)}</h3>
        {closed ? (
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>{t(D.isClosed)}</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: '#334155' }}>
              {t(D.reason)}
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontFamily: 'inherit' }} />
            </label>
            {machine && (
              <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: '#334155' }}>
                {t(D.machineToSend)}
                <input value={machineId} onChange={(e) => setMachineId(e.target.value)} style={{ padding: '0.45rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem' }} />
              </label>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {help?.status === 'OPEN' && <Button onClick={() => act('APPROVE')} disabled={busy}>{actionName('APPROVE')}</Button>}
              {help?.status === 'OPEN' && <Button variant="outline" onClick={() => act('CHANGE')} disabled={busy}>{actionName('CHANGE')}</Button>}
              {help && <Button variant="ghost" onClick={() => act('REJECT')} disabled={busy}>{actionName('REJECT')}</Button>}
              <Button variant="secondary" onClick={() => act('MARK_IN_FIELD')} disabled={busy}>{actionName('MARK_IN_FIELD')}</Button>
              <Button variant="secondary" onClick={() => act('RECORD_ACTION_TAKEN')} disabled={busy}>{actionName('RECORD_ACTION_TAKEN')}</Button>
              <Button variant="danger" onClick={() => act('CLOSE')} disabled={busy}>{actionName('CLOSE')}</Button>
            </div>
          </div>
        )}
        {message && <div style={{ marginTop: '0.75rem' }}><Alert variant={message.tone}>{message.text}</Alert></div>}
        {detail.decisions.length > 0 && (
          <ol style={{ margin: '1rem 0 0', paddingLeft: '1.1rem', display: 'grid', gap: '0.35rem', fontSize: '0.85rem', color: '#334155' }}>
            {detail.decisions.map((d) => (
              <li key={d.id}>
                <strong>{actionName(d.action)}</strong> · {when(d.createdAt)} · {d.officerId}: {d.reason}
                {d.selectedMachineId ? ` (${d.selectedMachineId})` : ''}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
