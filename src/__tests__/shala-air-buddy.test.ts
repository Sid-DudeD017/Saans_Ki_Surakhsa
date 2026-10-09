// Air Buddy and the gas cards (P2): every category and pollutant is covered in three languages, the
// fixtures are the contract's own examples, and the cards come in the order a child should read them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BUDDY, CARD_POLLUTANTS, CATEGORIES, CATEGORY_COLOURS, CATEGORY_NAMES, GASES, WORDS, gasCards, unitLabel, type AqiResponse } from '../app/shala/airQuality';
import { AQI_FIXTURES } from '../app/shala/aqiFixtures';

const p3 = JSON.parse(readFileSync(join(__dirname, '../../packages/contracts/proposals/p3-aqi.openapi.json'), 'utf8'));
const LANGUAGES = ['pa', 'hi', 'en'] as const;

describe('Air Buddy', () => {
  it("has a mood, a colour and a line for each of the contract's categories", () => {
    expect(CATEGORIES).toEqual(p3.components.schemas.AqiCategory.enum);
    for (const c of CATEGORIES) {
      expect(CATEGORY_COLOURS[c].fill).toMatch(/^#[0-9a-f]{6}$/);
      for (const l of LANGUAGES) {
        expect(BUDDY[c].says[l].length).toBeGreaterThan(10);
        expect(BUDDY[c].name[l]).toBeTruthy();
        expect(CATEGORY_NAMES[c][l]).toBeTruthy();
      }
    }
  });

  it('gets worse face by face, and only severe wears a mask', () => {
    expect(CATEGORIES.map((c) => BUDDY[c].mood)).toEqual(['happy', 'okay', 'bothered', 'worried', 'unwell', 'masked']);
  });

  it('every screen word exists in all three languages', () => {
    for (const w of Object.values(WORDS)) for (const l of LANGUAGES) expect(w[l]).toBeTruthy();
  });
});

describe('gas cards', () => {
  it('cover every pollutant in the contract, in three languages', () => {
    expect(Object.keys(GASES).sort()).toEqual([...p3.components.schemas.Pollutant.enum].sort());
    for (const g of Object.values(GASES)) for (const l of LANGUAGES) {
      expect(g.what[l]).toBeTruthy();
      expect(g.from[l]).toBeTruthy();
    }
  });

  it('put the dominant pollutant first, then the rest worst first, then the six nobody measured', () => {
    const cards = gasCards(AQI_FIXTURES.poor_day);
    expect(cards.map((c) => c.pollutant)).toEqual(['no2', 'pm25', 'co', 'pm10', 'so2', 'o3']);
    expect(cards[0]).toMatchObject({ dominant: true, reading: { subIndex: 250, category: 'poor', concentration: 230, unit: 'ug/m3' } });
    expect(cards[2].reading?.category).toBe('satisfactory');
    expect(cards.slice(3).every((c) => c.reading === null && !c.dominant)).toBe(true);
  });

  it('colour each sub-index by its own CPCB band, not the overall one', () => {
    const cards = gasCards(AQI_FIXTURES.severe_day);
    expect(cards.map((c) => [c.pollutant, c.reading?.category ?? null])).toEqual([
      ['pm10', 'severe'], ['pm25', 'severe'], ['o3', 'moderate'], ['no2', null], ['so2', null], ['co', null],
    ]);
  });

  it('show NH₃ or lead only when they are measured', () => {
    const withNh3: AqiResponse = { ...AQI_FIXTURES.good_day, sub_indices: { ...AQI_FIXTURES.good_day.sub_indices, nh3: { sub_index: 12, concentration: 48, unit: 'ug/m3' } } };
    expect(gasCards(withNh3).map((c) => c.pollutant)).toContain('nh3');
    expect(gasCards(AQI_FIXTURES.good_day).map((c) => c.pollutant)).not.toContain('nh3');
    expect(gasCards(AQI_FIXTURES.good_day)).toHaveLength(CARD_POLLUTANTS.length);
  });

  it('write units as people do', () => {
    expect(unitLabel('ug/m3')).toBe('µg/m³');
    expect(unitLabel('mg/m3')).toBe('mg/m³');
  });
});

it("the fixtures are P3's contract examples, unchanged", () => {
  const examples = p3.paths['/v1/aqi'].get.responses['200'].content['application/json'].examples;
  expect(AQI_FIXTURES).toEqual(Object.fromEntries(Object.entries(examples).map(([k, v]) => [k, (v as { value: unknown }).value])));
});
