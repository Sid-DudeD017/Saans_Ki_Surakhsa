// Air Buddy and the gas cards (P2): every category and pollutant is covered in three languages, the
// fixtures are the contract's own examples, and the cards come in the order a child should read them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BUDDY, CARD_POLLUTANTS, CATEGORIES, CATEGORY_COLOURS, CATEGORY_NAMES, GASES, WORDS, gasCards, unitLabel, type AqiResponse } from '../app/shala/airQuality';
import { getCategoryCode, overallAqi, type PollutantCode } from '../../packages/aqi';
import { calculateHeatIndex } from '../../services/aqi/index';
import { AQI_FIXTURES, COMPUTED_DAYS, CONTRACT_DAYS } from '../app/shala/aqiFixtures';

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
    const cards = gasCards(AQI_FIXTURES.poor);
    expect(cards.map((c) => c.pollutant)).toEqual(['no2', 'pm25', 'co', 'pm10', 'so2', 'o3']);
    expect(cards[0]).toMatchObject({ dominant: true, reading: { subIndex: 250, category: 'poor', concentration: 230, unit: 'ug/m3' } });
    expect(cards[2].reading?.category).toBe('satisfactory');
    expect(cards.slice(3).every((c) => c.reading === null && !c.dominant)).toBe(true);
  });

  it('colour each sub-index by its own CPCB band, not the overall one', () => {
    const cards = gasCards(AQI_FIXTURES.severe);
    expect(cards.map((c) => [c.pollutant, c.reading?.category ?? null])).toEqual([
      ['pm10', 'severe'], ['pm25', 'severe'], ['o3', 'moderate'], ['no2', null], ['so2', null], ['co', null],
    ]);
  });

  it('show NH₃ or lead only when they are measured', () => {
    const withNh3: AqiResponse = { ...AQI_FIXTURES.good, sub_indices: { ...AQI_FIXTURES.good.sub_indices, nh3: { sub_index: 12, concentration: 48, unit: 'ug/m3' } } };
    expect(gasCards(withNh3).map((c) => c.pollutant)).toContain('nh3');
    expect(gasCards(AQI_FIXTURES.good).map((c) => c.pollutant)).not.toContain('nh3');
    expect(gasCards(AQI_FIXTURES.good)).toHaveLength(CARD_POLLUTANTS.length);
  });

  it('write units as people do', () => {
    expect(unitLabel('ug/m3')).toBe('µg/m³');
    expect(unitLabel('mg/m3')).toBe('mg/m³');
  });
});

describe('AQI fixtures, one day per category', () => {
  it("good, poor and severe are P3's contract examples, unchanged", () => {
    const examples = p3.paths['/v1/aqi'].get.responses['200'].content['application/json'].examples;
    expect(CONTRACT_DAYS).toEqual(Object.fromEntries(Object.entries(examples).map(([k, v]) => [k, (v as { value: unknown }).value])));
  });

  it("the other three are what P3's CPCB code and heat index give for their readings", () => {
    for (const day of Object.values(COMPUTED_DAYS)) {
      const readings = Object.entries(day.sub_indices).map(([pollutant, s]) => ({ pollutant: pollutant as PollutantCode, concentration: s.concentration }));
      const { aqi, category, dominant_pollutant, sub_indices } = overallAqi(readings);
      expect({ aqi, category, dominant_pollutant, sub_indices }).toEqual({
        aqi: day.aqi, category: day.category, dominant_pollutant: day.dominant_pollutant, sub_indices: day.sub_indices,
      });
      expect(Math.round(calculateHeatIndex(day.weather.temperature_c, day.weather.humidity_pct) * 10) / 10).toBe(day.weather.heat_index_c);
    }
  });

  it.each(CATEGORIES)('the %s day is that category, with its own Air Buddy mood', (category) => {
    const day = AQI_FIXTURES[category];
    expect(day.category).toBe(category);
    expect(getCategoryCode(day.aqi)).toBe(category);
    expect(day.aqi).toBe(Math.max(...Object.values(day.sub_indices).map((s) => s.sub_index)));
    expect(BUDDY[day.category].mood).toBe(['happy', 'okay', 'bothered', 'worried', 'unwell', 'masked'][CATEGORIES.indexOf(category)]);
  });

  it.each(CATEGORIES)('the %s day lists its dominant pollutant first, then the rest worst first', (category) => {
    const day = AQI_FIXTURES[category];
    const cards = gasCards(day);
    const measured = cards.filter((c) => c.reading);
    expect(cards[0]).toMatchObject({ pollutant: day.dominant_pollutant, dominant: true });
    expect(measured.slice(1).map((c) => c.reading!.subIndex)).toEqual(measured.slice(1).map((c) => c.reading!.subIndex).sort((a, b) => b - a));
    expect(cards.slice(measured.length).every((c) => !c.reading)).toBe(true);
    expect(cards.map((c) => c.pollutant)).toEqual(expect.arrayContaining(CARD_POLLUTANTS));
  });

  it('GRAP stages follow the AQI bands', () => {
    expect(CATEGORIES.map((c) => [AQI_FIXTURES[c].aqi, AQI_FIXTURES[c].grap_stage])).toEqual([
      [45, 'none'], [88, 'none'], [145, 'none'], [250, 'stage_1'], [348, 'stage_2'], [440, 'stage_3'],
    ]);
  });
});
