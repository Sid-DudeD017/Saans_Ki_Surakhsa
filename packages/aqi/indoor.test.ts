// Ghar ki Hawa's indoor model (P3): the Sharma example to ±1 µg/m³, the hour-by-hour solution, the defaults
// and their sources, today's plan, and POST /v1/indoor/estimate against the contract.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { answerIndoor } from '../../services/aqi/indoor/http';
import type { ForecastSnapshot } from '../../services/aqi/forecast/grid';
import { anchorsFor } from '../../services/aqi/forecast/grid';
import { estimateIndoor, istHourOf, simulateIndoor, sourcesAt, steadyIndoor, ventilationFor, type IndoorRequest, type OutdoorAt, type Room } from './indoor';
import raw from './indoor-defaults.json';
import { INDOOR_DEFAULTS, parseIndoorDefaults } from './indoorDefaults';

const D = INDOOR_DEFAULTS;
const H = 3_600_000;
const closed = { penetration: D.ventilation.closed.penetration, airExchangePerH: D.ventilation.closed.air_exchange_per_h, depositionPerH: D.deposition_per_h.value };

describe('the Sharma example: 280 outside, a 40 m³ bedroom', () => {
  it('168 with the windows shut, ~19 with a 250 m³/h purifier (±1 µg/m³)', () => {
    const shut = steadyIndoor({ ...closed, outdoor: 280, cadrM3H: 0, volumeM3: 40 });
    const purifier = steadyIndoor({ ...closed, outdoor: 280, cadrM3H: 250, volumeM3: 40 });
    expect(Math.abs(shut - 168)).toBeLessThanOrEqual(1);
    expect(Math.abs(purifier - 19)).toBeLessThanOrEqual(1);
    expect(purifier).toBeCloseTo(134.4 / 7.05, 9);
  });

  it('opening windows lets the outside in: one window 229, two or more 271', () => {
    const open = (v: 'ajar' | 'open') =>
      steadyIndoor({ outdoor: 280, penetration: D.ventilation[v].penetration, airExchangePerH: D.ventilation[v].air_exchange_per_h, depositionPerH: 0.2, cadrM3H: 0, volumeM3: 40 });
    expect([Math.round(open('ajar')), Math.round(open('open'))]).toEqual([229, 271]);
  });

  it('windows open with cooking: ~1481 (±1 µg/m³)', () => {
    const cooking = steadyIndoor({
      outdoor: 280,
      penetration: D.ventilation.open.penetration,
      airExchangePerH: D.ventilation.open.air_exchange_per_h,
      depositionPerH: D.deposition_per_h.value,
      cadrM3H: 0,
      volumeM3: 40,
      sourceUgPerH: 300_000
    });
    expect(Math.abs(cooking - 1481)).toBeLessThanOrEqual(1);
  });

  it('windows open with LPG cooking: ~327 (±1 µg/m³)', () => {
    const lpgCooking = steadyIndoor({
      outdoor: 280,
      penetration: D.ventilation.open.penetration,
      airExchangePerH: D.ventilation.open.air_exchange_per_h,
      depositionPerH: D.deposition_per_h.value,
      cadrM3H: 0,
      volumeM3: 40,
      sourceUgPerH: 14_000 // 14 mg/h
    });
    expect(Math.abs(lpgCooking - 327)).toBeLessThanOrEqual(1);
  });

  it('windows map to shut, one open, or cross-ventilated', () => {
    expect([ventilationFor(0, true), ventilationFor(3, false), ventilationFor(1, true), ventilationFor(2, true)]).toEqual(['closed', 'closed', 'ajar', 'open']);
  });
});

const none = { cooking_fuel: 'none', smokers: 0, incense: false, mosquito_coils: false } as const;
const sharmaRoom: Room = { volumeM3: 40, ventilation: 'closed', cadrM3H: 0, sources: none };
const T0 = Date.parse('2026-10-09T02:30:00Z'); // 08:00 in India

describe('hour by hour', () => {
  it('settles at the steady level when nothing changes', () => {
    const [c] = simulateIndoor(sharmaRoom, () => 280, [T0]);
    expect(c).toBeCloseTo(168, 6);
  });

  it('follows dC/dt exactly: after clean air, a jump to 280 outside fills the room as 168·(1 − e^(−0.8 t))', () => {
    const outdoor: OutdoorAt = (ms) => (ms < T0 ? 0 : 280);
    const times = [T0 + 0.5 * H, T0 + 1.25 * H, T0 + 4 * H];
    const got = simulateIndoor(sharmaRoom, outdoor, times);
    times.forEach((ms, i) => expect(got[i]).toBeCloseTo(168 * (1 - Math.exp(-0.8 * ((ms - T0) / H))), 6));
  });

  it('a purifier clears the room in minutes, not hours (λ = 7.05/h)', () => {
    const outdoor: OutdoorAt = () => 280;
    const room = { ...sharmaRoom, cadrM3H: 250 };
    // Settled without a purifier until T0, then it's switched on: simulate the switch with two runs.
    const [at30] = simulateIndoor(room, outdoor, [T0]);
    expect(at30).toBeCloseTo(134.4 / 7.05, 6);
    expect(168 * Math.exp(-7.05 * 0.5) + (134.4 / 7.05) * (1 - Math.exp(-7.05 * 0.5))).toBeLessThan(25);
  });

  it('switches sources on by India time: meals, waking hours, incense twice, coils overnight', () => {
    const at = (h: number) => Date.parse('2026-10-08T18:30:00Z') + h * H; // midnight in India + h
    const all = { cooking_fuel: 'biomass', smokers: 2, incense: true, mosquito_coils: true } as const;
    expect(istHourOf(at(7.5))).toBeCloseTo(7.5, 9);
    expect(Object.keys(sourcesAt(at(2), all))).toEqual(['mosquito_coil']);
    expect(sourcesAt(at(7.5), all)).toEqual({ cooking: 300_000, smoking: 44_000, incense: 25_000 });
    expect(Object.keys(sourcesAt(at(16), all))).toEqual(['smoking']);
    expect(Object.keys(sourcesAt(at(21.5), all))).toEqual(['smoking', 'mosquito_coil']);
    expect(sourcesAt(at(23.5), { ...all, mosquito_coils: false })).toEqual({});
  });

  it('a coil in a shut 40 m³ room settles at S/V/(a + k)', () => {
    const night = Date.parse('2026-10-08T20:30:00Z'); // 02:00 in India, 5 hours into the coil
    const [c] = simulateIndoor({ ...sharmaRoom, sources: { ...none, mosquito_coils: true } }, () => 0, [night]);
    // Lit at 21:00, so 5 hours in: (S/V)/(a + k)·(1 − e^(−0.8·5)).
    expect(c).toBeCloseTo((85_000 / 40 / 0.8) * (1 - Math.exp(-4)), 0);
  });

  it('respects custom meal times, using existing defaults when omitted, without changing duration or meaning', () => {
    const at = (h: number) => Date.parse('2026-10-08T18:30:00Z') + h * H;
    const all = { cooking_fuel: 'biomass', smokers: 0, incense: false, mosquito_coils: false } as const;
    
    // Existing caller behavior (omitted meal times) - default is [7, 8], [12.5, 13.5], [19.5, 20.5]
    expect(sourcesAt(at(7.5), all)).toHaveProperty('cooking');
    expect(sourcesAt(at(8.5), all)).not.toHaveProperty('cooking');
    
    // Custom meal times (e.g., shifted by 1 hour) - each is 1 hour duration
    const customMeals: [number, number][] = [[8, 9], [13, 14], [20, 21]];
    const customD = { ...D, cooking: { ...D.cooking, hours: customMeals } };
    
    expect(sourcesAt(at(7.5), all, customD)).not.toHaveProperty('cooking');
    expect(sourcesAt(at(8.5), all, customD)).toHaveProperty('cooking');
    expect(sourcesAt(at(9.5), all, customD)).not.toHaveProperty('cooking');
  });
});

describe('the defaults', () => {
  it('every value has a source', () => {
    const sources = JSON.stringify(raw).match(/"(source|hours_source)":/g) ?? [];
    expect(sources.length).toBe(3 + 1 + 1 + 1 + 6 + 3 + 1 + 3);
    expect(Object.values(D.cooking.fuels).every((f) => f.source.length > 10)).toBe(true);
  });

  it('refuses a value without a source, and hours that end before they start', () => {
    const copy = () => JSON.parse(JSON.stringify(raw));
    const noSource = copy();
    delete noSource.smoker.source;
    const backwards = copy();
    backwards.incense.hours = [[20, 19]];
    expect(() => parseIndoorDefaults(noSource)).toThrow();
    expect(() => parseIndoorDefaults(backwards)).toThrow(/ends before it starts/);
  });
});

const sharma: IndoorRequest = {
  lat: 28.5355,
  lon: 77.391,
  room_area_m2: 14.8,
  ceiling_height_m: 2.7,
  windows: 1,
  windows_open: false,
  purifier_cadr_m3_h: 250,
  hepa_class: 'h13',
  // The model is one room; the Sharmas cook in the kitchen, so the bedroom has no cooking.
  cooking_fuel: 'none',
  smokers: 0,
  incense: false,
  mosquito_coils: false,
};
/** A smoggy Delhi day: 280 at night and in the morning, 70 at 14:00–16:00 in India. */
const smoggy: OutdoorAt = (ms) => {
  const h = istHourOf(ms);
  return h >= 13 && h < 17 ? (h >= 14 && h < 16 ? 70 : 120) : 280;
};

describe("today's plan", () => {
  it('answers now, then 72 India-time hours from the next one', () => {
    const e = estimateIndoor(sharma, smoggy, T0);
    expect(e.hourly_series).toHaveLength(72);
    expect(e.hourly_series[0].time).toBe('2026-10-09T09:00:00+05:30');
    expect(e.hourly_series[71].time).toBe('2026-10-12T08:00:00+05:30');
    expect(e.outdoor_pm25_now_ug_m3).toBe(280);
    expect(Math.abs(e.indoor_pm25_now_ug_m3 - 19)).toBeLessThan(2);
    expect(e.assumptions).toMatchObject({ room_volume_m3: 40, ventilation: 'closed', infiltration_rate_ach: 0.6, decay_rate_h: 0.2, purifier_effective_cadr_m3_h: 250 });
  });

  it('on a smoggy day: windows shut except the cleanest hours, the purifier on, a mask outside', () => {
    const e = estimateIndoor(sharma, smoggy, T0);
    expect(e.plan.map((p) => p.kind)).toEqual(['windows', 'purifier', 'mask']);
    expect(e.plan[0].text).toBe("Keep the windows shut: outside stays above 60 µg/m³. If the room needs air, open them 14:00–16:00, when it's least bad (about 70 µg/m³).");
    expect(e.plan[1].text).toMatch(/^Run the purifier with the windows shut: the room stays near \d+ µg\/m³ instead of \d+\.$/);
    expect(e.plan[2].text).toMatch(/^Wear an N95 outside, most of all 09:00–11:00 \(about 280 µg\/m³\)\.$/);
    expect(e.today_plan).toBe(e.plan.map((p) => p.text).join(' '));
  });

  it('tells you to shut open windows, suggests a purifier size, and names the indoor sources', () => {
    const e = estimateIndoor({ ...sharma, windows: 2, windows_open: true, purifier_cadr_m3_h: 0, cooking_fuel: 'biomass', smokers: 1, incense: true, mosquito_coils: true }, smoggy, T0);
    const texts = e.plan.map((p) => p.text);
    expect(texts[0]).toBe("Shut the windows now: it's 280 µg/m³ outside, and an open room soon matches it.");
    expect(texts).toContainEqual(expect.stringMatching(/^A purifier with a CADR of about 200 m³\/h would bring this room from \d+ to \d+ µg\/m³\.$/));
    for (const start of ['Cooking on wood or dung adds up to', 'Smoking indoors adds up to', 'Incense adds up to', 'A mosquito coil adds up to']) {
      expect(texts.some((t) => t.startsWith(start))).toBe(true);
    }
  });

  it('on a clean day: open the windows freely, no purifier needed, no mask', () => {
    // Windows shut, 20 outside: 0.8·0.6·20/0.8 = 12.
    const e = estimateIndoor(sharma, () => 20, T0);
    expect(e.plan.map((p) => p.text)).toEqual([
      'The air outside stays under 60 µg/m³: open the windows whenever you like.',
      'The room stays clean without the purifier today (about 12 µg/m³).',
    ]);
  });

  it('a late-evening plan still covers the next 12 hours', () => {
    const late = Date.parse('2026-10-09T16:30:00Z'); // 22:00 in India: 23:00 to 10:00 is all 280
    const e = estimateIndoor(sharma, smoggy, late);
    expect(e.plan[0].text).toContain('open them 23:00–01:00');
    expect(e.plan.at(-1)?.kind).toBe('mask');
  });

  it('counts cooking in the room when the room is where you cook', () => {
    const e = estimateIndoor({ ...sharma, purifier_cadr_m3_h: 0, cooking_fuel: 'lpg' }, () => 20, T0);
    expect(e.plan.map((p) => p.text)).toContainEqual(expect.stringMatching(/^Cooking on LPG adds up to \d+ µg\/m³ at meal times/));
  });

  it('uses custom meal times without modifying the shared defaults', () => {
    const customReq: IndoorRequest = { ...sharma, cooking_fuel: 'lpg', meal_times_h: [[6, 7], [11, 12], [18, 19]] };
    const e = estimateIndoor(customReq, () => 20, T0);
    // Custom meal times shouldn't affect the base assumptions mapping structure
    expect(e.assumptions.sources_mg_h).toHaveProperty('cooking');
    // Ensure D itself wasn't mutated
    expect(D.cooking.hours[0]).toEqual([7, 8]);
  });
});

const spec = JSON.parse(readFileSync(join(__dirname, '../contracts/proposals/p3-aqi.openapi.json'), 'utf8'));
type Schema = { $ref?: string; type?: string | string[]; required?: string[]; properties?: Record<string, Schema>; items?: Schema };
function problems(value: unknown, schema: Schema, path = '$'): string[] {
  if (schema.$ref) return problems(value, spec.components.schemas[schema.$ref.split('/').pop()!], path);
  const out: string[] = [];
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  if (types.length && !types.includes(kind) && !(kind === 'integer' && types.includes('number'))) out.push(`${path}: ${kind}, not ${types.join('|')}`);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) out.push(`${path}.${key}: missing`);
    for (const [key, sub] of Object.entries(schema.properties ?? {})) if (key in value) out.push(...problems((value as Record<string, unknown>)[key], sub, `${path}.${key}`));
  }
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => out.push(...problems(v, schema.items!, `${path}[${i}]`)));
  return out;
}

/** A flat 200 µg/m³ grid over the real anchors. */
function flatGrid(): ForecastSnapshot {
  const anchors = anchorsFor();
  const field = (v: number) => anchors.map(() => Array.from({ length: 144 }, () => v));
  return {
    version: 1, generated_at: '2026-10-09T02:00:00.000Z', start: '2026-10-08T00:00:00.000Z', hours: 144, step_deg: 0.25, anchors,
    pm25: field(200), wind_u: field(0), wind_v: field(0), mixing_m: field(500), fires: [], stations: [],
    sources: { open_meteo: 'ok', cpcb: 'no_key', openaq: 'no_key', firms: 'no_key' },
  };
}

describe('POST /v1/indoor/estimate', () => {
  const post = (body: unknown, current: () => Promise<ForecastSnapshot | null> = async () => flatGrid()) =>
    answerIndoor(new Request('http://saans.test/v1/indoor/estimate', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), current, T0);

  it("answers in the contract's shape, filling the defaults", async () => {
    const res = await post({ lat: sharma.lat, lon: sharma.lon, room_area_m2: 14.8, windows: 1 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(problems(body, spec.components.schemas.IndoorEstimateResponse)).toEqual([]);
    expect(body.outdoor_pm25_now_ug_m3).toBe(200);
    expect(body.indoor_pm25_now_ug_m3).toBeCloseTo(120, 0); // 0.8·0.6·200/0.8
    expect(body.assumptions).toMatchObject({ purifier_effective_cadr_m3_h: 0, hepa_class: 'none', ventilation: 'closed' });
    expect(body.hourly_series).toHaveLength(72);
  });

  it('422s a missing or wrong field, naming each', async () => {
    const missing = await (await post({ lat: 28.5, lon: 77.4 })).json();
    expect(missing.error.details).toEqual([
      { field: 'body.room_area_m2', problem: 'required' },
      { field: 'body.windows', problem: 'required' },
    ]);
    const wrong = await (await post({ ...sharma, windows: 1.5, cooking_fuel: 'coal', room_area_m2: 0 })).json();
    expect(wrong.error.details.map((d: { field: string }) => d.field)).toEqual(['body.room_area_m2', 'body.windows', 'body.cooking_fuel']);
    const notJson = await post('{nope');
    expect([notJson.status, (await notJson.json()).error.message]).toEqual([422, 'The body must be JSON']);
  });

  it('404s outside Punjab and the NCR, and 503s without a grid', async () => {
    const away = await post({ ...sharma, lat: 19.07, lon: 72.87 });
    expect([away.status, (await away.json()).error.code]).toEqual([404, 'no_coverage']);
    expect((await post(sharma, async () => null)).status).toBe(503);
  });
});
