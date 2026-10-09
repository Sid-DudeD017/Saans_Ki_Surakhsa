// The forecast grid (P3): the lattice and 1 km cells, the upstream parsers, the smoke plume, the station bias,
// Ĉ = forecast + bias·e^(−lead/6 h) + plume, GET /v1/aqi/forecast against the contract, and which grid is used.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { getCategoryCode, subIndex } from '../../../packages/aqi/index';
import { biasAt, liveObservations, stationResiduals, type Observation } from './bias';
import { ANCHOR_STEP_DEG, BIAS, PLUME, REGIONS } from './config';
import { buildSnapshot, forecastSeries, istIso, modelFor, modelName, nextIstHour } from './forecast';
import { Grid, KM_PER_DEG, anchorsFor, cellOf, inCoverage, type Fire, type ForecastSnapshot, type StationResidual } from './grid';
import { answerForecast } from './http';
import { Plume, emissionUgPerS, sigmaM } from './plume';
import { forecastService, refreshForecast } from './service';
import { cpcbTime, fetchAnchorSeries, fetchCpcb, fetchOpenAq, fetchRegionFires } from './sources';
import { memoryStore } from './store';

const START = '2026-10-08T00:00:00.000Z';
const HOUR = 3_600_000;
const SANGRUR = { lat: 30.245, lon: 75.842 };
const DELHI = { lat: 28.6139, lon: 77.209 };

type Fn = (lat: number, lon: number, hour: number) => number | null;

/** A snapshot over the real anchors, with fields given as functions. */
function snapshot(opts: { pm25?: Fn; u?: Fn; v?: Fn; mixing?: Fn; hours?: number; fires?: Fire[]; stations?: StationResidual[]; generatedAt?: string } = {}): ForecastSnapshot {
  const hours = opts.hours ?? 144;
  const anchors = anchorsFor();
  const field = (f: Fn) => anchors.map(([r, c]) => Array.from({ length: hours }, (_, h) => f(r * ANCHOR_STEP_DEG, c * ANCHOR_STEP_DEG, h)));
  return {
    version: 1,
    generated_at: opts.generatedAt ?? '2026-10-09T02:30:00.000Z',
    start: START,
    hours,
    step_deg: ANCHOR_STEP_DEG,
    anchors,
    pm25: field(opts.pm25 ?? (() => 80)),
    wind_u: field(opts.u ?? (() => 0)),
    wind_v: field(opts.v ?? (() => 0)),
    mixing_m: field(opts.mixing ?? (() => 500)),
    fires: opts.fires ?? [],
    stations: opts.stations ?? [],
    sources: { open_meteo: 'ok', cpcb: 'no_key', openaq: 'no_key', firms: 'no_key' },
  };
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dy = (a.lat - b.lat) * KM_PER_DEG;
  const dx = (a.lon - b.lon) * KM_PER_DEG * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/** A point `east` and `north` km from another. */
function offset(p: { lat: number; lon: number }, east: number, north: number) {
  return { lat: p.lat + north / KM_PER_DEG, lon: p.lon + east / (KM_PER_DEG * Math.cos((p.lat * Math.PI) / 180)) };
}

const hourIso = (h: number) => new Date(Date.parse(START) + h * HOUR).toISOString();

describe('the lattice and 1 km cells', () => {
  it('every point in Punjab and the NCR has all four lattice corners, from about 350 anchors', () => {
    const anchors = new Set(anchorsFor().map(([r, c]) => `${r},${c}`));
    expect(anchors.size).toBeGreaterThan(300);
    expect(anchors.size).toBeLessThan(400);
    for (const r of REGIONS) {
      for (let lat = r.minLat; lat <= r.maxLat; lat += 0.05) {
        for (let lon = r.minLon; lon <= r.maxLon; lon += 0.05) {
          const r0 = Math.floor(lat / ANCHOR_STEP_DEG);
          const c0 = Math.floor(lon / ANCHOR_STEP_DEG);
          for (const k of [`${r0},${c0}`, `${r0 + 1},${c0}`, `${r0},${c0 + 1}`, `${r0 + 1},${c0 + 1}`]) expect(anchors.has(k)).toBe(true);
        }
      }
    }
  });

  it('covers Punjab and the NCR, and nowhere else', () => {
    const inside = [SANGRUR, DELHI, { lat: 31.634, lon: 74.872 }, { lat: 28.4595, lon: 77.0266 }, { lat: 30.901, lon: 75.857 }];
    const outside = [{ lat: 19.076, lon: 72.877 }, { lat: 26.912, lon: 75.787 }, { lat: 31.104, lon: 77.173 }];
    expect(inside.map((p) => inCoverage(p.lat, p.lon))).toEqual(inside.map(() => true));
    expect(outside.map((p) => inCoverage(p.lat, p.lon))).toEqual(outside.map(() => false));
  });

  it('cells are 1 km ± 3% across both regions, and a point is in its own cell', () => {
    for (const lat of [27.2, 30, 32.5]) {
      const a = cellOf(lat, 76.5);
      const east = cellOf(a.lat, a.lon + 1.2 / (KM_PER_DEG * Math.cos((30 * Math.PI) / 180)));
      const north = cellOf(a.lat + 1.2 / KM_PER_DEG, a.lon);
      expect(km(a, north)).toBeCloseTo(1, 6);
      expect(Math.abs(km(a, east) - 1)).toBeLessThan(0.03);
    }
    const c = cellOf(SANGRUR.lat, SANGRUR.lon);
    expect(km(c, SANGRUR)).toBeLessThan(0.71);
    expect(cellOf(c.lat, c.lon)).toEqual(c);
  });

  it('reads anchors exactly, interpolates between them, skips gaps, and is linear in time', () => {
    const grid = new Grid(snapshot({ pm25: (lat, lon, h) => (lat === 30.5 && lon === 76 ? null : lat * 10 + lon + h) }));
    expect(grid.value('pm25', 30, 76, 0)).toBeCloseTo(376, 9);
    expect(grid.value('pm25', 30.125, 76.125, 0)).toBeCloseTo(377.375, 9); // the mean of the corners
    expect(grid.value('pm25', 30, 76, 2.25)).toBeCloseTo(378.25, 9);
    // 30.5/76 is missing: at 30.25/76 → 30.5/76 halfway, only the 30.25 corner is left.
    expect(grid.value('pm25', 30.375, 76, 0)).toBeCloseTo(378.5, 9);
    expect([grid.value('pm25', 30, 76, -1), grid.value('pm25', 30, 76, 144), grid.value('pm25', 19, 72, 0)]).toEqual([null, null, null]);
  });
});

/** A fake Open-Meteo: values from the asked-for latitude and longitude. */
function openMeteo(calls: string[], hours = 3) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url.hostname);
    const lats = url.searchParams.get('latitude')!.split(',').map(Number);
    const lons = url.searchParams.get('longitude')!.split(',').map(Number);
    const time = Array.from({ length: hours }, (_, h) => `2026-10-08T0${h}:00`);
    const list = lats.map((lat, i) => ({
      hourly: url.hostname.startsWith('air')
        ? { time, pm2_5: time.map((_, h) => (h === 1 && i === 0 ? null : Math.round(lat * 10 + lons[i] + h))) }
        : { time, wind_speed_10m: time.map(() => 36), wind_direction_10m: time.map(() => 270), boundary_layer_height: time.map(() => 750) },
    }));
    return new Response(JSON.stringify(list.length === 1 ? list[0] : list));
  }) as unknown as typeof fetch;
}

describe('reading the upstreams', () => {
  it('asks Open-Meteo 100 anchors at a time, and turns wind from the west into smoke moving east', async () => {
    const calls: string[] = [];
    const points = Array.from({ length: 250 }, (_, i) => ({ lat: 28 + Math.floor(i / 20) * 0.25, lon: 76 + (i % 20) * 0.25 }));
    const s = await fetchAnchorSeries(openMeteo(calls), points);
    expect(calls.filter((h) => h.startsWith('air'))).toHaveLength(3);
    expect(calls.filter((h) => h.startsWith('api'))).toHaveLength(3);
    expect(s.times).toEqual(['2026-10-08T00:00:00.000Z', '2026-10-08T01:00:00.000Z', '2026-10-08T02:00:00.000Z']);
    expect(s.pm25[0]).toEqual([356, null, 358]);
    expect(s.pm25[249][0]).toBe(Math.round(31 * 10 + 78.25)); // anchor 249 is at 31° N, 78.25° E
    expect([s.wind_u[0][0], Math.abs(s.wind_v[0][0]!), s.mixing_m[0][0]]).toEqual([10, 0, 750]);
  });

  it('takes a single location (Open-Meteo answers with an object), and refuses a short answer', async () => {
    const s = await fetchAnchorSeries(openMeteo([]), [{ lat: 30, lon: 76 }]);
    expect(s.pm25).toHaveLength(1);
    const short = vi.fn(async () => new Response(JSON.stringify([{ hourly: { time: ['2026-10-08T00:00'] } }]))) as unknown as typeof fetch;
    await expect(fetchAnchorSeries(short, [{ lat: 30, lon: 76 }, { lat: 30, lon: 76.25 }])).rejects.toThrow('1 locations for 2');
  });

  it('reads CPCB times as India time, both average field names, and only stations we cover', async () => {
    expect(cpcbTime('09-10-2026 10:00:00')).toBe('2026-10-09T04:30:00.000Z');
    expect(cpcbTime('2026-10-09 10:00')).toBeNull();
    const urls: string[] = [];
    const fake = vi.fn(async (u: string) => {
      urls.push(u);
      return new Response(
        JSON.stringify({
          records: [
            { station: 'Sangrur', latitude: '30.245', longitude: '75.842', last_update: '09-10-2026 10:00:00', avg_value: '142' },
            { station: 'Patiala', latitude: '30.34', longitude: '76.39', last_update: '09-10-2026 10:00:00', pollutant_avg: '120' },
            { station: 'Down', latitude: '30.3', longitude: '76.3', last_update: '09-10-2026 10:00:00', avg_value: 'NA' },
            { station: 'Mumbai', latitude: '19.07', longitude: '72.87', last_update: '09-10-2026 10:00:00', avg_value: '40' },
          ],
        }),
      );
    }) as unknown as typeof fetch;
    const obs = await fetchCpcb(fake, 'k');
    expect(obs.map((o) => [o.id, o.pm25])).toEqual([['cpcb-Sangrur', 142], ['cpcb-Patiala', 120]]);
    expect(urls[0]).toContain('filters%5Bpollutant_id%5D=PM2.5');
  });

  it('pages through OpenAQ with the key in a header, keeping what we cover', async () => {
    const seen: { url: string; key: string | null }[] = [];
    const fake = vi.fn(async (u: string, init?: RequestInit) => {
      seen.push({ url: u, key: new Headers(init?.headers).get('X-API-Key') });
      return new Response(
        JSON.stringify({
          results: [
            { datetime: { utc: '2026-10-09T04:00:00Z' }, value: 160, coordinates: { latitude: 28.63, longitude: 77.2 }, locationsId: 8118 },
            { datetime: { utc: '2026-10-09T04:00:00Z' }, value: 12, coordinates: { latitude: 51.5, longitude: -0.1 }, locationsId: 1 },
          ],
        }),
      );
    }) as unknown as typeof fetch;
    const obs = await fetchOpenAq(fake, 'secret', Date.parse('2026-10-09T05:00:00Z'));
    expect(obs).toEqual([{ id: 'openaq-8118', source: 'openaq', lat: 28.63, lon: 77.2, time: '2026-10-09T04:00:00.000Z', pm25: 160 }]);
    expect(seen).toHaveLength(1);
    expect(seen[0].key).toBe('secret');
    expect(seen[0].url).toContain('datetime_min=2026-10-09T02%3A00%3A00.000Z');
  });

  it('fetches the rest of OpenAQ\'s pages together once page 1 gives the count', async () => {
    const pages: number[] = [];
    const fake = vi.fn(async (u: string) => {
      const n = Number(new URL(u).searchParams.get('page'));
      pages.push(n);
      const r = { datetime: { utc: '2026-10-09T04:00:00Z' }, value: 100 + n, coordinates: { latitude: 28.6, longitude: 77.2 }, locationsId: n };
      return new Response(JSON.stringify({ meta: { found: 2500 }, results: n < 3 ? Array.from({ length: 1000 }, () => r) : [r] }));
    }) as unknown as typeof fetch;
    const obs = await fetchOpenAq(fake, 'k', Date.parse('2026-10-09T05:00:00Z'));
    expect(pages.sort()).toEqual([1, 2, 3]);
    expect(obs).toHaveLength(2001);
  });

  it('keeps FIRMS fires at nominal or high confidence, with power, in the regions', async () => {
    const at = '2026-10-09T13:30:00+05:30';
    const asked: unknown[][] = [];
    const fires = await fetchRegionFires('k', async (...args: unknown[]) => (asked.push(args), [
      { lat: 30.3, lon: 75.9, acquisition_time: at, satellite: 'N', confidence: 'n', frp: 6.2 },
      { lat: 30.3, lon: 75.9, acquisition_time: at, satellite: 'N', confidence: 'l', frp: 3 },
      { lat: 30.3, lon: 75.9, acquisition_time: at, satellite: 'N', confidence: 'h', frp: NaN },
      { lat: 26.9, lon: 75.8, acquisition_time: at, satellite: 'N', confidence: 'h', frp: 9 },
    ]));
    expect(asked[0].slice(1)).toEqual(['k', 2]);
    expect(fires).toEqual([{ lat: 30.3, lon: 75.9, seen_at: '2026-10-09T08:00:00.000Z', frp_mw: 6.2 }]);
  });
});

describe('the smoke plume', () => {
  const fire = { ...SANGRUR, seen_at: hourIso(2), frp_mw: 10 };
  const east = () => 5; // m/s, so 18 km an hour

  it('spreads by Briggs rural class D, never under half a cell', () => {
    expect([sigmaM(0), sigmaM(5000)]).toEqual([500, 500]);
    expect(sigmaM(10_000)).toBeCloseTo((0.08 * 10_000) / Math.sqrt(2), 9);
    expect(emissionUgPerS(10)).toBe(10 * PLUME.kgPerMJ * 1e9);
  });

  it('keeps the mass it releases: concentration × mixing height, summed over the ground, is the puffs released', () => {
    const plume = new Plume(new Grid(snapshot({ u: east, mixing: () => 800 })), [fire]);
    // At hour 4, every puff released from hour 2 up to hour 4 (or until the fire burns out) is out.
    const dt = PLUME.stepMinutes / 60;
    const puffs = Math.min(PLUME.burnHours / dt, 2 / dt + 1);
    const released = puffs * emissionUgPerS(10) * PLUME.stepMinutes * 60;
    let total = 0;
    const cell = 0.2; // km
    for (let e = -5; e <= 45; e += cell) for (let n = -5; n <= 5; n += cell) {
      const p = offset(fire, e, n);
      total += plume.at(p.lat, p.lon, 4) * 800 * (cell * 1000) ** 2;
    }
    expect(total / released).toBeCloseTo(1, 2);
  });

  it('goes downwind, not upwind, and thins under a deeper mixing layer', () => {
    const low = new Plume(new Grid(snapshot({ u: east, mixing: () => 400 })), [fire]);
    const high = new Plume(new Grid(snapshot({ u: east, mixing: () => 1600 })), [fire]);
    // Seen at hour 2, burning for an hour at 18 km/h: at hour 3 its first puff is 18 km downwind.
    const down = offset(fire, 18, 0);
    const up = offset(fire, -18, 0);
    expect(low.at(down.lat, down.lon, 3)).toBeGreaterThan(10);
    expect(low.at(up.lat, up.lon, 3)).toBeLessThan(1e-6);
    expect(low.at(down.lat, down.lon, 3) / high.at(down.lat, down.lon, 3)).toBeCloseTo(4, 6);
  });

  it('follows the wind when it turns: east for an hour, then north', () => {
    const plume = new Plume(new Grid(snapshot({ u: (_a, _b, h) => (h < 3 ? 5 : 0), v: (_a, _b, h) => (h < 3 ? 0 : 5) })), [{ ...fire, frp_mw: 10 }]);
    // The first puff leaves at hour 2. The wind turns from east to north between hours 2 and 3 (linear in
    // time), so its 15-minute steps go (5, 0), (3.75, 1.25), (2.5, 2.5), (1.25, 3.75) m/s: 11.25 km east and
    // 6.75 km north. Then 3 hours north at 5 m/s, another 54 km.
    const bent = offset(fire, 11.25, 60.75);
    const straight = offset(fire, 72, 0);
    expect(plume.at(bent.lat, bent.lon, 6)).toBeGreaterThan(0.5);
    expect(plume.at(straight.lat, straight.lon, 6)).toBeLessThan(1e-6);
  });

  it('a fire burns for an hour, puffs last 12, and fires without power or after the grid add nothing', () => {
    const plume = new Plume(new Grid(snapshot({ u: () => 0.5 })), [fire, { ...fire, frp_mw: 0 }, { ...fire, seen_at: hourIso(500) }]);
    expect(plume.puffCount).toBe(PLUME.burnHours * (60 / PLUME.stepMinutes));
    expect(plume.at(fire.lat, fire.lon, 3)).toBeGreaterThan(0);
    expect(plume.at(fire.lat, fire.lon, 2 + PLUME.burnHours + PLUME.maxAgeHours + 1)).toBe(0);
    expect(plume.at(fire.lat, fire.lon, 1)).toBe(0);
  });

  it('reads between whole hours linearly', () => {
    const plume = new Plume(new Grid(snapshot({ u: east })), [fire]);
    const p = offset(fire, 9, 0);
    expect(plume.at(p.lat, p.lon, 3.5)).toBeCloseTo((plume.at(p.lat, p.lon, 3) + plume.at(p.lat, p.lon, 4)) / 2, 9);
  });
});

describe('the station bias', () => {
  const now = Date.parse('2026-10-09T05:10:00Z');
  const ob = (o: Partial<Observation>): Observation => ({ id: 'cpcb-x', source: 'cpcb', ...SANGRUR, time: '2026-10-09T05:00:00Z', pm25: 150, ...o });

  it('keeps live, sane readings in the regions, the newest per station, and one per monitor', () => {
    const live = liveObservations(
      [
        ob({ id: 'cpcb-old', time: '2026-10-09T01:00:00Z' }),
        ob({ id: 'cpcb-future', time: '2026-10-09T07:00:00Z' }),
        ob({ id: 'cpcb-mumbai', lat: 19.07, lon: 72.87 }),
        ob({ id: 'cpcb-neg', pm25: -4 }),
        ob({ id: 'openaq-stuck', source: 'openaq', ...offset(SANGRUR, 60, 0), pm25: 0.9 }),
        ob({ id: 'cpcb-huge', pm25: 1500 }),
        ob({ id: 'cpcb-a', time: '2026-10-09T04:00:00Z', pm25: 100 }),
        ob({ id: 'cpcb-a', time: '2026-10-09T05:00:00Z', pm25: 110 }),
        ob({ id: 'openaq-1', source: 'openaq', ...offset(DELHI, 0, 0), pm25: 200 }),
        ob({ id: 'cpcb-delhi-same', ...offset(DELHI, 0.3, 0), pm25: 190 }),
        ob({ id: 'cpcb-delhi-other', ...offset(DELHI, 2, 0), pm25: 180 }),
      ],
      now,
    );
    expect(live.map((o) => [o.id, o.pm25])).toEqual([['cpcb-a', 110], ['openaq-1', 200], ['cpcb-delhi-other', 180]]);
  });

  it('compares a station with the forecast plus the plume, at its hour', () => {
    const s = snapshot({ pm25: () => 100 });
    const { grid, plume } = modelFor(s);
    const [r] = stationResiduals(grid, plume, [ob({ time: hourIso(29), pm25: 130 })]);
    expect(r).toMatchObject({ observed: 130, expected: 100, residual: 30, time: hourIso(29) });
    const smoky = snapshot({ pm25: () => 100, fires: [{ ...offset(SANGRUR, -3, 0), seen_at: hourIso(28), frp_mw: 20 }], u: () => 3 });
    const m = modelFor(smoky);
    const [withSmoke] = stationResiduals(m.grid, m.plume, [ob({ time: hourIso(29), pm25: 130 })]);
    expect(withSmoke.expected).toBeGreaterThan(101);
    expect(withSmoke.residual).toBeCloseTo(130 - withSmoke.expected, 1);
  });

  const station: StationResidual = { id: 'cpcb-x', source: 'cpcb', ...SANGRUR, time: hourIso(29), observed: 130, expected: 100, residual: 30 };

  it('pulls fully at the station, fades as e^(−lead/6 h), and with distance until 45 km', () => {
    expect(biasAt([station], START, SANGRUR.lat, SANGRUR.lon, 29)).toBeCloseTo(30, 9);
    expect(biasAt([station], START, SANGRUR.lat, SANGRUR.lon, 29 + BIAS.fadeHours)).toBeCloseTo(30 / Math.E, 9);
    const p15 = offset(SANGRUR, 0, 15);
    expect(biasAt([station], START, p15.lat, p15.lon, 29)).toBeCloseTo(30 * Math.exp(-0.5), 3);
    const p50 = offset(SANGRUR, 0, 50);
    expect(biasAt([station], START, p50.lat, p50.lon, 29)).toBe(0);
  });

  it('averages stations that agree on a place, and a reading in the past still fades from its own hour', () => {
    const two = [station, { ...station, id: 'openaq-y', residual: 10 }];
    expect(biasAt(two, START, SANGRUR.lat, SANGRUR.lon, 29)).toBeCloseTo(20, 9);
    expect(biasAt([station], START, SANGRUR.lat, SANGRUR.lon, 28)).toBeCloseTo(30, 9);
  });
});

describe('Ĉ = forecast + bias·e^(−lead/6 h) + plume', () => {
  it('starts at the next whole hour in India time', () => {
    expect(new Date(nextIstHour(Date.parse('2026-10-09T02:30:00Z'))).toISOString()).toBe('2026-10-09T03:30:00.000Z');
    expect(new Date(nextIstHour(Date.parse('2026-10-09T02:31:00Z'))).toISOString()).toBe('2026-10-09T03:30:00.000Z');
    expect(new Date(nextIstHour(Date.parse('2026-10-09T02:29:00Z'))).toISOString()).toBe('2026-10-09T02:30:00.000Z');
    expect(istIso(Date.parse('2026-10-09T03:30:00.123Z'))).toBe('2026-10-09T09:00:00+05:30');
  });

  it('adds the three parts, and never goes below zero', () => {
    const fire = { ...offset(SANGRUR, -10, 0), seen_at: hourIso(26), frp_mw: 15 };
    const station: StationResidual = { id: 's', source: 'cpcb', ...SANGRUR, time: hourIso(26), observed: 150, expected: 120, residual: 30 };
    const s = snapshot({ pm25: (_a, _b, h) => 100 + h, u: () => 4, fires: [fire], stations: [station] });
    const series = forecastSeries(s, SANGRUR.lat, SANGRUR.lon, Date.parse('2026-10-09T02:00:00Z'), 6);
    expect(series).toHaveLength(6);
    for (const h of series) expect(h.pm25).toBeCloseTo(h.base + h.bias + h.plume, 9);
    expect(series[0].base).toBeCloseTo(100 + 26.5, 6);
    // The cell's centre is a few hundred metres from the station, so its pull is a hair under full.
    expect(series[0].bias).toBeCloseTo(30 * Math.exp(-0.5 / 6), 1);
    expect(series.some((h) => h.plume > 1)).toBe(true);
    const clean = snapshot({ pm25: () => 10, stations: [{ ...station, residual: -60 }] });
    expect(forecastSeries(clean, SANGRUR.lat, SANGRUR.lon, Date.parse('2026-10-09T02:00:00Z'), 1)[0].pm25).toBe(0);
  });

  it('stops where the grid runs out of hours', () => {
    expect(forecastSeries(snapshot({ hours: 30 }), SANGRUR.lat, SANGRUR.lon, Date.parse('2026-10-09T02:00:00Z'), 24)).toHaveLength(3);
  });

  it('names the parts it used', () => {
    expect(modelName(snapshot())).toBe('open_meteo_cams');
    expect(modelName(snapshot({ fires: [{ ...SANGRUR, seen_at: START, frp_mw: 1 }], stations: [{ id: 's', source: 'cpcb', ...SANGRUR, time: START, observed: 1, expected: 1, residual: 0 }] }))).toBe(
      'open_meteo_cams+station_bias+firms_plume',
    );
  });
});

const spec = JSON.parse(readFileSync(join(__dirname, '../../../packages/contracts/proposals/p3-aqi.openapi.json'), 'utf8'));
type Schema = { $ref?: string; type?: string | string[]; enum?: unknown[]; required?: string[]; properties?: Record<string, Schema>; items?: Schema };

/** Enough of JSON Schema to check an answer against P3's contract. */
function problems(value: unknown, schema: Schema, path = '$'): string[] {
  if (schema.$ref) return problems(value, spec.components.schemas[schema.$ref.split('/').pop()!], path);
  const out: string[] = [];
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  if (types.length && !types.includes(kind) && !(kind === 'integer' && types.includes('number'))) out.push(`${path}: ${kind}, not ${types.join('|')}`);
  if (schema.enum && !schema.enum.includes(value)) out.push(`${path}: ${String(value)} not in ${schema.enum.join(', ')}`);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) out.push(`${path}.${key}: missing`);
    for (const [key, sub] of Object.entries(schema.properties ?? {})) if (key in value) out.push(...problems((value as Record<string, unknown>)[key], sub, `${path}.${key}`));
  }
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => out.push(...problems(v, schema.items!, `${path}[${i}]`)));
  return out;
}

describe('GET /v1/aqi/forecast', () => {
  const now = Date.parse('2026-10-09T02:30:00Z'); // 08:00 in India
  const s = snapshot({ pm25: (_a, _b, h) => 40 + 2 * h });
  const current = async () => s;
  const ask = (q: string, get: () => Promise<ForecastSnapshot | null> = current) => answerForecast(new URL(`http://saans.test/v1/aqi/forecast?${q}`), get, now);

  it("answers 24 hours from 09:00 in the contract's shape", async () => {
    const res = await ask(`lat=${SANGRUR.lat}&lon=${SANGRUR.lon}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(problems(body, spec.components.schemas.ForecastResponse)).toEqual([]);
    expect(body).toMatchObject({ lat: SANGRUR.lat, lon: SANGRUR.lon, generated_at: '2026-10-09T08:00:00+05:30', model: 'open_meteo_cams', model_version: '0.2.0' });
    expect(body.hours).toHaveLength(24);
    expect(body.hours.slice(0, 2).map((h: { time: string }) => h.time)).toEqual(['2026-10-09T09:00:00+05:30', '2026-10-09T10:00:00+05:30']);
    for (const h of body.hours) {
      expect(h.aqi).toBe(subIndex('pm25', h.pm25_ug_m3).value);
      expect(h.category).toBe(getCategoryCode(h.aqi));
    }
    expect(body.hours[0].pm25_ug_m3).toBe(40 + 2 * 27.5);
  });

  it('gives 1 to 72 hours, and 422s anything else', async () => {
    const lens = await Promise.all([1, 72].map(async (h) => (await (await ask(`lat=30.2&lon=75.8&hours=${h}`)).json()).hours.length));
    expect(lens).toEqual([1, 72]);
    for (const bad of ['0', '73', '1.5', 'six', '']) {
      const res = await ask(`lat=30.2&lon=75.8&hours=${bad}`);
      expect(res.status).toBe(422);
      expect((await res.json()).error.details).toEqual([{ field: 'query.hours', problem: 'must be a whole number from 1 to 72' }]);
    }
  });

  it('422s a missing or wrong place, naming every bad field', async () => {
    const missing = await ask('lon=75.8');
    expect(missing.status).toBe(422);
    expect((await missing.json()).error).toMatchObject({ code: 'invalid_request', details: [{ field: 'query.lat', problem: 'required' }] });
    const wrong = await (await ask('lat=abc&lon=200')).json();
    expect(wrong.error.details.map((d: { field: string }) => d.field)).toEqual(['query.lat', 'query.lon']);
  });

  it('404s outside Punjab and the NCR, and 503s with no grid', async () => {
    const mumbai = await ask('lat=19.07&lon=72.87');
    expect([mumbai.status, (await mumbai.json()).error.code]).toEqual([404, 'no_coverage']);
    const none = await ask('lat=30.2&lon=75.8', async () => null);
    const broken = await ask('lat=30.2&lon=75.8', async () => {
      throw new Error('S3 down');
    });
    const ended = await ask('lat=30.2&lon=75.8', async () => snapshot({ hours: 20 }));
    expect([none.status, broken.status, ended.status]).toEqual([503, 503, 503]);
    expect((await none.json()).error.code).toBe('sources_unavailable');
  });
});

describe('which grid is answered from', () => {
  const at = (iso: string) => snapshot({ generatedAt: iso });
  const clock = (iso: string) => () => Date.parse(iso);

  it('uses a fresh grid from memory, then the store, and builds only when neither is fresh', async () => {
    const stored = at('2026-10-09T01:00:00Z');
    const store = memoryStore(stored);
    const build = vi.fn(async () => at('2026-10-09T05:00:00Z'));
    const svc = forecastService({ store, build, now: clock('2026-10-09T05:00:00Z') });
    expect(await svc.current()).toBe(stored);
    expect(build).not.toHaveBeenCalled();

    const later = forecastService({ store, build, now: clock('2026-10-09T08:00:00Z') });
    const built = await later.current();
    expect(built?.generated_at).toBe('2026-10-09T05:00:00Z');
    expect(store.saved).toEqual([built]);
  });

  it('builds once for many requests at the same time', async () => {
    const build = vi.fn(async () => at('2026-10-09T05:00:00Z'));
    const svc = forecastService({ store: memoryStore(), build, now: clock('2026-10-09T05:00:00Z') });
    const all = await Promise.all([svc.current(), svc.current(), svc.current()]);
    expect(build).toHaveBeenCalledTimes(1);
    expect(new Set(all).size).toBe(1);
  });

  it('falls back to an old grid under 24 hours when a build fails, and to nothing after that', async () => {
    const build = vi.fn(async () => {
      throw new Error('Open-Meteo down');
    });
    const old = at('2026-10-08T20:00:00Z');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await forecastService({ store: memoryStore(old), build, now: clock('2026-10-09T06:00:00Z') }).current()).toBe(old);
    expect(await forecastService({ store: memoryStore(old), build, now: clock('2026-10-09T21:00:00Z') }).current()).toBeNull();
    warn.mockRestore();
  });

  it('the ingest rebuilds the stored grid once it is 3 hours old', async () => {
    const store = memoryStore(at('2026-10-09T03:00:00Z'));
    const build = vi.fn(async () => at('2026-10-09T06:00:00Z'));
    expect(await refreshForecast({ store, build, now: clock('2026-10-09T05:59:00Z') })).toBe('fresh');
    expect(await refreshForecast({ store, build, now: clock('2026-10-09T06:00:00Z') })).toBe('built');
    expect(store.saved).toHaveLength(1);
  });
});

describe('building a grid', () => {
  const now = () => Date.parse('2026-10-08T02:10:00Z');

  /** Open-Meteo for every anchor, plus stations; CPCB can be made to fail. */
  function upstream(cpcbFails = false) {
    const om = openMeteo([], 3);
    return vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('open-meteo')) return om(input, init);
      if (url.includes('data.gov.in')) {
        if (cpcbFails) return new Response('down', { status: 500 });
        return new Response(JSON.stringify({ records: [{ station: 'Sangrur', latitude: String(SANGRUR.lat), longitude: String(SANGRUR.lon), last_update: '08-10-2026 07:30:00', avg_value: '400' }] }));
      }
      if (url.includes('openaq')) return new Response(JSON.stringify({ results: [] }));
      throw new Error(`unexpected ${url}`);
    }) as unknown as typeof fetch;
  }

  it('fetches everything and works out each station residual', async () => {
    const s = await buildSnapshot({ fetch: upstream(), now, keys: { cpcb: 'k', openaq: 'k', firms: 'k' }, fires: async () => [] });
    expect(s.sources).toEqual({ open_meteo: 'ok', cpcb: 'ok', openaq: 'ok', firms: 'ok' });
    expect([s.hours, s.start, s.anchors.length]).toEqual([3, '2026-10-08T00:00:00.000Z', anchorsFor().length]);
    expect(s.stations).toHaveLength(1);
    expect(s.stations[0]).toMatchObject({ id: 'cpcb-Sangrur', time: '2026-10-08T02:00:00.000Z', observed: 400 });
    expect(s.stations[0].residual).toBeCloseTo(400 - s.stations[0].expected, 1);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('builds without keys, and when a station source fails; it needs Open-Meteo', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bare = await buildSnapshot({ fetch: upstream(), now, keys: {} });
    expect(bare.sources).toEqual({ open_meteo: 'ok', cpcb: 'no_key', openaq: 'no_key', firms: 'no_key' });
    const failing = await buildSnapshot({ fetch: upstream(true), now, keys: { cpcb: 'k' } });
    expect([failing.sources.cpcb, failing.stations]).toEqual(['failed', []]);
    const down = vi.fn(async () => new Response('', { status: 502 })) as unknown as typeof fetch;
    await expect(buildSnapshot({ fetch: down, now, keys: {} })).rejects.toThrow('Open-Meteo answered 502');
    warn.mockRestore();
  });
});
