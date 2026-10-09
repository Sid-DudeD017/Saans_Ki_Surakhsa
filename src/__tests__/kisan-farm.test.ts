// Kisan's tabs, farm profile and machine photos (K1–K4, K7, K8): the parts that are plain logic.
import { describe, expect, it } from 'vitest';

import {
  cardDate,
  cleanFarm,
  coverageInput,
  daysToClear,
  describeGuess,
  farmFromForm,
  farmFromReadback,
  farmHint,
  machineDays,
  machinesFromReadback,
  mergeFromChat,
  planInput,
  preselect,
  verdictOf,
  type FarmProfile,
} from '../app/kisan/farmProfile';
import { coverageResponse } from '../app/kisan/coverage';
import type { Readback } from '../app/kisan/kisanApi';
import { tabFrom } from '../app/kisan/KisanTabs';
import { mockMessage, mockPhoto } from '../app/kisan/mock';
import { fitWithin } from '../app/kisan/photoPrep';
import { dayMonth, machineLabel, say, sayWith } from '../app/kisan/strings';

const TODAY = new Date('2026-10-09T12:00:00+05:30');

describe('tabs', () => {
  it('reads the tab from the URL, defaulting to Plan', () => {
    expect(tabFrom('?tab=help')).toBe('help');
    expect(tabFrom('?tab=machines&lang=pa')).toBe('machines');
    expect(tabFrom('')).toBe('plan');
    expect(tabFrom('?tab=admin')).toBe('plan');
  });

  it('every new label exists in all three languages', () => {
    for (const key of ['tabPlan', 'tabMachines', 'tabShop', 'tabHelp', 'takePhoto', 'addMachine', 'yourFarm', 'useMyLocation'] as const) {
      const texts = (['pa', 'hi', 'en'] as const).map((l) => say(key, l));
      expect(new Set(texts).size).toBe(3);
    }
    for (const m of ['happy_seeder', 'super_seeder', 'mulcher_rmb', 'baler', 'other']) {
      for (const l of ['pa', 'hi', 'en'] as const) expect(machineLabel(m, l)).not.toBe(m);
    }
  });

  it('fills placeholders', () => {
    expect(sayWith('looksLike', 'en', { machine: 'Super Seeder' })).toBe('This looks like a Super Seeder');
    expect(sayWith('sure', 'pa', { pct: 86 })).toBe('86% ਯਕੀਨ');
    expect(dayMonth('2026-11-09', 'pa')).toBe('9 ਨਵੰਬਰ');
    expect(dayMonth('2026-11-09', 'en')).toBe('9 Nov');
  });
});

describe('farm profile from the read-back card', () => {
  it('reads dates the way the card writes them, in the coming season', () => {
    expect(cardDate('20 ਅਕਤੂਬਰ', TODAY)).toBe('2026-10-20');
    expect(cardDate('9 नवंबर', TODAY)).toBe('2026-11-09');
    expect(cardDate('9 November', TODAY)).toBe('2026-11-09');
    expect(cardDate('2 Nov', TODAY)).toBe('2026-11-02');
    expect(cardDate('15 ਜਨਵਰੀ', TODAY)).toBe('2027-01-15'); // January is ahead, not behind
    expect(cardDate('31 November', TODAY)).toBeUndefined();
    expect(cardDate('soon', TODAY)).toBeUndefined();
  });

  it("takes Gurpreet's confirmed numbers from the contract example", async () => {
    const reply = await mockMessage('', 'pa', null);
    const farm = farmFromReadback(reply.readback as unknown as Readback, TODAY);
    expect(farm).toEqual({ paddyAcres: 18, tractors: 1, harvestDate: '2026-10-20', wheatBy: '2026-11-09' });
  });

  it('leaves out paddy in units it would have to guess', () => {
    const readback: Readback = { card: { language: 'en', items: [{ kind: 'paddy', value: '4', unit: 'hectare' }] }, text: '', audio_url: null };
    expect(farmFromReadback(readback, TODAY)).toEqual({});
  });

  it("the chat's numbers replace typed ones; machines and location stay", () => {
    const farm: FarmProfile = {
      location: { village: 'Bhawanigarh' },
      paddyAcres: 10,
      machines: [{ id: 'a', type: 'baler', count: 1, owned: true, addedAt: '2026-10-09T00:00:00Z' }],
      source: 'form',
    };
    const merged = mergeFromChat(farm, { paddyAcres: 18, tractors: 1 });
    expect(merged).toMatchObject({ paddyAcres: 18, tractors: 1, location: { village: 'Bhawanigarh' }, source: 'chat' });
    expect(merged.machines).toHaveLength(1);
    expect(mergeFromChat(farm, {})).toBe(farm);
  });
});

describe('saved farm', () => {
  it('drops what it cannot trust and rounds the location to about 1 km', () => {
    const farm = cleanFarm({
      location: { lat: 30.26613, lon: 76.03921 },
      paddyAcres: -3,
      tractors: '2',
      wheatBy: 'next week',
      machines: [
        { id: 'a', type: 'super_seeder', count: 2.6, owned: false, thumb: 'javascript:alert(1)' },
        { id: 'b', type: 'rocket' },
        null,
      ],
    });
    expect(farm.location).toEqual({ lat: 30.27, lon: 76.04 });
    expect(farm.paddyAcres).toBeUndefined();
    expect(farm.tractors).toBeUndefined();
    expect(farm.wheatBy).toBeUndefined();
    expect(farm.machines).toEqual([{ id: 'a', type: 'super_seeder', count: 3, owned: false, addedAt: '1970-01-01T00:00:00.000Z' }]);
    expect(cleanFarm('garbage')).toEqual({ machines: [] });
  });

  it('checks the typed farm details', () => {
    expect(farmFromForm({ paddyAcres: '18', tractors: '1', harvestDate: '2026-10-20', wheatBy: '2026-11-09' })).toEqual({
      paddyAcres: 18,
      tractors: 1,
      harvestDate: '2026-10-20',
      wheatBy: '2026-11-09',
    });
    expect(farmFromForm({ paddyAcres: '7,5', tractors: '', harvestDate: '', wheatBy: '' })).toMatchObject({ paddyAcres: 7.5, tractors: undefined });
    expect(farmFromForm({ paddyAcres: '-1', tractors: '', harvestDate: '', wheatBy: '' })).toBeNull();
    expect(farmFromForm({ paddyAcres: '', tractors: '1.5', harvestDate: '', wheatBy: '' })).toBeNull();
    expect(farmFromForm({ paddyAcres: '', tractors: '', harvestDate: '2026-11-20', wheatBy: '2026-11-09' })).toBeNull();
  });
});

describe('machine photos', () => {
  it('pre-picks the guess only when the service is fairly sure', () => {
    expect(preselect({ machine: 'super_seeder', confidence: 0.86 })).toBe('super_seeder');
    expect(preselect({ machine: 'super_seeder', confidence: 0.45 })).toBeNull();
    expect(preselect({ machine: 'other', confidence: 0.9 })).toBe('other');
    expect(preselect({ machine: 'none', confidence: 0.9 })).toBeNull();
    expect(preselect(null)).toBeNull();
  });

  it('tells the farmer what the guess means', () => {
    expect(describeGuess({ machine: 'super_seeder', confidence: 0.86 })).toEqual({ kind: 'looksLike', machine: 'super_seeder', pct: 86 });
    expect(describeGuess({ machine: 'happy_seeder', confidence: 0.3 })).toEqual({ kind: 'notSure' });
    expect(describeGuess({ machine: 'none', confidence: 0.95 })).toEqual({ kind: 'noMachineSeen' });
    expect(describeGuess({ error: 'machine recognition unavailable: no Bedrock' })).toEqual({ kind: 'aiUnavailable' });
    expect(describeGuess(null)).toEqual({ kind: 'aiUnavailable' });
  });

  it('demo mode answers with the contract example', async () => {
    const res = await mockPhoto();
    expect(describeGuess(res.machine)).toMatchObject({ kind: 'looksLike', machine: 'super_seeder' });
  });

  it('shrinks big photos to 1600 px on the long side, never enlarging', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

const GURPREET: FarmProfile = {
  location: { lat: 30.27, lon: 76.04 },
  paddyAcres: 18,
  tractors: 1,
  harvestDate: '2026-10-20',
  wheatBy: '2026-11-09',
  machines: [{ id: 'a', type: 'super_seeder', count: 1, owned: false, days: 2, addedAt: '2026-10-09T00:00:00Z' }],
};

describe('is it enough? (K10)', () => {
  it("Gurpreet's farm card and rented Super Seeder give 61%, 7 acres short", () => {
    const req = coverageInput(GURPREET);
    expect(req).toMatchObject({ harvest_date: '2026-10-20', wheat_deadline: '2026-11-09', tractors: 1, machines: [{ type: 'super_seeder', days: 2, units: 1 }] });
    if ('missing' in req) throw new Error('should be complete');
    const res = coverageResponse(req);
    expect([res.coverage_pct, res.gap_acres]).toEqual([61, 7]);
    expect(verdictOf(res.coverage_pct)).toBe('short');
    expect(daysToClear(res.gap_acres, 'super_seeder', res.assumptions.capacity_acres_per_day)).toBe(1.5);
  });

  it('adds up machines of one type; owned ones have the whole window; "other" is left out', () => {
    const farm: FarmProfile = {
      ...GURPREET,
      machines: [
        { id: 'a', type: 'happy_seeder', count: 2, owned: true, addedAt: '' },
        { id: 'b', type: 'happy_seeder', count: 1, owned: false, days: 3, addedAt: '' },
        { id: 'c', type: 'other', count: 1, owned: true, addedAt: '' },
      ],
    };
    expect(machineDays(farm, 20)).toEqual([{ type: 'happy_seeder', days: 43, units: 3 }]);
  });

  it('says what the farm card is missing', () => {
    expect(coverageInput({ machines: [] })).toEqual({ missing: ['paddy', 'dates'] });
    expect(coverageInput({ ...GURPREET, wheatBy: undefined })).toEqual({ missing: ['dates'] });
  });

  it('verdicts: 100 enough, 80 almost, 79 short', () => {
    expect([verdictOf(100), verdictOf(80), verdictOf(79)]).toEqual(['enough', 'almost', 'short']);
  });
});

describe('from the verdict to a CHC plan (K11)', () => {
  it('needs the farm location; GPS wins over the village', () => {
    expect(planInput({ ...GURPREET, location: undefined })).toBeNull();
    expect(planInput(GURPREET)).toMatchObject({ lat: 30.27, lon: 76.04, max_km: 15 });
    expect(planInput({ ...GURPREET, location: { village: 'Bhawanigarh' } })).toMatchObject({ village: 'Bhawanigarh' });
  });
});

describe('the chat and the machine list share machines (K9)', () => {
  it('the chat starts from the farm card and machines', () => {
    expect(farmHint(GURPREET)).toEqual({
      lat: 30.27,
      lon: 76.04,
      paddy_acres: 18,
      tractors: 1,
      harvest_date: '2026-10-20',
      wheat_deadline: '2026-11-09',
      machines: { super_seeder: 2 },
    });
    expect(farmHint({ machines: [] })).toBeUndefined();
    // An owned machine needs the window to turn into days, so without dates it isn't sent.
    expect(farmHint({ machines: [{ id: 'a', type: 'baler', count: 1, owned: true, addedAt: '' }] })).toBeUndefined();
  });

  it("the chat's confirmed machines join the list unless that type is already there", async () => {
    const reply = await mockMessage('', 'en', null);
    const readback = reply.readback as unknown as Readback;
    const fromChat = machinesFromReadback(readback, TODAY);
    expect(fromChat).toMatchObject([{ type: 'super_seeder', count: 1, days: 2 }]);
    const empty = mergeFromChat({ machines: [] }, {}, fromChat);
    expect(empty.machines).toHaveLength(1);
    const photographed = mergeFromChat(GURPREET, {}, fromChat);
    expect(photographed).toBe(GURPREET);
  });
});
