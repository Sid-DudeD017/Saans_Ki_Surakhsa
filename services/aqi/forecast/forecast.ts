// Ĉ = forecast + station_bias·e^(−lead/6 h) + smoke_plume (P3), for one 1 km cell, hour by hour in India time.
import { biasAt, liveObservations, stationResiduals, type Observation } from './bias';
import { ANCHOR_STEP_DEG, MODEL } from './config';
import { Grid, anchorsFor, cellOf, hoursSince, type ForecastSnapshot, type SourceState } from './grid';
import { Plume } from './plume';
import { fetchAnchorSeries, fetchCpcb, fetchOpenAq, fetchRegionFires, type Fetch } from './sources';
import type { fetchFires } from '../fires';

const HOUR_MS = 3_600_000;
const IST_MS = 5.5 * HOUR_MS;

/** The same instant written with India's offset, to the second. */
export function istIso(ms: number): string {
  return new Date(Math.round(ms / 1000) * 1000 + IST_MS).toISOString().replace(/\.\d{3}Z$/, '+05:30');
}

/** The first whole hour in India time after `ms`. (India is UTC+5:30, so these fall on UTC half-hours.) */
export function nextIstHour(ms: number): number {
  return (Math.floor((ms + IST_MS) / HOUR_MS) + 1) * HOUR_MS - IST_MS;
}

const models = new WeakMap<ForecastSnapshot, { grid: Grid; plume: Plume }>();

/** The grid and plume for a snapshot, worked out once. */
export function modelFor(snapshot: ForecastSnapshot) {
  let m = models.get(snapshot);
  if (!m) {
    const grid = new Grid(snapshot);
    m = { grid, plume: new Plume(grid, snapshot.fires) };
    models.set(snapshot, m);
  }
  return m;
}

export function modelName(snapshot: ForecastSnapshot): string {
  return [MODEL, ...(snapshot.stations.length ? ['station_bias'] : []), ...(snapshot.fires.length ? ['firms_plume'] : [])].join('+');
}

export interface HourForecast {
  /** UTC ms. */
  at: number;
  pm25: number;
  base: number;
  bias: number;
  plume: number;
}

/**
 * Up to `hours` hourly values for the 1 km cell around a point, from the first India-time hour after `fromMs`.
 * Stops early if the snapshot runs out of hours.
 */
export function forecastSeries(snapshot: ForecastSnapshot, lat: number, lon: number, fromMs: number, hours: number): HourForecast[] {
  const { grid, plume } = modelFor(snapshot);
  const cell = cellOf(lat, lon);
  const first = nextIstHour(fromMs);
  const out: HourForecast[] = [];
  for (let i = 0; i < hours; i++) {
    const at = first + i * HOUR_MS;
    const t = hoursSince(snapshot.start, at);
    const base = grid.value('pm25', cell.lat, cell.lon, t);
    if (base === null) break;
    const bias = biasAt(snapshot.stations, snapshot.start, cell.lat, cell.lon, t);
    const smoke = plume.at(cell.lat, cell.lon, t);
    out.push({ at, base, bias, plume: smoke, pm25: Math.max(0, base + bias + smoke) });
  }
  return out;
}

export interface BuildDeps {
  fetch: Fetch;
  now: () => number;
  keys: { cpcb?: string; openaq?: string; firms?: string };
  fires?: typeof fetchFires;
}

async function optional<T>(key: string | undefined, get: (key: string) => Promise<T[]>): Promise<[T[], SourceState]> {
  if (!key) return [[], 'no_key'];
  try {
    return [await get(key), 'ok'];
  } catch (e) {
    console.warn('Forecast source failed:', e instanceof Error ? e.message : e);
    return [[], 'failed'];
  }
}

/** Fetch everything and build a snapshot. Open-Meteo is required; stations and fires are used when they answer. */
export async function buildSnapshot(deps: BuildDeps): Promise<ForecastSnapshot> {
  const now = deps.now();
  const anchors = anchorsFor();
  const points = anchors.map(([r, c]) => ({ lat: r * ANCHOR_STEP_DEG, lon: c * ANCHOR_STEP_DEG }));
  const [series, [fires, firms], [cpcb, cpcbState], [openaq, openaqState]] = await Promise.all([
    fetchAnchorSeries(deps.fetch, points),
    optional(deps.keys.firms, (k) => fetchRegionFires(k, deps.fires)),
    optional<Observation>(deps.keys.cpcb, (k) => fetchCpcb(deps.fetch, k)),
    optional<Observation>(deps.keys.openaq, (k) => fetchOpenAq(deps.fetch, k, now)),
  ]);
  const snapshot: ForecastSnapshot = {
    version: 1,
    generated_at: new Date(now).toISOString(),
    start: series.times[0],
    hours: series.times.length,
    step_deg: ANCHOR_STEP_DEG,
    anchors,
    pm25: series.pm25,
    wind_u: series.wind_u,
    wind_v: series.wind_v,
    mixing_m: series.mixing_m,
    fires,
    stations: [],
    sources: { open_meteo: 'ok', cpcb: cpcbState, openaq: openaqState, firms },
  };
  const { grid, plume } = modelFor(snapshot);
  snapshot.stations = stationResiduals(grid, plume, liveObservations([...cpcb, ...openaq], now));
  return snapshot;
}
