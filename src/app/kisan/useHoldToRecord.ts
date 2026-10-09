'use client';

// Hold to record a voice note: press (finger, mouse, or Space/Enter) to start, let go to send.
// Notes under 0.7 s are dropped as accidental taps; recording stops by itself at 60 s.
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'too_short' | 'unavailable';

const MIN_MS = 700;
const MAX_MS = 60_000;
// The agent decodes any of these (ffmpeg). Chrome and Firefox record webm, Safari mp4.
const TYPES: [string, string][] = [
  ['audio/webm;codecs=opus', 'voice.webm'],
  ['audio/mp4', 'voice.m4a'],
  ['audio/ogg;codecs=opus', 'voice.ogg'],
];

export function useHoldToRecord(onNote: (audio: Blob, filename: string) => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const released = useRef(false);
  const timers = useRef<number[]>([]);
  const onNoteRef = useRef(onNote);

  useEffect(() => {
    onNoteRef.current = onNote;
  }, [onNote]);

  const cleanup = useCallback(() => {
    timers.current.forEach((t) => window.clearInterval(t));
    timers.current = [];
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    released.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (recorder.current || state === 'starting') return;
    released.current = false;
    setState('starting');
    const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
    const choice = supported ? TYPES.find(([type]) => MediaRecorder.isTypeSupported(type)) : undefined;
    if (!choice) {
      setState('unavailable');
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState('unavailable');
      return;
    }
    const [mimeType, filename] = choice;
    const rec = new MediaRecorder(stream.current, { mimeType });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      const took = Date.now() - startedAt.current;
      cleanup();
      if (took < MIN_MS || !chunks.length) {
        setState('too_short');
        return;
      }
      setState('idle');
      onNoteRef.current(new Blob(chunks, { type: mimeType.split(';')[0] }), filename);
    };
    recorder.current = rec;
    startedAt.current = Date.now();
    rec.start();
    setSeconds(0);
    setState('recording');
    timers.current.push(
      window.setInterval(() => {
        const ms = Date.now() - startedAt.current;
        setSeconds(Math.floor(ms / 1000));
        if (ms >= MAX_MS) stop();
      }, 250),
    );
    // Let go while the browser was still asking for the microphone: stop at once (too short).
    if (released.current) stop();
  }, [cleanup, state, stop]);

  return { state, seconds, start, stop };
}
