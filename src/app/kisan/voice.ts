// The Plan tab's voice helpers, kept free of React so they can be tested: the "what I still need"
// checklist built from the agent's `missing` slots, the example sentence to try next, and how loud
// the microphone is right now.
import type { FarmHint } from './kisanApi';

/** The checklist, in the order the agent asks. The agent's district slot is part of "village". */
export const CHECKLIST = ['village', 'paddy_area', 'harvest_date', 'wheat_deadline', 'tractors', 'machines'] as const;
export type Need = (typeof CHECKLIST)[number];

const SLOT_TO_NEED: Record<string, Need> = {
  village: 'village',
  district: 'village',
  paddy_area: 'paddy_area',
  harvest_date: 'harvest_date',
  wheat_deadline: 'wheat_deadline',
  tractors: 'tractors',
  machines: 'machines',
};

/** What the agent has, from its reply's `missing` (MessageResponse.missing). Unknown slots are ignored. */
export function doneFromMissing(missing: readonly string[]): Set<Need> {
  const open = new Set(missing.map((slot) => SLOT_TO_NEED[slot]).filter(Boolean));
  return new Set(CHECKLIST.filter((need) => !open.has(need)));
}

/** Before the first reply: what the farm card already tells the agent (it goes with the first message). */
export function doneFromHint(hint: FarmHint | undefined): Set<Need> {
  const done = new Set<Need>();
  if (!hint) return done;
  if (hint.village || (hint.lat != null && hint.lon != null)) done.add('village');
  if (hint.paddy_acres != null) done.add('paddy_area');
  if (hint.harvest_date) done.add('harvest_date');
  if (hint.wheat_deadline) done.add('wheat_deadline');
  if (hint.tractors != null) done.add('tractors');
  if (hint.machines != null) done.add('machines');
  return done;
}

/** Which example sentence to suggest: everything at once when nothing is known, else the first gap. */
export function hintFor(done: ReadonlySet<Need>): Need | 'all' | null {
  if (done.size === 0) return 'all';
  return CHECKLIST.find((need) => !done.has(need)) ?? null;
}

/** Loudness 0..1 from an analyser's time-domain bytes (128 = silence): RMS, scaled so speech nears 1. */
export function loudness(samples: Uint8Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const s of samples) {
    const v = (s - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 5);
}

/**
 * Tracks speech and silence for tap-to-talk: stop once the farmer has spoken and then been quiet for
 * `quietMs`; give up if nothing is heard for `noSpeechMs`. The threshold rises with the background
 * noise floor, so a tractor idling nearby isn't taken for speech.
 */
export class SilenceWatch {
  private floor = 0.05; // the background noise level, learnt while he isn't speaking
  private spoke = false;
  private lastLoud: number;
  private readonly started: number;

  constructor(
    now: number,
    private readonly quietMs = 2000,
    private readonly noSpeechMs = 8000,
  ) {
    this.started = now;
    this.lastLoud = now;
  }

  /** Feed one loudness reading; returns what to do. */
  next(level: number, now: number): 'continue' | 'stop' | 'no_speech' {
    const speaking = level > Math.max(0.12, this.floor * 2.5);
    if (level < this.floor) this.floor = level;
    else if (!speaking) this.floor += (level - this.floor) * 0.02;
    if (speaking) {
      this.spoke = true;
      this.lastLoud = now;
    }
    if (this.spoke && now - this.lastLoud >= this.quietMs) return 'stop';
    if (!this.spoke && now - this.started >= this.noSpeechMs) return 'no_speech';
    return 'continue';
  }
}
