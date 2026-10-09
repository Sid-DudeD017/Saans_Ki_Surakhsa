// What the forecast grid is built from (P3): Open-Meteo's hourly PM2.5, wind and mixing height at every
// anchor (no key), live PM2.5 from CPCB (data.gov.in) and OpenAQ v3, and FIRMS fires.
import { fetchFires } from '../fires';
import type { Observation } from './bias';
import { ANCHORS_PER_REQUEST, PLUME, REGIONS } from './config';
import { inCoverage, type Fire } from './grid';

export type Fetch = typeof fetch;

export interface AnchorSeries {
  /** UTC ISO per hour; the same for every anchor. */
  times: string[];
  pm25: (number | null)[][];
  wind_u: (number | null)[][];
  wind_v: (number | null)[][];
  mixing_m: (number | null)[][];
}

const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
// One day back (to compare with stations and start the plume), five ahead (72 h even from a 6-hour-old grid).
const RANGE = 'past_days=1&forecast_days=5&timezone=GMT';

interface OpenMeteoHourly {
  hourly?: { time?: string[] } & Record<string, (number | null)[] | string[] | undefined>;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function openMeteo(fetcher: Fetch, base: string, hourly: string, points: { lat: number; lon: number }[]) {
  const lat = points.map((p) => p.lat.toFixed(2)).join(',');
  const lon = points.map((p) => p.lon.toFixed(2)).join(',');
  const res = await fetcher(`${base}?latitude=${lat}&longitude=${lon}&hourly=${hourly}&${RANGE}`);
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
  const body = (await res.json()) as OpenMeteoHourly | OpenMeteoHourly[];
  // One location comes back as an object, several as a list.
  const list = Array.isArray(body) ? body : [body];
  if (list.length !== points.length) throw new Error(`Open-Meteo sent ${list.length} locations for ${points.length}`);
  return list;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

/** Hourly PM2.5, wind (as east/north m/s) and mixing height at each anchor. */
export async function fetchAnchorSeries(fetcher: Fetch, points: { lat: number; lon: number }[]): Promise<AnchorSeries> {
  const groups = chunks(points, ANCHORS_PER_REQUEST);
  const [air, weather] = await Promise.all([
    Promise.all(groups.map((g) => openMeteo(fetcher, AIR_URL, 'pm2_5', g))),
    Promise.all(groups.map((g) => openMeteo(fetcher, WEATHER_URL, 'wind_speed_10m,wind_direction_10m,boundary_layer_height', g))),
  ]);
  const airList = air.flat();
  const weatherList = weather.flat();
  const times = airList[0]?.hourly?.time;
  if (!times?.length) throw new Error('Open-Meteo sent no hours');

  const series: AnchorSeries = { times: times.map((t) => new Date(`${t}:00Z`).toISOString()), pm25: [], wind_u: [], wind_v: [], mixing_m: [] };
  // Line every location up by its own time list, in case one is shorter.
  const align = (h: OpenMeteoHourly['hourly'], key: string) => {
    const at = new Map((h?.time ?? []).map((t, i) => [t, i]));
    const values = (h?.[key] ?? []) as unknown[];
    return times.map((t) => {
      const i = at.get(t);
      return i === undefined ? null : num(values[i]);
    });
  };
  points.forEach((_, k) => {
    series.pm25.push(align(airList[k].hourly, 'pm2_5').map(round2));
    const speed = align(weatherList[k].hourly, 'wind_speed_10m');
    const from = align(weatherList[k].hourly, 'wind_direction_10m');
    // Wind blows from `from`, so the air moves the other way: u = −s·sin θ, v = −s·cos θ (km/h → m/s).
    series.wind_u.push(speed.map((s, i) => (s === null || from[i] === null ? null : round2((-s / 3.6) * Math.sin((from[i]! * Math.PI) / 180)))));
    series.wind_v.push(speed.map((s, i) => (s === null || from[i] === null ? null : round2((-s / 3.6) * Math.cos((from[i]! * Math.PI) / 180)))));
    series.mixing_m.push(align(weatherList[k].hourly, 'boundary_layer_height').map(round2));
  });
  return series;
}

const CPCB_URL = 'https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69';

/** data.gov.in writes "09-10-2026 10:00:00" in India time. */
export function cpcbTime(s: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(s?.trim() ?? '');
  if (!m) return null;
  const [, d, mo, y, h, mi, se] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, se) - 5.5 * 3_600_000).toISOString();
}

interface CpcbRecord {
  station?: string;
  latitude?: string;
  longitude?: string;
  last_update?: string;
  avg_value?: string;
  pollutant_avg?: string;
}

/** CPCB's live PM2.5 across India, kept where we forecast. */
export async function fetchCpcb(fetcher: Fetch, apiKey: string): Promise<Observation[]> {
  const out: Observation[] = [];
  const limit = 1000;
  for (let offset = 0; offset < 5 * limit; offset += limit) {
    const url = `${CPCB_URL}?api-key=${encodeURIComponent(apiKey)}&format=json&limit=${limit}&offset=${offset}&filters%5Bpollutant_id%5D=PM2.5`;
    const res = await fetcher(url);
    if (!res.ok) throw new Error(`data.gov.in answered ${res.status}`);
    const records = ((await res.json()) as { records?: CpcbRecord[] }).records ?? [];
    for (const r of records) {
      const lat = Number(r.latitude);
      const lon = Number(r.longitude);
      // The field was pollutant_avg and is now avg_value; take either.
      const pm25 = Number(r.avg_value ?? r.pollutant_avg);
      const time = cpcbTime(r.last_update ?? '');
      if (!r.station || !time || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(pm25)) continue;
      if (inCoverage(lat, lon)) out.push({ id: `cpcb-${r.station}`, source: 'cpcb', lat, lon, time, pm25 });
    }
    if (records.length < limit) break;
  }
  return out;
}

interface OpenAqLatest {
  datetime?: { utc?: string };
  value?: number;
  coordinates?: { latitude?: number; longitude?: number };
  locationsId?: number;
}

/** OpenAQ v3's latest PM2.5 (parameter 2, µg/m³) from the last 3 hours. The endpoint has no area filter. */
export async function fetchOpenAq(fetcher: Fetch, apiKey: string, nowMs: number): Promise<Observation[]> {
  const out: Observation[] = [];
  const limit = 1000;
  const since = new Date(nowMs - 3 * 3_600_000).toISOString();
  for (let page = 1; page <= 10; page++) {
    const res = await fetcher(`https://api.openaq.org/v3/parameters/2/latest?limit=${limit}&page=${page}&datetime_min=${encodeURIComponent(since)}`, {
      headers: { 'X-API-Key': apiKey },
    });
    if (!res.ok) throw new Error(`OpenAQ answered ${res.status}`);
    const results = ((await res.json()) as { results?: OpenAqLatest[] }).results ?? [];
    for (const r of results) {
      const lat = r.coordinates?.latitude;
      const lon = r.coordinates?.longitude;
      const time = r.datetime?.utc;
      if (typeof lat !== 'number' || typeof lon !== 'number' || typeof r.value !== 'number' || !time || r.locationsId === undefined) continue;
      if (inCoverage(lat, lon)) out.push({ id: `openaq-${r.locationsId}`, source: 'openaq', lat, lon, time: new Date(time).toISOString(), pm25: r.value });
    }
    if (results.length < limit) break;
  }
  return out;
}

/** The box around both regions, as FIRMS wants it: west,south,east,north. */
export const FIRMS_BBOX = [
  Math.min(...REGIONS.map((r) => r.minLon)),
  Math.min(...REGIONS.map((r) => r.minLat)),
  Math.max(...REGIONS.map((r) => r.maxLon)),
  Math.max(...REGIONS.map((r) => r.maxLat)),
].join(',');

/** FIRMS VIIRS fires from the last day, in the regions, at nominal or high confidence. */
export async function fetchRegionFires(mapKey: string, get = fetchFires): Promise<Fire[]> {
  const fires = await get(FIRMS_BBOX, mapKey);
  return fires
    .filter((f) => (PLUME.minConfidence as readonly string[]).includes(String(f.confidence).toLowerCase()))
    .filter((f) => Number.isFinite(f.frp) && f.frp > 0 && inCoverage(f.lat, f.lon))
    .map((f) => ({ lat: f.lat, lon: f.lon, seen_at: new Date(f.acquisition_time).toISOString(), frp_mw: f.frp }));
}
