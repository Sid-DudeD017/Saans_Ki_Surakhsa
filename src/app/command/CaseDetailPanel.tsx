'use client';

import React, { useState } from 'react';
import { Alert, Badge, Button, Card } from '../../components/ui';
import { CaseMap, type MapPoint } from './CaseMap';
import { ApiError, actOnTicket } from './commandApi';
import { translations, type Lang } from './i18n';

const TYPE_NAMES: Record<string, string> = {
  farm_fire: 'Farm fire',
  garbage: 'Garbage burning',
  vehicle: 'Smoky vehicle',
  firecrackers: 'Firecrackers',
  farmer_support: 'Farmer asks for a machine',
};

export function when(iso: string) {
  const [date, time] = iso.split('T');
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}, ${time.slice(0, 5)}`;
}

const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.875rem', color: '#334155', flexWrap: 'wrap' };

export function CaseDetailPanel({ detail, officer, lang, onChanged }: { detail: any; officer: string; lang: Lang; onChanged: () => void }) {
  const tr = translations[lang];
  const t = detail.ticket;
  const closed = t.status === 'closed' || t.status === 'resolved';
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState('low');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null);

  const act = async (action: string) => {
    if ((action === 'resolve' && !summary.trim()) || (action === 'override_threat' && !reason.trim()) || (action === 'note' && !reason.trim()) || (action === 'request_info' && !reason.trim())) {
      setMessage({ tone: 'warning', text: 'Provide a reason or summary for this action.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const payload: any = { action };
      if (reason) payload.reason = reason;
      if (summary) payload.summary = summary;
      if (action === 'override_threat') payload.overrideThreatLevel = overrideLevel;
      
      await actOnTicket(t.id, payload, officer);
      setReason('');
      setSummary('');
      setMessage({ tone: 'success', text: `Action recorded.` });
      onChanged();
    } catch (e: any) {
      setMessage({ tone: 'danger', text: e.message || 'Error executing action' });
    } finally {
      setBusy(false);
    }
  };

  const points: MapPoint[] = t.location ? [{ id: 'report', kind: t.type === 'farmer_support' ? 'farm' : 'report', label: TYPE_NAMES[t.type] || 'Report', ...t.location }] : [];

  return (
    <div style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
      <Card padding="lg">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <Badge variant={closed ? 'neutral' : 'primary'}>{t.status.toUpperCase()}</Badge>
          {t.automated_label && <Badge variant="warning">{tr.automated_rec}</Badge>}
          {t.threat_level && <Badge variant={t.threat_level === 'critical' ? 'danger' : 'warning'}>{tr.threat}: {t.threat_level}</Badge>}
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.id}</span>
        </div>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem', color: '#0f172a' }}>{TYPE_NAMES[t.type] ?? t.type} · {t.district || 'Unassigned'}</h2>
        <div style={row}>
          <span>{tr.created} {when(t.created_at)}</span>
          {t.deadline && <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>{tr.sla} {when(t.deadline)}</span>}
        </div>
      </Card>

      <Card padding="lg">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>{tr.threat}</h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>{tr.current_threat}: {t.threat_level || 'None'}</p>
        {t.threat_reasons && t.threat_reasons.length > 0 && (
           <ul style={{ margin: '0.5rem 0', fontSize: '0.85rem' }}>{t.threat_reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
        )}
        {t.override && (
           <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#c2410c' }}>{tr.overridden_by} {t.override.by}: {t.override.reason} ({t.override.level})</p>
        )}
      </Card>

      <Card padding="lg">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>{tr.notes}</h3>
        {t.internal_notes && t.internal_notes.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <strong>{tr.internal_notes}:</strong>
            <ul style={{ fontSize: '0.85rem', paddingLeft: '1.2rem' }}>
              {t.internal_notes.map((n: any, i: number) => <li key={i}>[{when(n.at)}] {n.by}: {n.text}</li>)}
            </ul>
          </div>
        )}
        {t.evidence && t.evidence.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <strong>{tr.evidence}:</strong> {t.evidence.join(', ')}
          </div>
        )}
        <div style={{ marginTop: '0.75rem' }}>
          <CaseMap points={points} title="The report location" />
        </div>
      </Card>

      <Card padding="lg">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>{tr.actions}</h3>
        {closed ? (
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>{tr.resolved_desc} Resolution: {t.resolution_summary}</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: '#334155' }}>
              {tr.reason_note}
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontFamily: 'inherit' }} />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button style={{ minHeight: '44px' }} onClick={() => act('accept')} disabled={busy}>{tr.accept}</Button>
              <Button style={{ minHeight: '44px' }} variant="outline" onClick={() => act('note')} disabled={busy}>{tr.add_note}</Button>
              <Button style={{ minHeight: '44px' }} variant="ghost" onClick={() => act('request_info')} disabled={busy}>{tr.request_info}</Button>
            </div>
            
            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />
            
            <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: '#334155' }}>
              {tr.resolve_summary}
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontFamily: 'inherit' }} />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button style={{ minHeight: '44px' }} variant="danger" onClick={() => act('resolve')} disabled={busy}>{tr.resolve}</Button>
            </div>
            
            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />
            
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', color: '#334155', minHeight: '44px' }}>
                {tr.new_level}
                <select value={overrideLevel} onChange={(e) => setOverrideLevel(e.target.value)} style={{ padding: '0.4rem', borderRadius: '0.25rem', minHeight: '44px' }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <Button style={{ minHeight: '44px' }} variant="outline" onClick={() => act('override_threat')} disabled={busy}>{tr.override_threat}</Button>
            </div>
          </div>
        )}
        {message && <div style={{ marginTop: '0.75rem' }}><Alert variant={message.tone}>{message.text}</Alert></div>}
      </Card>
    </div>
  );
}
