// Ghar ki Hawa's reads (P3). With NEXT_PUBLIC_USE_MOCKS on (the default) the estimate runs in the browser on an
// example outdoor day, through the same model POST /v1/indoor/estimate uses; off, it asks the API.
import { estimateIndoor, type IndoorEstimate, type IndoorRequest } from '../../../packages/aqi/indoor';
import { EXAMPLE_OUTDOOR } from './sharma';

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';
const BASE = '';

export async function getIndoorEstimate(room: IndoorRequest): Promise<IndoorEstimate> {
  if (USE_MOCKS) return estimateIndoor(room, EXAMPLE_OUTDOOR, Date.now());
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
