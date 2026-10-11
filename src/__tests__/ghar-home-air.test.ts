// Ghar ki Hawa's whole-home figure (homeAir.ts): weighted by each room's volume, on CPCB's AQI scale.
import { describe, expect, it } from 'vitest';

import { aqiText, cleanestAndWorst, pm25Aqi, roomSources, sourcesNow, volumeOf, wholeHome } from '../app/ghar/homeAir';
import { DEFAULT_HOME } from '../app/ghar/homeState';

const ist = (h: number, m = 0) => Date.UTC(2026, 9, 10, h, m) - 5.5 * 3_600_000;

describe('pm25Aqi', () => {
  it("puts PM2.5 on CPCB's scale", () => {
    expect(pm25Aqi(30)).toMatchObject({ aqi: 50, category: 'good', aboveScale: false });
    expect(pm25Aqi(60)).toMatchObject({ aqi: 100, category: 'satisfactory' });
    expect(pm25Aqi(250)).toMatchObject({ aqi: 400, category: 'very_poor' });
    expect(pm25Aqi(286).category).toBe('severe');
  });

  it('rounds first, so a level between two of CPCB’s whole-number bands lands in the right one', () => {
    // 30.4 µg/m³ falls in the gap between 0–30 and 31–60; unrounded it would land in the top band.
    expect(pm25Aqi(30.4).aqi).toBe(50);
    expect(pm25Aqi(60.6).aqi).toBe(101);
  });

  it('stops at 500 and says so, instead of an "AQI" in the thousands', () => {
    const coil = pm25Aqi(2725);
    expect(coil).toMatchObject({ aqi: 500, aboveScale: true, category: 'severe' });
    expect(aqiText(coil)).toBe('500+');
    expect(aqiText(pm25Aqi(100))).toBe('232'); // 201 + (300 − 201) ÷ (120 − 91) × (100 − 91)
  });
});

describe('wholeHome', () => {
  it('weights each room by the air it holds', () => {
    const rooms = [
      { pm25: 197, volumeM3: 8 * 2.7 },
      { pm25: 2725, volumeM3: 14 * 2.7 },
      { pm25: 438, volumeM3: 18 * 2.7 },
    ];
    const plainMean = (197 + 2725 + 438) / 3;
    const weighted = (197 * 8 + 2725 * 14 + 438 * 18) / 40;
    expect(wholeHome(rooms)).toBeCloseTo(weighted, 6);
    expect(wholeHome(rooms)).not.toBeCloseTo(plainMean, 0);
  });

  it('is the plain mean when the rooms are the same size, and nothing without rooms', () => {
    expect(wholeHome([{ pm25: 40, volumeM3: 30 }, { pm25: 80, volumeM3: 30 }])).toBe(60);
    expect(wholeHome([])).toBeUndefined();
  });

  it("uses each room's area times its ceiling height", () => {
    expect(volumeOf({ room_area_m2: 14, ceiling_height_m: 2.7 })).toBeCloseTo(37.8, 6);
  });
});

describe('sources', () => {
  const [kitchen, bedroom, living] = DEFAULT_HOME.rooms.map((r) => r.request);

  it('lists what a room burns: an LPG stove counts, an electric one does not', () => {
    expect(roomSources(kitchen)).toEqual(['cooking']);
    expect(roomSources({ ...kitchen, cooking_fuel: 'electric' })).toEqual([]);
    expect(roomSources(bedroom)).toContain('mosquito_coil');
    expect(roomSources(living)).toEqual(['incense']);
    expect(roomSources({ ...living, smokers: 1 })).toEqual(['smoking', 'incense']);
  });

  it('knows what is burning now, by the model’s own hours', () => {
    expect(sourcesNow(bedroom, ist(22))).toContain('mosquito_coil');
    expect(sourcesNow(bedroom, ist(12))).not.toContain('mosquito_coil');
    expect(sourcesNow({ ...kitchen, meal_times_h: [[12.5, 13.5]] }, ist(13))).toEqual(['cooking']);
    expect(sourcesNow({ ...kitchen, meal_times_h: [[12.5, 13.5]] }, ist(15))).toEqual([]);
  });
});

describe('cleanestAndWorst', () => {
  it('picks by PM2.5, and needs two rooms to compare', () => {
    const rooms = [{ id: 'a', pm25: 90 }, { id: 'b', pm25: 30 }, { id: 'c', pm25: 300 }];
    expect(cleanestAndWorst(rooms)).toEqual({ cleanest: rooms[1], worst: rooms[2] });
    expect(cleanestAndWorst([rooms[0]])).toEqual({});
  });
});
