// The forecast grid (P3): an Open-Meteo lattice every 0.25°, read as 1 km cells by interpolating in space
// (bilinear) and time (linear). Everything here is pure; build.ts fills a snapshot, store.ts keeps it.
import { ANCHOR_STEP_DEG, CELL_KM, CELL_LAT0, REGIONS } from './config';

export const KM_PER_DEG = (6371 * Math.PI) / 180;
const HOUR_MS = 3_600_000;

export type SourceState = 'ok' | 'no_key' | 'failed';

export interface Fire {
  lat: number;
  lon: number;
  /** When VIIRS saw it, UTC ISO. */
  seen_at: string;
  frp_mw: number;
}

export interface StationResidual {
  id: string;
  source: 'cpcb' | 'openaq';
  lat: number;
  lon: number;
  /** The reading's hour, UTC ISO. */
  time: string;
  observed: number;
  /** Open-Meteo plus the smoke plume at that place and hour. */
  expected: number;
  residual: number;
}

/** What the ingest stores and the API reads: hourly fields per anchor, plus the fires and station readings. */
export interface ForecastSnapshot {
  version: 1;
  generated_at: string;
  /** Hour 0 of every series, UTC ISO. */
  start: string;
  hours: number;
  step_deg: number;
  /** [row, col] on the lattice, so lat = row·step and lon = col·step. */
  anchors: [number, number][];
  /** Per anchor, per hour. null where Open-Meteo had no value. */
  pm25: (number | null)[][];
  /** Wind toward the east and the north, m/s (smoke moves this way). */
  wind_u: (number | null)[][];
  wind_v: (number | null)[][];
  mixing_m: (number | null)[][];
  fires: Fire[];
  stations: StationResidual[];
  sources: { open_meteo: 'ok'; cpcb: SourceState; openaq: SourceState; firms: SourceState };
}

export type Field = 'pm25' | 'wind_u' | 'wind_v' | 'mixing_m';

export function inCoverage(lat: number, lon: number): boolean {
  return REGIONS.some((r) => lat >= r.minLat && lat <= r.maxLat && lon >= r.minLon && lon <= r.maxLon);
}

/** Lattice points covering every region, so each covered point has its four corners. */
export function anchorsFor(step = ANCHOR_STEP_DEG): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const r of REGIONS) {
    for (let row = Math.floor(r.minLat / step); row <= Math.ceil(r.maxLat / step); row++) {
      for (let col = Math.floor(r.minLon / step); col <= Math.ceil(r.maxLon / step); col++) {
        const key = `${row},${col}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push([row, col]);
        }
      }
    }
  }
  return out;
}

/** The 1 km cell a point falls in, and its centre. */
export function cellOf(lat: number, lon: number) {
  const kmLon = KM_PER_DEG * Math.cos((CELL_LAT0 * Math.PI) / 180);
  const row = Math.floor((lat * KM_PER_DEG) / CELL_KM);
  const col = Math.floor((lon * kmLon) / CELL_KM);
  return { row, col, lat: ((row + 0.5) * CELL_KM) / KM_PER_DEG, lon: ((col + 0.5) * CELL_KM) / kmLon };
}

export function isoHour(startIso: string, hour: number): string {
  return new Date(Date.parse(startIso) + hour * HOUR_MS).toISOString();
}

/** Hours since the snapshot's hour 0, fractional. */
export function hoursSince(startIso: string, at: number | string): number {
  return ((typeof at === 'number' ? at : Date.parse(at)) - Date.parse(startIso)) / HOUR_MS;
}

/** Reads a snapshot's fields at any point and time inside it. */
export class Grid {
  private readonly index = new Map<string, number>();

  constructor(readonly snapshot: ForecastSnapshot) {
    snapshot.anchors.forEach(([r, c], k) => this.index.set(`${r},${c}`, k));
  }

  private atAnchor(field: Field, row: number, col: number, hour: number): number | null {
    const k = this.index.get(`${row},${col}`);
    if (k === undefined) return null;
    const v = this.snapshot[field][k]?.[hour];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }

  /** Bilinear between the four corners; a missing corner is left out and the rest re-weighted. */
  private atHour(field: Field, lat: number, lon: number, hour: number): number | null {
    const step = this.snapshot.step_deg;
    const y = lat / step;
    const x = lon / step;
    const r0 = Math.floor(y);
    const c0 = Math.floor(x);
    const fy = y - r0;
    const fx = x - c0;
    let sum = 0;
    let weight = 0;
    for (const [dr, dc, w] of [
      [0, 0, (1 - fy) * (1 - fx)],
      [0, 1, (1 - fy) * fx],
      [1, 0, fy * (1 - fx)],
      [1, 1, fy * fx],
    ] as const) {
      if (w === 0) continue;
      const v = this.atAnchor(field, r0 + dr, c0 + dc, hour);
      if (v === null) continue;
      sum += v * w;
      weight += w;
    }
    return weight > 0 ? sum / weight : null;
  }

  /** A field at a point, t hours after hour 0 (linear between hours). null outside the grid or its hours. */
  value(field: Field, lat: number, lon: number, t: number): number | null {
    if (t < 0 || t > this.snapshot.hours - 1) return null;
    const h0 = Math.floor(t);
    const f = t - h0;
    const a = this.atHour(field, lat, lon, h0);
    if (f === 0 || h0 + 1 >= this.snapshot.hours) return a;
    const b = this.atHour(field, lat, lon, h0 + 1);
    if (a === null) return b;
    if (b === null) return a;
    return a + (b - a) * f;
  }
}
