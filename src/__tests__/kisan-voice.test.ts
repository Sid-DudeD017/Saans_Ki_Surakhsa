// The Plan tab's voice helpers: the "what I need to know" checklist follows the agent's own required
// details, the "try saying" hint picks the next gap, and tap-to-talk stops after quiet, not in it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { say, type StringKey } from '../app/kisan/strings';
import { CHECKLIST, SilenceWatch, doneFromHint, doneFromMissing, hintFor, loudness } from '../app/kisan/voice';

const LANGS = ['pa', 'hi', 'en'] as const;

describe('the checklist', () => {
  it("covers exactly the agent's required details (district counts as part of the village)", () => {
    const session = readFileSync(join(__dirname, '../../services/agent-kisan/src/agent_kisan/session.py'), 'utf8');
    const required = [...session.match(/^REQUIRED = \(([^)]*)\)/m)![1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
    expect(required.filter((slot) => slot !== 'district')).toEqual([...CHECKLIST]);
  });

  it("ticks what the agent no longer lists as missing", () => {
    expect([...doneFromMissing(['village', 'district', 'paddy_area', 'harvest_date', 'wheat_deadline', 'tractors', 'machines'])]).toEqual([]);
    expect([...doneFromMissing(['district', 'machines'])]).toEqual(['paddy_area', 'harvest_date', 'wheat_deadline', 'tractors']);
    expect(doneFromMissing([]).size).toBe(CHECKLIST.length);
    expect(doneFromMissing(['something_new']).size).toBe(CHECKLIST.length);
  });

  it('before the first reply, ticks what the farm card will tell the agent', () => {
    expect(doneFromHint(undefined).size).toBe(0);
    expect([...doneFromHint({ lat: 30.27, lon: 76.04, paddy_acres: 18 })]).toEqual(['village', 'paddy_area']);
    expect([...doneFromHint({ village: 'Bhawanigarh', tractors: 0, machines: {} })]).toEqual(['village', 'tractors', 'machines']);
  });

  it('suggests the whole story first, then the next gap, then nothing', () => {
    expect(hintFor(new Set())).toBe('all');
    expect(hintFor(doneFromMissing(['harvest_date', 'machines']))).toBe('harvest_date');
    expect(hintFor(doneFromMissing([]))).toBeNull();
  });

  it('has every label and example sentence in three languages', () => {
    for (const key of [...CHECKLIST.flatMap((n) => [`need_${n}`, `say_${n}`]), 'say_all', 'needTitle', 'needAll', 'trySaying']) {
      const texts = LANGS.map((l) => say(key as StringKey, l));
      expect(texts.every(Boolean), key).toBe(true);
      expect(new Set(texts).size, key).toBe(3);
    }
  });
});

describe('the microphone', () => {
  it('reads silence as 0 and a loud signal near 1', () => {
    expect(loudness(new Uint8Array(512).fill(128))).toBe(0);
    const loud = Uint8Array.from({ length: 512 }, (_, i) => (i % 2 ? 178 : 78));
    expect(loudness(loud)).toBe(1);
    expect(loudness(new Uint8Array())).toBe(0);
  });

  it('sends a tapped note after 2 s of quiet once the farmer has spoken', () => {
    const watch = new SilenceWatch(0);
    let t = 0;
    const feed = (level: number, ms: number) => {
      let verdict: ReturnType<SilenceWatch['next']> = 'continue';
      for (const end = t + ms; t < end && verdict === 'continue'; t += 50) verdict = watch.next(level, t);
      return verdict;
    };
    expect(feed(0.02, 1000)).toBe('continue'); // background hum, before speaking
    expect(feed(0.6, 3000)).toBe('continue'); // talking
    expect(feed(0.3, 1500)).toBe('continue'); // quieter talk
    expect(feed(0.02, 1500)).toBe('continue'); // a breath, shorter than 2 s
    expect(feed(0.6, 500)).toBe('continue');
    expect(feed(0.02, 2500)).toBe('stop');
    expect(t).toBeGreaterThanOrEqual(8000);
  });

  it("gives up on a tapped note when nothing is said for 8 s, even with a noisy background", () => {
    const watch = new SilenceWatch(0);
    let verdict: ReturnType<SilenceWatch['next']> = 'continue';
    let t = 0;
    for (; verdict === 'continue' && t < 20_000; t += 50) verdict = watch.next(0.1 + (t % 200 === 0 ? 0.01 : 0), t);
    expect(verdict).toBe('no_speech');
    expect(t).toBeLessThanOrEqual(8100);
  });
});
