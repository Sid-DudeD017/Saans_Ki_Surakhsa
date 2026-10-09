// Saans Shala's reads, in the contract's shapes: P3's AQI and fires, and P2's own advisory. With
// NEXT_PUBLIC_USE_MOCKS on (the default) they come from the AQI fixtures, through the same rules and
// advisory builder the real GET /v1/schools/{id}/advisory uses.
import type { components } from '../../../packages/contracts/types';
import type { AqiResponse, Category } from './airQuality';
import { buildAdvisory, findSchool, type SchoolAdvisory } from './advisory';
import { AQI_FIXTURES } from './aqiFixtures';
import { DEMO_FIRES } from './redZoneFixtures';

export type FirePoint = components['schemas']['FirePoint'];
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? res.statusText);
  return body as T;
}

export function getAir(lat: number, lon: number, mockDay: Category): Promise<AqiResponse> {
  if (USE_MOCKS) return Promise.resolve(AQI_FIXTURES[mockDay]);
  return get(`/v1/aqi?lat=${lat}&lon=${lon}`);
}

export function getAdvisory(schoolId: string, mockDay: Category): Promise<SchoolAdvisory> {
  if (USE_MOCKS) {
    const school = findSchool(schoolId);
    if (!school) return Promise.reject(new Error(`no school ${schoolId}`));
    return Promise.resolve(buildAdvisory(school, AQI_FIXTURES[mockDay]));
  }
  return get(`/v1/schools/${encodeURIComponent(schoolId)}/advisory`);
}

export async function getFires(lat: number, lon: number, radiusKm: number): Promise<FirePoint[]> {
  if (USE_MOCKS) return DEMO_FIRES;
  return (await get<{ fires: FirePoint[] }>(`/v1/fires?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`)).fires;
}
