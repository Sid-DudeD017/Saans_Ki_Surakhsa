'use client';

// The Plan tab's mic (hero of Kisan Saathi). Tap once to talk and again to send (it also sends itself
// when the farmer goes quiet), or hold and let go; slide left while holding to cancel. Sound bars and
// a ring that grows with his voice show it is hearing him, and one line under it says which step
// it's on: listening, understanding, or why nothing was sent.
import React, { useRef, useState, useSyncExternalStore } from 'react';

import type { Language } from './kisanApi';
import { say, sayWith } from './strings';
import type { useVoiceNote } from './useVoiceNote';

const GREEN = '#15803d';
const RED = '#dc2626';
const TAP_MS = 350; // a press shorter than this is a tap: keep listening after the finger lifts
const CANCEL_PX = 70; // how far left a held finger slides to cancel

type Recorder = ReturnType<typeof useVoiceNote>;

const noSubscribe = () => () => {};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const VOICE_KEYFRAMES = `
@keyframes kisan-spin { to { transform: rotate(360deg) } }
@keyframes kisan-pulse { 0% { transform: scale(1); opacity: .45 } 100% { transform: scale(1.6); opacity: 0 } }
@keyframes kisan-pop { 0% { transform: scale(.6) } 60% { transform: scale(1.15) } 100% { transform: scale(1) } }
@media (prefers-reduced-motion: reduce) { .kisan-motion { animation: none !important; transition: none !important } }
`;

function MicIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
    </svg>
  );
}

function SendIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12l16-8-6 16-3-7-7-1z" />
    </svg>
  );
}

function CrossIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function VoiceButton({ recorder, busy, understanding, language }: { recorder: Recorder; busy: boolean; understanding: boolean; language: Language }) {
  const { state, seconds, levels, latched } = recorder;
  const [armed, setArmed] = useState(false); // a held finger has slid far enough left to cancel
  const pressing = useRef(false);
  const pressAt = useRef(0);
  const startX = useRef(0);
  const swallowRelease = useRef(false);
  const ready = useSyncExternalStore(noSubscribe, () => true, () => false); // false until the page is interactive

  const live = state === 'recording' || state === 'starting';
  const level = live ? Math.max(...levels) : 0;

  function press(x: number) {
    if (busy && !live) return;
    if (live && latched) {
      // Second tap: send.
      swallowRelease.current = true;
      recorder.stop();
      return;
    }
    if (live) return;
    pressing.current = true;
    pressAt.current = Date.now();
    startX.current = x;
    setArmed(false);
    void recorder.start();
  }

  function move(x: number) {
    if (!pressing.current || latched) return;
    setArmed(x - startX.current < -CANCEL_PX);
  }

  function release() {
    if (swallowRelease.current) {
      swallowRelease.current = false;
      return;
    }
    if (!pressing.current) return;
    pressing.current = false;
    if (armed) {
      setArmed(false);
      recorder.cancel();
      return;
    }
    // A quick tap, or a release while the browser was still asking for the mic: keep listening.
    if (state === 'starting' || Date.now() - pressAt.current < TAP_MS) recorder.latch();
    else recorder.stop();
  }

  function keys(e: React.KeyboardEvent, down: boolean) {
    if (e.key === 'Escape' && live) {
      e.preventDefault();
      recorder.cancel();
      return;
    }
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (down && !e.repeat) press(0);
    if (!down) release();
  }

  const colour = armed ? '#64748b' : live ? RED : GREEN;
  const status = understanding
    ? say('understanding', language)
    : state === 'starting'
      ? say('micStarting', language)
      : state === 'recording'
        ? armed
          ? say('releaseToCancel', language)
          : sayWith(latched ? 'listeningTap' : 'listeningHold', language, { time: clock(seconds) })
        : state === 'too_short'
          ? say('tooShort', language)
          : state === 'cancelled'
            ? say('cancelled', language)
            : state === 'no_speech'
              ? say('noSpeech', language)
              : state === 'unavailable'
                ? say('micDenied', language)
                : say('tapOrHold', language);
  const warn = !live && !understanding && (state === 'too_short' || state === 'no_speech' || state === 'unavailable');

  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: '0.6rem', width: '100%' }}>
      <style>{VOICE_KEYFRAMES}</style>

      {/* Sound bars: how loud he is right now. Height is kept when idle so nothing jumps. */}
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 40 }}>
        {levels.map((l, i) => (
          <span
            key={i}
            className="kisan-motion"
            style={{
              width: 6,
              height: live ? 6 + Math.round(l * 34) : 6,
              borderRadius: 3,
              background: live ? colour : '#cbd5e1',
              transition: 'height 90ms linear',
              opacity: live ? 1 : 0.5,
            }}
          />
        ))}
      </div>

      {/* Margin for the ring, which grows up to ~1.6x with his voice, so it doesn't cover the bars or the status line. */}
      <div style={{ position: 'relative', width: '7rem', height: '7rem', margin: '1.5rem 0', display: 'grid', placeItems: 'center' }}>
        {state === 'recording' && !armed && (
          <>
            <span className="kisan-motion" aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: colour, animation: 'kisan-pulse 1.4s ease-out infinite' }} />
            <span
              className="kisan-motion"
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(220, 38, 38, 0.18)', transform: `scale(${1 + level * 0.45})`, transition: 'transform 90ms linear' }}
            />
          </>
        )}
        {understanding && (
          <span
            className="kisan-motion"
            aria-hidden="true"
            style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '4px solid #bbf7d0', borderTopColor: GREEN, animation: 'kisan-spin 0.9s linear infinite' }}
          />
        )}
        <button
          type="button"
          id="kisan-mic"
          data-ready={ready}
          aria-label={live ? status : say('tapOrHold', language)}
          aria-pressed={live}
          aria-disabled={busy && !live}
          onPointerDown={(e) => {
            try {
              e.currentTarget.setPointerCapture(e.pointerId); // keep getting the slide when the finger leaves the button
            } catch {
              // Some browsers refuse capture for synthetic or already-lifted pointers; the press still counts.
            }
            press(e.clientX);
          }}
          onPointerMove={(e) => move(e.clientX)}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={(e) => keys(e, true)}
          onKeyUp={(e) => keys(e, false)}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: 'relative',
            width: '7rem',
            height: '7rem',
            borderRadius: '50%',
            border: 'none',
            background: colour,
            color: '#ffffff',
            display: 'grid',
            placeItems: 'center',
            cursor: busy && !live ? 'not-allowed' : 'pointer',
            opacity: busy && !live && !understanding ? 0.5 : 1,
            boxShadow: live ? 'none' : '0 6px 16px rgba(21, 128, 61, 0.35)',
            transform: armed ? 'translateX(-12px)' : 'none',
            transition: 'background 150ms, transform 150ms',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {armed ? <CrossIcon /> : latched && state === 'recording' ? <SendIcon /> : <MicIcon />}
        </button>
      </div>

      <div role="status" style={{ fontSize: '1.05rem', fontWeight: live ? 600 : 400, color: live && !armed ? RED : warn ? '#b45309' : '#334155', textAlign: 'center', minHeight: '1.6rem', fontVariantNumeric: 'tabular-nums' }}>
        {status}
      </div>

      {state === 'recording' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.9rem', color: '#64748b' }}>
          {latched ? (
            <>
              <span>{say('stopsByItself', language)}</span>
              <button
                type="button"
                onClick={() => recorder.cancel()}
                style={{ minHeight: '2.75rem', padding: '0 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontFamily: 'inherit', fontSize: '0.95rem', cursor: 'pointer' }}
              >
                ✕ {say('cancel', language)}
              </button>
            </>
          ) : (
            !armed && <span>{say('slideToCancel', language)}</span>
          )}
        </div>
      )}
    </div>
  );
}
