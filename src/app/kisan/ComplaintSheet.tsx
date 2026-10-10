'use client';

// A farmer's complaint (K20) in three short steps: what happened, details, check and send. It goes to
// Saans Command as a kisan_grievance: a case for the district agriculture officer, never a penalty.
// The idempotency key belongs to the draft, and an uploaded photo is kept for retries, so a weak
// network or a double tap gives one ticket, not two.
import React, { useRef, useState } from 'react';

import { Alert, Button, Card } from '../../components/ui';
import { uploadEvidencePhoto } from '../../lib/api';
import { farmStore } from './farmProfile';
import { ABOUT_A_CHC, GRIEVANCE_SUBTYPES, addTicket, farmPoint, type GrievanceSubtype } from './help';
import { KisanError, submitGrievance, type KisanGrievance, type Language } from './kisanApi';
import { complaintPhoto, newId } from './photoPrep';
import { say, sayWith, type StringKey } from './strings';

type Step = 'closed' | 'what' | 'details' | 'review' | 'sent';
type Evidence = NonNullable<KisanGrievance['evidence']>[number];

const BIG: React.CSSProperties = { minHeight: '3rem', fontSize: '1rem' };
const FIELD: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.9rem',
  fontSize: '1.05rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  fontFamily: 'inherit',
};

export const subtypeKey = (s: GrievanceSubtype) => `g_${s}` as StringKey;

export function ComplaintSheet({ language }: { language: Language }) {
  const farm = farmStore.use();
  const [step, setStep] = useState<Step>('closed');
  const [subtype, setSubtype] = useState<GrievanceSubtype | null>(null);
  const [text, setText] = useState('');
  const [chc, setChc] = useState('');
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const draft = useRef<{ key: string; evidence?: Evidence[] }>({ key: '' });
  const picker = useRef<HTMLInputElement | null>(null);
  const point = farmPoint(farm);

  function start() {
    draft.current = { key: newId() };
    setSubtype(null);
    setText('');
    setChc('');
    setPhoto(null);
    setError(null);
    setTicket(null);
    setCopied(false);
    setStep('what');
  }

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto({ file, preview: URL.createObjectURL(file) });
    draft.current.evidence = undefined; // a new photo is a new upload
  }

  function dropPhoto() {
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto(null);
    draft.current.evidence = undefined;
  }

  async function send() {
    if (!subtype || !point) return;
    setBusy(true);
    setError(null);
    try {
      if (photo && !draft.current.evidence) {
        const { blob, sha256 } = await complaintPhoto(photo.file);
        const up = await uploadEvidencePhoto(blob, sha256);
        draft.current.evidence = [{ ...up, captured_timestamp: new Date().toISOString(), location: point }];
      }
      const body: KisanGrievance = {
        type: 'kisan_grievance',
        location: point,
        subtype,
        ...(text.trim() ? { description: text.trim().slice(0, 1000) } : {}),
        ...(ABOUT_A_CHC.includes(subtype) && chc.trim() ? { chc_name: chc.trim().slice(0, 120) } : {}),
        evidence: draft.current.evidence ?? [],
      };
      const res = await submitGrievance(body, draft.current.key);
      addTicket({ id: res.id, subtype, sentAt: new Date().toISOString() });
      setTicket(res.id);
      setStep('sent');
      if (photo) URL.revokeObjectURL(photo.preview);
      setPhoto(null);
    } catch (e) {
      // A KisanError with status 0 is no network; the photo upload throws plain Errors with its reason.
      const why = e instanceof KisanError ? (e.status !== 0 ? e.message : say('network', language)) : e instanceof Error ? e.message : say('network', language);
      setError(sayWith('complaintFailed', language, { why }));
    } finally {
      setBusy(false);
    }
  }

  function copyTicket() {
    if (!ticket) return;
    navigator.clipboard?.writeText(ticket).then(() => setCopied(true), () => {
      const el = document.getElementById('kisan-ticket-number');
      if (el) window.getSelection()?.selectAllChildren(el);
    });
  }

  const dots = (n: number) => (
    <div aria-hidden="true" style={{ display: 'flex', gap: '0.3rem' }}>
      {[1, 2, 3].map((i) => (
        <span key={i} style={{ flex: 1, height: '0.3rem', borderRadius: '1rem', background: i <= n ? '#15803d' : '#e2e8f0' }} />
      ))}
    </div>
  );

  return (
    <Card padding="md">
      <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>📝 {say('complainTitle', language)}</h2>

      {step === 'closed' && (
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.35rem' }}>
          <p style={{ margin: 0, lineHeight: 1.5, color: '#334155' }}>{say('complainIntro', language)}</p>
          <div>
            <Button size="lg" onClick={start} style={BIG}>
              {say('startComplaint', language)}
            </Button>
          </div>
        </div>
      )}

      {step === 'what' && (
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
          {dots(1)}
          <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
            <legend style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem', padding: 0 }}>{say('whatHappened', language)}</legend>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {GRIEVANCE_SUBTYPES.map((s) => (
                <Button key={s} variant={subtype === s ? 'primary' : 'outline'} aria-pressed={subtype === s} onClick={() => setSubtype(s)} style={{ ...BIG, justifyContent: 'flex-start', textAlign: 'left' }}>
                  {say(subtypeKey(s), language)}
                </Button>
              ))}
            </div>
          </fieldset>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button size="lg" disabled={!subtype} onClick={() => setStep('details')} style={BIG}>
              {say('next', language)}
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setStep('closed')} style={BIG}>
              {say('cancel', language)}
            </Button>
          </div>
        </div>
      )}

      {step === 'details' && subtype && (
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
          {dots(2)}
          <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{say(subtypeKey(subtype), language)}</p>
          {ABOUT_A_CHC.includes(subtype) && (
            <label htmlFor="kisan-complaint-chc" style={{ display: 'grid', gap: '0.3rem', color: '#334155' }}>
              {say('whichChc', language)}
              <input id="kisan-complaint-chc" value={chc} onChange={(e) => setChc(e.target.value)} maxLength={120} style={{ ...FIELD, minHeight: '3rem' }} />
            </label>
          )}
          <label htmlFor="kisan-complaint-text" style={{ display: 'grid', gap: '0.3rem', color: '#334155' }}>
            {say('tellMore', language)}
            <textarea
              id="kisan-complaint-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder={say('tellMoreHint', language)}
              style={{ ...FIELD, resize: 'vertical' }}
            />
          </label>
          <input ref={picker} type="file" accept="image/*" onChange={pickPhoto} hidden />
          {photo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: preview */}
              <img src={photo.preview} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '0.5rem' }} />
              <Button variant="ghost" onClick={dropPhoto} style={{ minHeight: '2.75rem' }}>
                {say('remove', language)}
              </Button>
            </div>
          ) : (
            <div>
              <Button variant="secondary" onClick={() => picker.current?.click()} style={BIG}>
                📷 {say('addPhoto', language)}
              </Button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button size="lg" onClick={() => setStep('review')} style={BIG}>
              {say('next', language)}
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setStep('what')} style={BIG}>
              {say('goBack', language)}
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && subtype && (
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
          {dots(3)}
          <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>{say('checkAndSend', language)}</p>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', display: 'grid', gap: '0.35rem', color: '#0f172a' }}>
            <strong>{say(subtypeKey(subtype), language)}</strong>
            {ABOUT_A_CHC.includes(subtype) && chc.trim() && <span>CHC: {chc.trim()}</span>}
            {text.trim() && <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text.trim()}</span>}
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview
              <img src={photo.preview} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: '0.5rem' }} />
            )}
          </div>
          {!point && <p role="alert" style={{ margin: 0, color: '#b45309' }}>{say('complaintNeedsLocation', language)}</p>}
          {error && <Alert variant="danger">{error}</Alert>}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button size="lg" onClick={() => void send()} disabled={busy || !point} style={BIG}>
              {busy ? say('sendingComplaint', language) : `✓ ${say('sendComplaint', language)}`}
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setStep('details')} disabled={busy} style={BIG}>
              {say('goBack', language)}
            </Button>
          </div>
        </div>
      )}

      {step === 'sent' && ticket && (
        <div role="status" style={{ display: 'grid', gap: '0.6rem', marginTop: '0.75rem', border: '2px solid #15803d', background: '#f0fdf4', borderRadius: '0.75rem', padding: '0.9rem' }}>
          <strong style={{ fontSize: '1.15rem', color: '#15803d' }}>✓ {say('sentTitle', language)}</strong>
          <span style={{ color: '#334155' }}>{say('yourTicket', language)}</span>
          <span id="kisan-ticket-number" style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', overflowWrap: 'anywhere', userSelect: 'all' }}>
            {ticket}
          </span>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>{say('keepTicket', language)}</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={copyTicket} style={{ minHeight: '2.75rem' }}>
              {copied ? `✓ ${say('copied', language)}` : say('copy', language)}
            </Button>
            <Button onClick={() => setStep('closed')} style={{ minHeight: '2.75rem' }}>
              {say('done', language)}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
