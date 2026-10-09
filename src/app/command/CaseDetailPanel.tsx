'use client';

// One case in the console (P4). The farmer's open help request comes first, with the machine that can be
// sent, and only then the report and the actions, so help is offered before any penalty.
import React, { useState } from 'react';

import { Alert, Badge, Button, Card } from '../../components/ui';
import { CaseMap, type MapPoint } from './CaseMap';
import { ApiError, actOnCase, type CaseAction, type CaseDetail } from './commandApi';

const TYPE_NAMES: Record<string, string> = {
  farm_fire: 'Farm fire',
  garbage: 'Garbage burning',
  vehicle: 'Smoky vehicle',
  firecrackers: 'Firecrackers',
  farmer_support: 'Farmer asks for a machine',
};
const STATUS_NAMES: Record<string, string> = { OPEN: 'Open', ACTION_APPROVED: 'Help approved', ACTION_CHANGED: 'Changed', CLOSED: 'Closed' };
const ACTION_NAMES: Record<CaseAction, string> = {
  APPROVE: 'Send the machine',
  CHANGE: 'Send a different machine',
  REJECT: 'Reject the recommendation',
  MARK_IN_FIELD: 'Officer in the field',
  RECORD_ACTION_TAKEN: 'Record action taken',
  CLOSE: 'Close the case',
};

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

export function CaseDetailPanel({ detail, onChanged }: { detail: CaseDetail; onChanged: () => void }) {
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
      setMessage({ tone: 'warning', text: 'Write a reason first: every decision is recorded with one.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const sendsMachine = action === 'APPROVE' || action === 'CHANGE';
      await actOnCase(c.id, { action, reason: reason.trim(), previousCaseVersion: c.version, ...(sendsMachine && machineId ? { selectedMachineId: machineId } : {}) });
      setReason('');
      setMessage({ tone: 'success', text: `${ACTION_NAMES[action]}: recorded.` });
      onChanged();
    } catch (e) {
      const conflict = e instanceof ApiError && e.code === 'version_conflict';
      setMessage({ tone: 'danger', text: conflict ? 'Someone else changed this case. It has been reloaded; decide again.' : (e as Error).message });
      if (conflict) onChanged();
    } finally {
      setBusy(false);
    }
  };

  const points: MapPoint[] = [
    { id: 'report', kind: detail.type === 'farmer_support' ? 'farm' : 'report', label: detail.type === 'farmer_support' ? 'The farm' : 'The report', ...detail.report.location },
    ...(help && detail.type !== 'farmer_support' ? [{ id: 'farm', kind: 'farm' as const, label: `The farm with the open help request (${help.id})`, ...help.farmLocation }] : []),
    ...(machine ? [{ id: 'chc', kind: 'chc' as const, label: `${machine.chcName}: ${machine.machineType}`, ...machine.location }] : []),
  ];

  return (
    <div style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
      <Card padding="lg">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <Badge variant={closed ? 'neutral' : 'primary'}>{STATUS_NAMES[c.status]}</Badge>
          {c.verificationStatus === 'NEEDS_REVIEW' && <Badge variant="warning">Evidence needs review</Badge>}
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.id} · version {c.version}</span>
        </div>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem', color: '#0f172a' }}>{TYPE_NAMES[detail.type ?? ''] ?? detail.type} · {detail.report.district}</h2>
        <div style={row}>
          <span>Reported {when(detail.report.reportedAt)}</span>
          {detail.deadline && <span>Act by <strong>{when(detail.deadline)}</strong></span>}
        </div>
      </Card>

      {help && (
        <Card padding="lg" style={{ borderLeft: '6px solid #16a34a' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#14532d' }}>
            {help.status === 'OPEN' ? 'Help before penalty: this farmer asked for a machine' : `The farmer's help request is ${help.status.toLowerCase()}`}
          </h3>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <div style={row}><span>{help.crop}, {help.acreage} acres; {help.coveragePercent}% covered by the farmer&apos;s own plan</span><strong>{help.uncoveredAcres} acres still need a {help.machineType}</strong></div>
            <div style={row}><span>Needed between</span><span>{day(help.requiredFrom)} and {day(help.requiredUntil)}</span></div>
            {detail.helpLink && <div style={row}><span>Farm</span><span>{distanceText(detail.helpLink.distanceMeters)} from the report</span></div>}
          </div>
          {detail.helpLink?.ambiguous && (
            <div style={{ marginTop: '0.75rem' }}>
              <Alert variant="warning" title="Two farms are about as close">Another open request ({detail.helpLink.otherHelpRequestId}) is within 100 m of the same distance. Check which farm is burning before you send a machine.</Alert>
            </div>
          )}
          {machine ? (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', background: '#f0fdf4', fontSize: '0.9rem', color: '#14532d' }}>
              <strong>{machine.machineType} at {machine.chcName}</strong>, free from {day(machine.availableFrom)} to {day(machine.availableUntil)}.
            </div>
          ) : (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#92400e' }}>No CHC machine of this type is free in the farmer&apos;s window.</p>
          )}
          {c.recommendationReason && <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#334155' }}>{c.recommendationReason}</p>}
        </Card>
      )}

      <Card padding="lg">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>{detail.type === 'farmer_support' ? 'The request' : 'The report'}</h3>
        {detail.report.description && <p style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#1e293b' }}>“{detail.report.description}”</p>}
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <div style={row}><span>Evidence</span><span>{c.evidenceSummary}</span></div>
          <div style={row}><span>Sent to</span><span>{(detail.authorities ?? []).join(', ')}</span></div>
          <div style={row}><span>Penalty</span><span>{detail.penalty ? (help?.status === 'OPEN' ? 'Possible, but offer the machine first' : 'Possible') : 'Never: this is a request for help'}</span></div>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <CaseMap points={points} title="The report, the farm and the CHC" />
        </div>
      </Card>

      <Card padding="lg">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>Decide</h3>
        {closed ? (
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>This case is closed.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: '#334155' }}>
              Reason (recorded with the decision)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontFamily: 'inherit' }} />
            </label>
            {machine && (
              <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: '#334155' }}>
                Machine to send
                <input value={machineId} onChange={(e) => setMachineId(e.target.value)} style={{ padding: '0.45rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem' }} />
              </label>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {help?.status === 'OPEN' && <Button onClick={() => act('APPROVE')} disabled={busy}>{ACTION_NAMES.APPROVE}</Button>}
              {help?.status === 'OPEN' && <Button variant="outline" onClick={() => act('CHANGE')} disabled={busy}>{ACTION_NAMES.CHANGE}</Button>}
              {help && <Button variant="ghost" onClick={() => act('REJECT')} disabled={busy}>{ACTION_NAMES.REJECT}</Button>}
              <Button variant="secondary" onClick={() => act('MARK_IN_FIELD')} disabled={busy}>{ACTION_NAMES.MARK_IN_FIELD}</Button>
              <Button variant="secondary" onClick={() => act('RECORD_ACTION_TAKEN')} disabled={busy}>{ACTION_NAMES.RECORD_ACTION_TAKEN}</Button>
              <Button variant="danger" onClick={() => act('CLOSE')} disabled={busy}>{ACTION_NAMES.CLOSE}</Button>
            </div>
          </div>
        )}
        {message && <div style={{ marginTop: '0.75rem' }}><Alert variant={message.tone}>{message.text}</Alert></div>}
        {detail.decisions.length > 0 && (
          <ol style={{ margin: '1rem 0 0', paddingLeft: '1.1rem', display: 'grid', gap: '0.35rem', fontSize: '0.85rem', color: '#334155' }}>
            {detail.decisions.map((d) => (
              <li key={d.id}>
                <strong>{ACTION_NAMES[d.action as CaseAction] ?? d.action}</strong> · {when(d.createdAt)} · {d.officerId}: {d.reason}
                {d.selectedMachineId ? ` (${d.selectedMachineId})` : ''}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
