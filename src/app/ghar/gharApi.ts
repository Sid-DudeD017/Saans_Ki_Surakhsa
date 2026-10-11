// Ghar ki Hawa's reads (P3). With NEXT_PUBLIC_USE_MOCKS on (the default) the estimate runs in the browser,
// through the same model POST /v1/indoor/estimate uses, on an example day's hour-by-hour shape scaled to the
// live PM2.5 at the home (so "outside now" matches the station); off, it asks the API.
import { estimateIndoor, type IndoorEstimate, type IndoorRequest, type OutdoorAt } from '../../../packages/aqi/indoor';
import { EXAMPLE_OUTDOOR } from './sharma';

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';
const BASE = '';

/** The station's reading at the home: overall AQI, and PM2.5 when the station reports it. */
export interface LiveAir {
  aqi: number;
  category: string;
  /** PM2.5 in µg/m³, or null when the station doesn't report it. */
  pm25: number | null;
  dominant: string | null;
  station: string | null;
}

export async function getLiveAir(lat: number, lon: number): Promise<LiveAir | null> {
  try {
    const res = await fetch(`${BASE}/v1/aqi?lat=${lat}&lon=${lon}`);
    if (!res.ok) return null;
    const d = await res.json();
    if (typeof d?.aqi !== 'number') return null;
    const pm25 = d.sub_indices?.pm25?.concentration;
    return { aqi: d.aqi, category: d.category ?? '', pm25: typeof pm25 === 'number' ? pm25 : null, dominant: d.dominant_pollutant ?? null, station: d.station_name ?? null };
  } catch {
    return null;
  }
}

/** The example day's hourly shape, scaled so that now matches the live PM2.5. */
export function anchoredOutdoor(pm25Now: number, now: number): OutdoorAt {
  const scale = pm25Now / (EXAMPLE_OUTDOOR(now) || pm25Now);
  return (ms) => {
    const v = EXAMPLE_OUTDOOR(ms);
    return v === null ? null : v * scale;
  };
}

export async function getIndoorEstimate(room: IndoorRequest, livePm25?: number | null): Promise<IndoorEstimate> {
  if (USE_MOCKS) {
    const now = Date.now();
    return estimateIndoor(room, livePm25 ? anchoredOutdoor(livePm25, now) : EXAMPLE_OUTDOOR, now);
  }
  const res = await fetch(`${BASE}/v1/indoor/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(room),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error?.message ?? res.statusText);
    (err as any).code = body?.error?.code;
    throw err;
  }
  return body as IndoorEstimate;
}
