// The HTTP side of GET /v1/schools/{id}/advisory (P2), apart from the route file so tests can give it
// their own AQI source. The route reads P3's AQI the same way GET /v1/aqi does.
import { getAqiForLocation, updateDataForLocation } from '../../../services/aqi/index';
import type { AqiResponse } from './airQuality';
import { buildAdvisory, findSchool } from './advisory';

export const ROLES = ['student', 'parent', 'teacher', 'principal', 'citizen', 'official'] as const;

/** P3's reading for a point, or null when its sources have nothing. */
export type AirSource = (lat: number, lon: number) => Promise<AqiResponse | null>;

export const p3Air: AirSource = async (lat, lon) => {
  const { allFailed } = await updateDataForLocation(lat, lon, { openaq: process.env.OPENAQ_API_KEY, cpcb: process.env.CPCB_API_KEY });
  if (allFailed) return null;
  return (await getAqiForLocation(lat, lon)) as AqiResponse | null;
};

function error(status: number, code: string, message: string, details?: { field: string; problem: string }[]) {
  return Response.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export async function answerAdvisory(id: string, url: URL, air: AirSource = p3Air, now = new Date()): Promise<Response> {
  const role = url.searchParams.get('role');
  if (role !== null && !(ROLES as readonly string[]).includes(role)) {
    return error(422, 'invalid_request', 'role must be one of the listed roles', [{ field: 'query.role', problem: `must be one of ${ROLES.join(', ')}` }]);
  }
  const school = findSchool(id);
  if (!school) return error(404, 'not_found', `School with id '${id}' not registered in monitoring database.`);
  let reading: AqiResponse | null;
  try {
    reading = await air(school.location.lat, school.location.lon);
  } catch {
    reading = null;
  }
  if (!reading) return error(503, 'sources_unavailable', 'no AQI reading for this school right now; try again in a minute');
  return Response.json(buildAdvisory(school, reading, now));
}
