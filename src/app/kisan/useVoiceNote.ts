'use client';

// A voice note, held or tapped. Hold the mic and let go to send, or tap once to start and again to
// send; a tapped note also sends itself after 2 s of quiet once the farmer has spoken. Either way it
// can be cancelled, and nothing is sent. Notes under 0.7 s are dropped as accidental taps; recording
// stops by itself at 60 s. While recording, `levels` holds the last few loudness readings (0..1) for
// the mic's sound bars, and Android phones buzz briefly when it starts and stops.
import { useCallback, useEffect, useRef, useState } from 'react';

import { SilenceWatch, loudness } from './voice';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'too_short' | 'unavailable' | 'cancelled' | 'no_speech';

const MIN_MS = 700;
const MAX_MS = 60_000;
const BARS = 7;
// The agent decodes any of these (ffmpeg). Chrome and Firefox record webm, Safari mp4.
const TYPES: [string, string][] = [
  ['audio/webm;codecs=opus', 'voice.webm'],
  ['audio/mp4', 'voice.m4a'],
  ['audio/ogg;codecs=opus', 'voice.ogg'],
];

const QUIET = new Array<number>(BARS).fill(0);

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not every browser lets a page vibrate; the sound bars still show it's listening.
  }
}

export function useVoiceNote(onNote: (audio: Blob, filename: string, seconds: number) => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(QUIET);
  const [latched, setLatched] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const frame = useRef(0);
  const startedAt = useRef(0);
  const released = useRef(false); // stop asked for while the browser was still opening the mic
  const cancelled = useRef<RecorderState | null>(null);
  const tapped = useRef(false);
  const timers = useRef<number[]>([]);
  const onNoteRef = useRef(onNote);

  useEffect(() => {
    onNoteRef.current = onNote;
  }, [onNote]);

  const cleanup = useCallback(() => {
    timers.current.forEach((t) => window.clearInterval(t));
    timers.current = [];
    cancelAnimationFrame(frame.current);
    void audio.current?.close().catch(() => {});
    audio.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
    tapped.current = false;
    setLatched(false);
    setLevels(QUIET);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /** Send what was said. */
  const stop = useCallback(() => {
    released.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);

  /** Throw the note away; nothing is sent. */
  const cancel = useCallback(
    (why: 'cancelled' | 'no_speech' = 'cancelled') => {
      cancelled.current = why;
      stop();
    },
    [stop],
  );

  /** Tap mode: keep recording after the finger lifts, until a second tap or 2 s of quiet. */
  const latch = useCallback(() => {
    tapped.current = true;
    setLatched(true);
  }, []);

  /**
   * Loudness for the sound bars, and the quiet that ends a tapped note. The audio context is made in the
   * tap itself (see start), because phones only let a page run audio straight after a touch. If it
   * still isn't running, there are no bars and a tapped note waits for the second tap.
   */
  const listen = useCallback(
    (media: MediaStream, ctx: AudioContext) => {
      void ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(media).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let watch: SilenceWatch | null = null; // starts once audio actually flows
      let shown = 0;
      const tick = (now: number) => {
        if (ctx.state !== 'running') {
          frame.current = requestAnimationFrame(tick);
          return;
        }
        watch ??= new SilenceWatch(now);
        analyser.getByteTimeDomainData(samples);
        const level = loudness(samples);
        const verdict = watch.next(level, now);
        if (tapped.current && verdict === 'stop') return stop();
        if (tapped.current && verdict === 'no_speech') return cancel('no_speech');
        if (now - shown > 80) {
          shown = now;
          setLevels((old) => [...old.slice(1), level]);
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [cancel, stop],
  );

  const start = useCallback(async () => {
    if (recorder.current || state === 'starting') return;
    released.current = false;
    cancelled.current = null;
    tapped.current = false;
    setLatched(false);
    setState('starting');
    // Made now, inside the tap, so the phone lets it run (the mic prompt below can outlast the tap).
    const Ctx = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    let ctx: AudioContext | null = null;
    try {
      ctx = Ctx ? new Ctx() : null;
    } catch {
      ctx = null; // the note still records; there are just no bars
    }
    audio.current = ctx;
    const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
    const choice = supported ? TYPES.find(([type]) => MediaRecorder.isTypeSupported(type)) : undefined;
    if (!choice) {
      cleanup();
      setState('unavailable');
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      cleanup();
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
      const why = cancelled.current;
      cleanup();
      if (why) {
        buzz([20, 60, 20]);
        setState(why);
        return;
      }
      if (took < MIN_MS || !chunks.length) {
        setState('too_short');
        return;
      }
      buzz(30);
      setState('idle');
      onNoteRef.current(new Blob(chunks, { type: mimeType.split(';')[0] }), filename, Math.round(took / 1000));
    };
    recorder.current = rec;
    startedAt.current = Date.now();
    rec.start();
    buzz(40);
    setSeconds(0);
    setState('recording');
    if (ctx) listen(stream.current, ctx);
    timers.current.push(
      window.setInterval(() => {
        const ms = Date.now() - startedAt.current;
        setSeconds(Math.floor(ms / 1000));
        if (ms >= MAX_MS) stop();
      }, 250),
    );
    // Asked to stop or cancel while the browser was still opening the microphone: do it now.
    if (released.current) stop();
  }, [cleanup, listen, state, stop]);

  return { state, seconds, levels, latched, start, stop, cancel, latch };
}
