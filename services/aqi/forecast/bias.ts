// Station bias (P3): where a live monitor disagrees with the forecast, move nearby cells by the same amount,
// fading with distance (exp(−d²/2L²), L = 15 km) and with lead time (e^(−lead/6 h)). The forecast a station
// is compared with already includes the smoke plume, so smoke the station sees isn't counted twice.
import { BIAS } from './config';
import { Grid, KM_PER_DEG, hoursSince, inCoverage, type StationResidual } from './grid';
import type { Plume } from './plume';

export interface Observation {
  id: string;
  source: 'cpcb' | 'openaq';
  lat: number;
  lon: number;
  /** UTC ISO. */
  time: string;
  pm25: number;
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dy = (a.lat - b.lat) * KM_PER_DEG;
  const dx = (a.lon - b.lon) * KM_PER_DEG * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/**
 * Readings worth trusting now: in the regions, sane, under 3 hours old, the newest per station, and one per
 * monitor (OpenAQ republishes CPCB monitors; we keep OpenAQ's hourly reading over CPCB's average).
 */
export function liveObservations(all: Observation[], nowMs: number): Observation[] {
  const newest = new Map<string, Observation>();
  for (const o of all) {
    const at = Date.parse(o.time);
    if (!Number.isFinite(o.pm25) || o.pm25 < BIAS.minUgM3 || o.pm25 > BIAS.maxUgM3) continue;
    if (!Number.isFinite(at) || at > nowMs + 600_000 || nowMs - at > BIAS.maxAgeHours * 3_600_000) continue;
    if (!inCoverage(o.lat, o.lon)) continue;
    const prev = newest.get(o.id);
    if (!prev || Date.parse(prev.time) < at) newest.set(o.id, o);
  }
  const live = [...newest.values()];
  const openaq = live.filter((o) => o.source === 'openaq');
  return live.filter((o) => o.source === 'openaq' || !openaq.some((q) => km(o, q) <= BIAS.sameStationKm));
}

/** Each station's reading minus what the forecast and plume said for its place and hour. */
export function stationResiduals(grid: Grid, plume: Plume, observations: Observation[]): StationResidual[] {
  const out: StationResidual[] = [];
  for (const o of observations) {
    const hour = Math.round(hoursSince(grid.snapshot.start, o.time));
    const base = grid.value('pm25', o.lat, o.lon, hour);
    if (base === null) continue;
    const expected = base + plume.at(o.lat, o.lon, hour);
    out.push({
      id: o.id,
      source: o.source,
      lat: o.lat,
      lon: o.lon,
      time: new Date(Date.parse(grid.snapshot.start) + hour * 3_600_000).toISOString(),
      observed: o.pm25,
      expected: Math.round(expected * 10) / 10,
      residual: Math.round((o.pm25 - expected) * 10) / 10,
    });
  }
  return out;
}

/**
 * The correction at a point, t hours after the snapshot's hour 0. A weighted mean of the residuals, but the
 * weights are never divided by less than 1, so a lone station's pull fades to nothing away from it.
 */
export function biasAt(stations: StationResidual[], start: string, lat: number, lon: number, t: number): number {
  let sum = 0;
  let weight = 0;
  const L = BIAS.lengthKm;
  for (const s of stations) {
    const d = km(s, { lat, lon });
    if (d > 3 * L) continue;
    const w = Math.exp(-(d * d) / (2 * L * L));
    const lead = Math.max(0, t - hoursSince(start, s.time));
    sum += w * s.residual * Math.exp(-lead / BIAS.fadeHours);
    weight += w;
  }
  return sum / Math.max(weight, 1);
}
