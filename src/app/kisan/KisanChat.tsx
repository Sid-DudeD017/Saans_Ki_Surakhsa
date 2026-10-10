'use client';

// Kisan Saathi's Plan tab (P1): the farmer talks (tap or hold the mic) or types; the agent asks for
// what's missing, reads the plan back as a card, and files the request for help when the farmer says
// yes. A checklist shows what the agent still needs, ticking as he speaks, with an example sentence
// for the next gap. The confirmed read-back also fills the farm profile the other tabs use.
import Link from 'next/link';
import React, { useRef, useState, useSyncExternalStore } from 'react';

import { Alert, Button, Card } from '../../components/ui';
import { useLanguage } from '../../lib/i18n';
import {
  KisanError,
  readbackOf,
  type FarmHint,
  sendMessage,
  sendVoice,
  transcriptOf,
  type Language,
  type MessageResponse,
  type QuickReply,
  type Readback,
} from './kisanApi';
import { PlanCard } from './PlanCard';
import { NeedsList } from './NeedsList';
import { say, type StringKey } from './strings';
import { useVoiceNote } from './useVoiceNote';
import { doneFromHint, doneFromMissing, hintFor } from './voice';
import { VoiceButton } from './VoiceButton';

const GREEN = '#15803d';
const noSubscribe = () => () => {};

interface Line {
  who: 'farmer' | 'agent';
  text: string;
  voice?: boolean;
  pending?: boolean; // a voice note on its way to the agent
  seconds?: number;
}

function Bubble({ line, language, onFix }: { line: Line; language: Language; onFix?: (text: string) => void }) {
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
        {line.pending ? (
          <span style={{ color: '#166534' }}>
            🎤 {say('voiceNote', language)} · {Math.floor((line.seconds ?? 0) / 60)}:{String((line.seconds ?? 0) % 60).padStart(2, '0')} …
          </span>
        ) : (
          <>
            {line.voice && (
              <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 2 }}>🎤 {say('heard', language)}</div>
            )}
            {line.text}
            {line.voice && onFix && line.text && (
              <button
                type="button"
                onClick={() => onFix(line.text)}
                style={{ display: 'block', marginTop: '0.35rem', padding: 0, border: 'none', background: 'none', color: '#0369a1', fontFamily: 'inherit', fontSize: '0.85rem', textDecoration: 'underline', cursor: 'pointer', minHeight: '1.75rem' }}
              >
                {say('fixHeard', language)}
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export function KisanChat({ onConfirmed, farm }: { onConfirmed?: (readback: Readback) => void; farm?: () => FarmHint | undefined }) {
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
  const [missing, setMissing] = useState<string[] | null>(null);
  const [understanding, setUnderstanding] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const typed = useRef<HTMLInputElement | null>(null);
  const lastReadback = useRef<Readback | null>(null);

  // A conversation keeps the language it started in; before that, follow the shell's switch.
  const lang: Language = sessionId ? language : shellLanguage;

  function show(r: MessageResponse) {
    setSessionId(r.session_id);
    setMissing(r.missing);
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
    void turn(() => sendMessage(clean, lang, sessionId, sessionId ? undefined : farm?.()));
  }

  const recorder = useVoiceNote((audio, filename, seconds) => {
    setReadback(null);
    setUnderstanding(true);
    setLines((old) => [...old, { who: 'farmer', text: '', voice: true, pending: true, seconds }]);
    window.setTimeout(() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
    void turn(async () => {
      const r = await sendVoice(audio, filename, lang, sessionId, sessionId ? undefined : farm?.());
      const heard = transcriptOf(r)?.text;
      setLines((old) => old.map((l) => (l.pending ? { who: 'farmer', text: heard || '🎤', voice: true } : l)));
      return r;
    }).finally(() => {
      setUnderstanding(false);
      // Didn't get through: keep the note in the conversation, marked as not heard.
      setLines((old) => old.map((l) => (l.pending ? { who: 'farmer', text: '', voice: true } : l)));
    });
  });

  /** "Heard wrong? Fix it": the words go into the text box to correct and send as text. */
  function fix(text: string) {
    setDraft(text);
    window.setTimeout(() => {
      typed.current?.focus();
      typed.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  function restart() {
    setSessionId(null);
    setLines([]);
    setReadback(null);
    setQuickReplies([]);
    setFiled(false);
    setError(null);
    setMissing(null);
    lastReadback.current = null;
  }

  const live = recorder.state === 'recording' || recorder.state === 'starting';
  // What the agent still needs: its last answer, or before that what the farm card will tell it. The
  // farm card lives on the phone, so the server's first render (and hydration) shows nothing ticked.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const done = missing ? doneFromMissing(missing) : doneFromHint(hydrated ? farm?.() : undefined);
  const hint = !filed && !readback ? hintFor(done) : null;

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

      {!filed && (
        <div style={{ marginTop: '1rem' }}>
          <NeedsList done={done} language={lang} />
        </div>
      )}

      <ul aria-live="polite" style={{ listStyle: 'none', margin: '1.25rem 0 0', padding: 0, display: 'grid', gap: '0.75rem' }}>
        {lines.map((line, i) => (
          <Bubble key={i} line={line} language={lang} onFix={filed ? undefined : fix} />
        ))}
        {busy && !understanding && (
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
          {hint && (
            // Hidden, not removed, while recording or sending, so the mic doesn't jump under his finger.
            <div aria-hidden={busy || live} style={{ display: 'grid', gap: '0.2rem', textAlign: 'center', maxWidth: '30rem', visibility: busy || live ? 'hidden' : 'visible' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{say('trySaying', lang)}</span>
              <span id="kisan-try-saying" style={{ fontSize: '1.05rem', color: '#14532d', lineHeight: 1.5 }}>
                “{say(`say_${hint}` as StringKey, lang)}”
              </span>
            </div>
          )}
          <VoiceButton recorder={recorder} busy={busy} understanding={understanding} language={lang} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendText(draft);
            }}
            style={{ display: 'flex', gap: '0.5rem', width: '100%' }}
          >
            <input
              ref={typed}
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
