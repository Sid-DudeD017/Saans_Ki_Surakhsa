'use client';

// Kisan Saathi's Plan tab (P1): the farmer talks (hold to record) or types; the agent asks for what's
// missing, reads the plan back as a card, and files the request for help when the farmer says yes.
// The confirmed read-back also fills the farm profile the other tabs use.
import Link from 'next/link';
import React, { useRef, useState } from 'react';

import { Alert, Button, Card } from '../../components/ui';
import { useLanguage } from '../../lib/i18n';
import {
  KisanError,
  readbackOf,
  sendMessage,
  sendVoice,
  transcriptOf,
  type Language,
  type MessageResponse,
  type QuickReply,
  type Readback,
} from './kisanApi';
import { PlanCard } from './PlanCard';
import { say } from './strings';
import { useHoldToRecord } from './useHoldToRecord';

const GREEN = '#15803d';

interface Line {
  who: 'farmer' | 'agent';
  text: string;
  voice?: boolean;
}

function Bubble({ line, language }: { line: Line; language: Language }) {
  const farmer = line.who === 'farmer';
  return (
    <li style={{ display: 'flex', justifyContent: farmer ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '85%',
          minWidth: 0,
          padding: '0.75rem 1rem',
          borderRadius: farmer ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
          background: farmer ? '#dcfce7' : '#ffffff',
          border: farmer ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
          fontSize: '1.05rem',
          lineHeight: 1.5,
          color: '#0f172a',
          overflowWrap: 'anywhere',
        }}
      >
        {line.voice && (
          <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 2 }}>🎤 {say('heard', language)}</div>
        )}
        {line.text}
      </div>
    </li>
  );
}

export function KisanChat({ onConfirmed }: { onConfirmed?: (readback: Readback) => void }) {
  const { language: shellLanguage } = useLanguage();
  const [language, setLanguage] = useState<Language>(shellLanguage);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [readback, setReadback] = useState<Readback | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [filed, setFiled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement | null>(null);
  const lastReadback = useRef<Readback | null>(null);

  // A conversation keeps the language it started in; before that, follow the shell's switch.
  const lang: Language = sessionId ? language : shellLanguage;

  function show(r: MessageResponse) {
    setSessionId(r.session_id);
    setLines((old) => [...old, { who: 'agent', text: r.reply }]);
    const rb = readbackOf(r);
    if (rb) lastReadback.current = rb;
    if (r.filed && lastReadback.current) {
      onConfirmed?.(lastReadback.current);
      lastReadback.current = null;
    }
    setReadback(rb);
    setQuickReplies(r.quick_replies);
    setFiled(r.filed);
    window.setTimeout(() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  }

  async function turn(work: () => Promise<MessageResponse>) {
    if (!sessionId) setLanguage(shellLanguage);
    setBusy(true);
    setError(null);
    try {
      show(await work());
    } catch (e) {
      setError(e instanceof KisanError && e.status !== 0 ? e.message : say('network', lang));
    } finally {
      setBusy(false);
    }
  }

  function sendText(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setLines((old) => [...old, { who: 'farmer', text: clean }]);
    setDraft('');
    setReadback(null);
    void turn(() => sendMessage(clean, lang, sessionId));
  }

  const recorder = useHoldToRecord((audio, filename) => {
    setReadback(null);
    void turn(async () => {
      const r = await sendVoice(audio, filename, lang, sessionId);
      const heard = transcriptOf(r)?.text;
      setLines((old) => [...old, { who: 'farmer', text: heard || '🎤', voice: true }]);
      return r;
    });
  });

  function restart() {
    setSessionId(null);
    setLines([]);
    setReadback(null);
    setQuickReplies([]);
    setFiled(false);
    setError(null);
    lastReadback.current = null;
  }

  const recording = recorder.state === 'recording' || recorder.state === 'starting';
  const micKeys = (e: React.KeyboardEvent, down: boolean) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (down && !e.repeat) void recorder.start();
    if (!down) recorder.stop();
  };

  return (
    <div>
      {lines.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={restart}>
            ↺ {say('newChat', lang)}
          </Button>
        </div>
      )}

      {lines.length === 0 && (
        <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: 1.6, color: '#334155', maxWidth: '38rem' }}>
          {say('intro', lang)}
        </p>
      )}

      <ul aria-live="polite" style={{ listStyle: 'none', margin: '1.25rem 0 0', padding: 0, display: 'grid', gap: '0.75rem' }}>
        {lines.map((line, i) => (
          <Bubble key={i} line={line} language={lang} />
        ))}
        {busy && (
          <li style={{ color: '#64748b', fontSize: '0.95rem' }} role="status">
            {say('thinking', lang)}
          </li>
        )}
      </ul>

      {readback && !filed && (
        <div style={{ marginTop: '1rem' }}>
          <PlanCard
            readback={readback}
            language={lang}
            busy={busy}
            onAnswer={(yes) => sendText(say(yes ? 'yesSays' : 'noSays', lang))}
          />
        </div>
      )}

      {quickReplies.length > 0 && !filed && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.5rem' }}>{say('checkNumbers', lang)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {quickReplies.map((q) => (
              <Button key={`${q.slot}-${q.value}`} variant="outline" size="lg" disabled={busy} onClick={() => sendText(q.send_text)}>
                {q.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {filed && sessionId && (
        <div style={{ marginTop: '1rem' }}>
          <Card padding="lg" style={{ borderColor: GREEN, borderWidth: 2, background: '#f0fdf4' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: GREEN }}>✓ {say('filedTitle', lang)}</h2>
            <Link
              href={`/kisan/status/${encodeURIComponent(sessionId)}?lang=${lang}`}
              style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '1.05rem', fontWeight: 600, color: '#0369a1' }}
            >
              {say('seeStatus', lang)} →
            </Link>
          </Card>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '1rem' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <div ref={bottom} />

      {!filed && (
        <section style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem', justifyItems: 'center' }}>
          <button
            type="button"
            disabled={busy}
            aria-pressed={recording}
            aria-label={say('holdToTalk', lang)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              void recorder.start();
            }}
            onPointerUp={recorder.stop}
            onPointerCancel={recorder.stop}
            onKeyDown={(e) => micKeys(e, true)}
            onKeyUp={(e) => micKeys(e, false)}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              width: '6rem',
              height: '6rem',
              borderRadius: '50%',
              border: 'none',
              background: recording ? '#dc2626' : GREEN,
              color: '#ffffff',
              fontSize: '2.5rem',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
              boxShadow: recording ? '0 0 0 10px rgba(220, 38, 38, 0.2)' : '0 4px 12px rgba(21, 128, 61, 0.3)',
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            🎤
          </button>
          <div role="status" style={{ fontSize: '1rem', color: recording ? '#dc2626' : '#334155', textAlign: 'center', minHeight: '1.5rem' }}>
            {recorder.state === 'recording'
              ? `${say('recording', lang)} 0:${String(recorder.seconds).padStart(2, '0')}`
              : recorder.state === 'too_short'
                ? say('tooShort', lang)
                : recorder.state === 'unavailable'
                  ? say('micDenied', lang)
                  : say('holdToTalk', lang)}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendText(draft);
            }}
            style={{ display: 'flex', gap: '0.5rem', width: '100%' }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={say('typeHere', lang)}
              aria-label={say('typeHere', lang)}
              maxLength={2000}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '0.75rem 1rem',
                fontSize: '1.05rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
              }}
            />
            <Button type="submit" size="lg" disabled={busy || !draft.trim()}>
              {say('send', lang)}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
