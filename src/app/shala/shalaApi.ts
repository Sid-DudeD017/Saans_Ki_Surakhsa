// Saans Shala's reads, in the contract's shapes: P3's AQI and fires, and P2's own advisory. With
// NEXT_PUBLIC_USE_MOCKS on (the default) they come from the AQI fixtures, through the same rules and
// advisory builder the real GET /v1/schools/{id}/advisory uses.
import type { components } from '../../../packages/contracts/types';
import type { AqiResponse, Category } from './airQuality';
import { buildAdvisory, findSchool, type SchoolAdvisory } from './advisory';
import { AQI_FIXTURES } from './aqiFixtures';
import { DEMO_FIRES } from './redZoneFixtures';
import { FORECAST_FIXTURES, getDynamicForecastFixture, isForecastCovered } from './forecastFixtures';

export type FirePoint = components['schemas']['FirePoint'];
export type ForecastResponse = components['schemas']['ForecastResponse'];
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';
const BASE = '';

export class ShalaApiError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ShalaApiError';
    this.status = status;
    this.code = code;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ShalaApiError(body?.error?.message ?? res.statusText, res.status, body?.error?.code);
  return body as T;
}

import { findNearestStation } from '../../lib/stations';

export const IST_OFFSET_MS = 330 * 60 * 1000;

export function toIstIsoString(dateOrMs: Date | number = Date.now()): string {
  const ms = typeof dateOrMs === 'number' ? dateOrMs : dateOrMs.getTime();
  const istDate = new Date(ms + IST_OFFSET_MS);
  const yyyy = istDate.getUTCFullYear();
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getUTCDate()).padStart(2, '0');
  const hh = String(istDate.getUTCHours()).padStart(2, '0');
  const min = String(istDate.getUTCMinutes()).padStart(2, '0');
  const sec = String(istDate.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}+05:30`;
}

export async function getAir(lat: number, lon: number, mockDay: Category): Promise<AqiResponse> {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLon = Math.round(lon * 1000) / 1000;
  const nearest = findNearestStation(roundedLat, roundedLon);

  // In browser, attempt live /v1/aqi endpoint first
  if (typeof window !== 'undefined') {
    try {
      const live = await get<AqiResponse>(`/v1/aqi?lat=${roundedLat}&lon=${roundedLon}`);
      if (live && typeof live.aqi === 'number') {
        return {
          ...live,
          station_name: live.station_name || nearest.station.name,
          city: live.city || nearest.station.city,
          distance_km: live.distance_km !== undefined ? live.distance_km : nearest.distanceKm,
        };
      }
    } catch {
      // Live API unreachable: fall back to mock fixture
    }
  }

  if (USE_MOCKS) {
    const fixture = AQI_FIXTURES[mockDay];
    // Dynamic fresh timestamp (recorded within the last 15 minutes in IST)
    const recordedTime = Date.now() - 15 * 60 * 1000; // 15 mins ago
    const isoTimestamp = toIstIsoString(recordedTime);

    return {
      ...fixture,
      data_timestamp: isoTimestamp,
      stale: false,
      station_name: nearest.station.name,
      city: nearest.station.city,
      distance_km: nearest.distanceKm,
      station_count: fixture.station_count || 3,
    };
  }
  const live = await get<AqiResponse>(`/v1/aqi?lat=${roundedLat}&lon=${roundedLon}`);
  return {
    ...live,
    station_name: live.station_name || nearest.station.name,
    city: live.city || nearest.station.city,
    distance_km: live.distance_km !== undefined ? live.distance_km : nearest.distanceKm,
  };
}

export function getAdvisory(schoolId: string, mockDay: Category): Promise<SchoolAdvisory> {
  if (USE_MOCKS) {
    const school = findSchool(schoolId);
    if (!school) return Promise.reject(new Error(`no school ${schoolId}`));
    const recordedTime = Date.now() - 15 * 60 * 1000;
    const fixture = {
      ...AQI_FIXTURES[mockDay],
      data_timestamp: toIstIsoString(recordedTime),
      stale: false,
    };
    return Promise.resolve(buildAdvisory(school, fixture));
  }
  return get(`/v1/schools/${encodeURIComponent(schoolId)}/advisory`);
}

export async function getFires(lat: number, lon: number, radiusKm = 25): Promise<FirePoint[]> {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLon = Math.round(lon * 1000) / 1000;
  if (USE_MOCKS) return DEMO_FIRES;
  return (await get<{ fires: FirePoint[] }>(`/v1/fires?lat=${roundedLat}&lon=${roundedLon}&radius_km=${radiusKm}`)).fires;
}

export async function getForecast(
  lat: number,
  lon: number,
  hours = 24,
  mockDay: Category = 'poor'
): Promise<ForecastResponse> {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLon = Math.round(lon * 1000) / 1000;
  if (USE_MOCKS) {
    if (!isForecastCovered(roundedLat, roundedLon)) {
      throw new ShalaApiError('Forecast data is not available for the requested coordinates.', 404, 'no_coverage');
    }
    const dynamicFixture = getDynamicForecastFixture(mockDay);
    return {
      ...dynamicFixture,
      lat: roundedLat,
      lon: roundedLon,
      hours: dynamicFixture.hours.slice(0, hours),
    };
  }
  const res = await fetch(`${BASE}/v1/aqi/forecast?lat=${roundedLat}&lon=${roundedLon}&hours=${hours}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ShalaApiError(body?.error?.message ?? res.statusText, res.status, body?.error?.code);
  }
  return body as ForecastResponse;
}

