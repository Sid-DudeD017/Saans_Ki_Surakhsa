// POST /v1/indoor/estimate (P3): the room's PM2.5 now and for 72 hours, from the forecast grid outside it, as
// p3-aqi.openapi.json's IndoorEstimateResponse, plus `plan`, the same advice as `today_plan`, item by item.
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { estimateIndoor, type IndoorRequest } from '../../../packages/aqi/indoor';
import { INDOOR_DEFAULTS } from '../../../packages/aqi/indoorDefaults';
import { errorResponse } from '../errors';
import { pm25At } from '../forecast/forecast';
import { inCoverage, type ForecastSnapshot } from '../forecast/grid';

const Body = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  room_area_m2: z.number().min(1),
  ceiling_height_m: z.number().min(1).max(10).default(INDOOR_DEFAULTS.ceiling_height_m.value),
  windows: z.int().min(0),
  windows_open: z.boolean().default(false),
  purifier_cadr_m3_h: z.number().min(0).default(0),
  hepa_class: z.enum(['none', 'h11', 'h12', 'h13', 'h14']).default('none'),
  cooking_fuel: z.enum(['none', 'lpg', 'png', 'kerosene', 'biomass', 'electric']).default('none'),
  smokers: z.int().min(0).default(0),
  incense: z.boolean().default(false),
  mosquito_coils: z.boolean().default(false),
});

export async function answerIndoor(request: Request, current: () => Promise<ForecastSnapshot | null>, now = Date.now()) {
  const json = await request.json().catch(() => undefined);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: ['body', ...i.path.map(String)].join('.'),
      problem: i.code === 'invalid_type' && i.input === undefined ? 'required' : i.message,
    }));
    return errorResponse(422, 'invalid_request', json === undefined ? 'The body must be JSON' : 'Invalid room', details);
  }
  const req: IndoorRequest = parsed.data;
  const noData = () => errorResponse(404, 'no_coverage', 'No outdoor PM2.5 data available for the specified location to anchor the indoor model.');
  if (!inCoverage(req.lat, req.lon)) return noData();

  const snapshot = await current().catch(() => null);
  if (!snapshot) return errorResponse(503, 'sources_unavailable', 'Outdoor AQI sources failed to respond. Retry after 60 seconds.');
  const outdoorAt = (ms: number) => pm25At(snapshot, req.lat, req.lon, ms)?.pm25 ?? null;
  if (outdoorAt(now) === null) return errorResponse(503, 'sources_unavailable', 'Outdoor AQI sources failed to respond. Retry after 60 seconds.');

  return NextResponse.json(estimateIndoor(req, outdoorAt, now));
}
