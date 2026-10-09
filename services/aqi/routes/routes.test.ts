// Saaf Raasta (P3): cutting and timing routes, the dose against a hand-worked case, picking a route and a
// better departure, OSRM's answers, and POST /v1/routes/clean against the contract.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { anchorsFor, type ForecastSnapshot } from '../forecast/grid';
import { MODE_FACTORS, PIECE_M, chooseRoute, cutRoute, doseAlong, segmentsOf, type Pm25At } from './clean';
import { answerCleanRoute } from './http';
import { NoRouteError, fromOsrm, osrmProvider, osrmUrl, type RouteOption, type RouteProvider } from './providers';

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, 'fixtures', `${name}.json`), 'utf8'));
const NOIDA = { lat: 28.5355, lon: 77.391 };
const SAKET = { lat: 28.5245, lon: 77.2167 };
const DEPART = Date.parse('2026-10-09T03:00:00Z'); // 08:30 in India
const M_PER_DEG = (6371 * Math.PI * 1000) / 180;

/** A point `m` metres east of lon 77.2 on lat 28.6. */
const east = (m: number): [number, number] => [77.2 + m / (M_PER_DEG * Math.cos((28.6 * Math.PI) / 180)), 28.6];

/** Two steps going east: 1 km of A Road in 2 minutes at congestion 0.5, then 1.5 km of B Road in 5 minutes. */
const handRoute: RouteOption = {
  distance_m: 2500,
  duration_s: 420,
  source: 'osrm',
  steps: [
    { name: 'A Road', distance_m: 1000, duration_s: 120, congestion: 0.5, coords: [east(0), east(1000)] },
    { name: 'B Road', distance_m: 1500, duration_s: 300, congestion: 0, coords: [east(1000), east(2500)] },
  ],
};
/** 100 µg/m³ for the first 3 minutes after departure, 200 after. */
const stepUp: Pm25At = (_lat, _lon, ms) => (ms - DEPART < 180_000 ? 100 : 200);

describe('cutting and timing a route', () => {
  it('cuts into pieces of at most 500 m, timed at their middles', () => {
    const pieces = cutRoute(handRoute);
    expect(pieces.map((p) => [p.name, Math.round(p.distance_m), Math.round(p.duration_s), Math.round(p.at_s)])).toEqual([
      ['A Road', 500, 60, 30],
      ['A Road', 500, 60, 90],
      ['B Road', 500, 100, 170],
      ['B Road', 500, 100, 270],
      ['B Road', 500, 100, 370],
    ]);
  });

  it('keeps every metre and second of a real route', () => {
    for (const name of ['noida-to-saket', 'cp-to-sarita-vihar']) {
      for (const route of fromOsrm(fixture(name))) {
        const pieces = cutRoute(route);
        expect(Math.max(...pieces.map((p) => p.distance_m))).toBeLessThanOrEqual(PIECE_M + 1e-6);
        expect(pieces.reduce((a, p) => a + p.duration_s, 0)).toBeCloseTo(route.steps.reduce((a, s) => a + s.duration_s, 0), 3);
        expect(pieces.reduce((a, p) => a + p.distance_m, 0)).toBeCloseTo(route.steps.reduce((a, s) => a + s.distance_m, 0), 3);
        expect(pieces.every((p, i) => i === 0 || p.at_s > pieces[i - 1].at_s)).toBe(true);
      }
    }
  });
});

describe('the dose', () => {
  it('matches the hand-worked case to ±1%', () => {
    // Two-wheeler: f = 1.0, BR = 0.6 m³/h.
    // A Road: 2 pieces × 100 µg/m³ × (1 + 0.3·0.5) × 0.6 × 60/3600 h          = 2.3000 µg
    // B Road: 100 × 0.6 × 100/3600 (reached at 170 s) + 2 × 200 × 0.6 × 100/3600 = 8.3333 µg
    // Total 10.6333 µg; with a mask that stops 90%, 1.0633 µg.
    const hand = 2.3 + 8.3333;
    const got = doseAlong(cutRoute(handRoute), DEPART, 'two_wheeler', 0, stepUp)!;
    expect(Math.abs(got.dose_ug - hand) / hand).toBeLessThan(0.01);
    const masked = doseAlong(cutRoute(handRoute), DEPART, 'two_wheeler', 0.9, stepUp)!;
    expect(Math.abs(masked.dose_ug - hand * 0.1) / (hand * 0.1)).toBeLessThan(0.01);
  });

  it('scales with the mode: a car with the windows up breathes 0.5 × 0.5 / 0.6 of a two-wheeler', () => {
    const bike = doseAlong(cutRoute(handRoute), DEPART, 'two_wheeler', 0, stepUp)!.dose_ug;
    const car = doseAlong(cutRoute(handRoute), DEPART, 'car_windows_up', 0, stepUp)!.dose_ug;
    expect(car / bike).toBeCloseTo((MODE_FACTORS.car_windows_up.f * MODE_FACTORS.car_windows_up.breathing_rate_m3_h) / 0.6, 9);
  });

  it('holds the last value past the grid, and gives up only when there is none', () => {
    const edge: Pm25At = (_lat, lon) => (lon > east(1200)[0] ? null : 100);
    const got = doseAlong(cutRoute(handRoute), DEPART, 'walk', 0, edge)!;
    expect(got.pieces.map((p) => p.pm25)).toEqual([100, 100, 100, 100, 100]);
    expect(doseAlong(cutRoute(handRoute), DEPART, 'walk', 0, () => null)).toBeNull();
  });

  it('joins pieces into named stretches, unnamed ones into the stretch before, at most six', () => {
    const route = fromOsrm(fixture('noida-to-saket'))[0];
    const d = doseAlong(cutRoute(route), DEPART, 'two_wheeler', 0, () => 150)!;
    const segments = segmentsOf(d.pieces);
    expect(segments.length).toBeLessThanOrEqual(6);
    expect(segments.reduce((a, s) => a + s.duration_min, 0)).toBeCloseTo(route.duration_s / 60, 0);
    expect(segments.every((s) => s.pm25_ug_m3 === 150 && s.name.length > 0)).toBe(true);
  });
});

describe('picking a route', () => {
  /** A copy of the hand route, stretched in time. */
  const variant = (seconds: number, name: string): RouteOption => ({
    ...handRoute,
    duration_s: seconds,
    steps: handRoute.steps.map((s) => ({ ...s, name, duration_s: (s.duration_s * seconds) / handRoute.duration_s })),
  });
  it('drops a route that is both slower and dirtier, and recommends the cleanest within the extra time', () => {
    const options = [variant(600, 'Fast Road'), variant(1200, 'Park Road'), variant(1300, 'Factory Road')];
    // Each copy sits 0.1° further north, and its PM2.5 is read from that: 200, 60 and 250 µg/m³.
    const shifted = options.map((o, i) => ({ ...o, steps: o.steps.map((s) => ({ ...s, coords: s.coords.map(([x, y]) => [x, y + i * 0.1] as [number, number]) })) }));
    const pmByLat: Pm25At = (lat) => [200, 60, 250][Math.round((lat - 28.6) / 0.1)];
    const roomy = chooseRoute(shifted, DEPART, 'two_wheeler', 0, 15, pmByLat, DEPART)!;
    expect(roomy.routes.map((r) => r.label)).toEqual(['Via Fast Road (fastest)', 'Via Park Road']);
    expect(roomy.recommended_route_id).toBe('r2');
    expect(roomy.routes[1].percent_lower_than_fastest).toBe(Math.round((1 - (60 * 1200) / (200 * 600)) * 100));
    const tight = chooseRoute(shifted, DEPART, 'two_wheeler', 0, 5, pmByLat, DEPART)!;
    expect(tight.recommended_route_id).toBe('r1');
  });

  it('suggests leaving later when the air clears, never in the past, and only for a 10% gain', () => {
    const clearing: Pm25At = (_lat, _lon, ms) => (ms < DEPART + 60 * 60_000 ? 300 : 100);
    const later = chooseRoute([handRoute], DEPART, 'two_wheeler', 0, 15, clearing, DEPART)!;
    expect(later.better_departure_ms).toBe(DEPART + 60 * 60_000);
    const worseLater: Pm25At = (_lat, _lon, ms) => (ms < DEPART ? 100 : 300);
    expect(chooseRoute([handRoute], DEPART, 'two_wheeler', 0, 15, worseLater, DEPART)!.better_departure_ms).toBeUndefined();
    const flat = chooseRoute([handRoute], DEPART, 'two_wheeler', 0, 15, () => 150, DEPART - 3 * 3_600_000)!;
    expect(flat.better_departure_ms).toBeUndefined();
  });

  it('names the real Noida → Saket routes uniquely and marks the fastest', () => {
    const choice = chooseRoute(fromOsrm(fixture('noida-to-saket')), DEPART, 'two_wheeler', 0, 15, () => 150, DEPART)!;
    const labels = choice.routes.map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.filter((l) => l.endsWith('(fastest)'))).toHaveLength(1);
  });
});

describe('OSRM', () => {
  it('asks the car router for two-wheelers, cars and buses, and FOSSGIS for walking and cycling', () => {
    expect(osrmUrl(NOIDA, SAKET, 'two_wheeler')).toBe(
      'https://router.project-osrm.org/route/v1/driving/77.39100,28.53550;77.21670,28.52450?alternatives=3&overview=false&steps=true&geometries=geojson',
    );
    expect(osrmUrl(NOIDA, SAKET, 'walk')).toContain('routing.openstreetmap.de/routed-foot/route/v1/foot/');
    expect(osrmUrl(NOIDA, SAKET, 'cycle')).toContain('routing.openstreetmap.de/routed-bike/route/v1/bike/');
  });

  it('reads routes and steps, and says when there is no route', async () => {
    const routes = fromOsrm(fixture('noida-to-saket'));
    expect(routes.map((r) => Math.round(r.distance_m / 100) / 10)).toEqual([25.2, 27.7]);
    expect(() => fromOsrm({ code: 'NoRoute' })).toThrow(NoRouteError);
    const p = osrmProvider(vi.fn(async () => new Response('{}', { status: 400 })) as unknown as typeof fetch);
    await expect(p.routes(NOIDA, SAKET, DEPART, 'two_wheeler')).rejects.toThrow(NoRouteError);
    await expect(p.routes(NOIDA, SAKET, DEPART, 'metro')).rejects.toThrow('Metro journeys are not routed yet');
  });
});

const spec = JSON.parse(readFileSync(join(__dirname, '../../../packages/contracts/proposals/p3-aqi.openapi.json'), 'utf8'));
type Schema = { $ref?: string; type?: string | string[]; enum?: unknown[]; required?: string[]; properties?: Record<string, Schema>; items?: Schema; minimum?: number };
function problems(value: unknown, schema: Schema, path = '$'): string[] {
  if (schema.$ref) return problems(value, spec.components.schemas[schema.$ref.split('/').pop()!], path);
  const out: string[] = [];
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  if (types.length && !types.includes(kind) && !(kind === 'integer' && types.includes('number'))) out.push(`${path}: ${kind}, not ${types.join('|')}`);
  if (schema.enum && !schema.enum.includes(value)) out.push(`${path}: ${String(value)} not in ${schema.enum.join(', ')}`);
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) out.push(`${path}: below ${schema.minimum}`);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) out.push(`${path}.${key}: missing`);
    for (const [key, sub] of Object.entries(schema.properties ?? {})) if (key in value) out.push(...problems((value as Record<string, unknown>)[key], sub, `${path}.${key}`));
  }
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => out.push(...problems(v, schema.items!, `${path}[${i}]`)));
  return out;
}

/** A grid over the real anchors: 250 µg/m³ in the morning, 120 from 10:30 in India. */
function grid(): ForecastSnapshot {
  const anchors = anchorsFor();
  const field = (f: (h: number) => number) => anchors.map(() => Array.from({ length: 144 }, (_, h) => f(h)));
  // Hour 0 is 2026-10-08 00:00 UTC; 2026-10-09 05:00 UTC (10:30 in India) is hour 29.
  return {
    version: 1, generated_at: '2026-10-09T02:00:00.000Z', start: '2026-10-08T00:00:00.000Z', hours: 144, step_deg: 0.25, anchors,
    pm25: field((h) => (h < 29 ? 250 : 120)), wind_u: field(() => 0), wind_v: field(() => 0), mixing_m: field(() => 500), fires: [], stations: [],
    sources: { open_meteo: 'ok', cpcb: 'no_key', openaq: 'no_key', firms: 'no_key' },
  };
}

describe('POST /v1/routes/clean', () => {
  const saved: RouteProvider = { routes: async () => fromOsrm(fixture('noida-to-saket')) };
  const body = { origin: NOIDA, destination: SAKET, depart_at: '2026-10-09T08:30:00+05:30', mode: 'two_wheeler' };
  const post = (b: unknown, provider = saved, current: () => Promise<ForecastSnapshot | null> = async () => grid()) =>
    answerCleanRoute(new Request('http://saans.test/v1/routes/clean', { method: 'POST', body: typeof b === 'string' ? b : JSON.stringify(b) }), current, provider, DEPART - 30 * 60_000);

  it("answers in the contract's shape, quickly, with a later departure when the air clears", async () => {
    const t = performance.now();
    const res = await post(body);
    const ms = performance.now() - t;
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(problems(out, spec.components.schemas.CleanRouteResponse)).toEqual([]);
    expect(out.routes.length).toBeGreaterThanOrEqual(1);
    expect(out.depart_at).toBe('2026-10-09T08:30:00+05:30');
    expect(out.better_departure_time).toBe('2026-10-09T10:30:00+05:30');
    expect(out.mode_factors_used).toEqual({ f: 1, breathing_rate_m3_h: 0.6, note: 'Planning values — not medical advice' });
    expect(ms).toBeLessThan(500);
  });

  it('422s bad requests, naming each field', async () => {
    const missing = await (await post({ mode: 'walk' })).json();
    expect(missing.error.details.map((d: { field: string }) => d.field)).toEqual(['body.origin', 'body.destination', 'body.depart_at']);
    const wrong = await (await post({ ...body, mode: 'rickshaw', max_extra_min: -1 })).json();
    expect(wrong.error.details.map((d: { field: string }) => d.field)).toEqual(['body.mode', 'body.max_extra_min']);
    const far = await post({ ...body, depart_at: '2026-10-14T08:30:00+05:30' });
    expect([far.status, (await far.json()).error.details]).toEqual([422, [{ field: 'body.depart_at', problem: 'outside the forecast' }]]);
    expect((await post('{nope')).status).toBe(422);
  });

  it('404s outside the regions or with no route, and 503s when a source is down', async () => {
    expect((await post({ ...body, destination: { lat: 19.07, lon: 72.87 } })).status).toBe(404);
    const metro = await post({ ...body, mode: 'metro' }, osrmProvider(vi.fn() as unknown as typeof fetch));
    expect([metro.status, (await metro.json()).error.message]).toEqual([404, 'Metro journeys are not routed yet']);
    const down: RouteProvider = { routes: async () => { throw new Error('OSRM 502'); } };
    expect((await post(body, down)).status).toBe(503);
    expect((await post(body, saved, async () => null)).status).toBe(503);
  });
});
