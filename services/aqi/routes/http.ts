// POST /v1/routes/clean (P3): routes ranked by the PM2.5 dose you'd breathe, as p3-aqi.openapi.json's
// CleanRouteResponse.
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { errorResponse } from '../errors';
import { istIso, pm25At } from '../forecast/forecast';
import { inCoverage, type ForecastSnapshot } from '../forecast/grid';
import { MODE_FACTORS, chooseRoute } from './clean';
import { NoRouteError, type RouteProvider } from './providers';

const Point = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const Body = z.object({
  origin: Point,
  destination: Point,
  depart_at: z.iso.datetime({ offset: true }),
  mode: z.enum(['two_wheeler', 'car_windows_up', 'bus', 'walk', 'cycle', 'metro']),
  max_extra_min: z.int().min(0).default(15),
  /** Share of PM2.5 the traveller's mask stops: 0 none … 0.95. Saans addition to the contract. */
  mask_filtration: z.number().min(0).max(0.95).default(0),
});

const HOUR_MS = 3_600_000;

export async function answerCleanRoute(request: Request, current: () => Promise<ForecastSnapshot | null>, provider: RouteProvider, now = Date.now()) {
  const json = await request.json().catch(() => undefined);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: ['body', ...i.path.map(String)].join('.'),
      problem: i.code === 'invalid_type' && i.input === undefined ? 'required' : i.message,
    }));
    return errorResponse(422, 'invalid_request', json === undefined ? 'The body must be JSON' : 'Invalid route request', details);
  }
  const req = parsed.data;
  const departAt = Date.parse(req.depart_at);
  if (departAt < now - HOUR_MS || departAt > now + 70 * HOUR_MS) {
    return errorResponse(422, 'invalid_request', 'depart_at must be within the forecast: from an hour ago to 70 hours ahead', [
      { field: 'body.depart_at', problem: 'outside the forecast' },
    ]);
  }
  const noCoverage = (message = 'No routing or PM2.5 data available for the requested origin/destination.') => errorResponse(404, 'no_coverage', message);
  if (!inCoverage(req.origin.lat, req.origin.lon) || !inCoverage(req.destination.lat, req.destination.lon)) return noCoverage();

  const unavailable = () => errorResponse(503, 'sources_unavailable', 'Routing or AQI upstream failed to respond. Retry after 60 seconds.');
  const [snapshot, options] = await Promise.all([
    current().catch(() => null),
    provider.routes(req.origin, req.destination, departAt, req.mode).catch((e: unknown) => e as Error),
  ]);
  if (options instanceof NoRouteError) return noCoverage(options.message);
  if (options instanceof Error || !snapshot) return unavailable();

  const at = (lat: number, lon: number, ms: number) => pm25At(snapshot, lat, lon, ms)?.pm25 ?? null;
  const choice = chooseRoute(options, departAt, req.mode, req.mask_filtration, req.max_extra_min, at, now);
  if (!choice) return noCoverage();

  return NextResponse.json({
    origin: req.origin,
    destination: req.destination,
    depart_at: istIso(departAt),
    mode: req.mode,
    routes: choice.routes.map(({ pieces: _pieces, ...r }) => r),
    recommended_route_id: choice.recommended_route_id,
    ...(choice.better_departure_ms !== undefined ? { better_departure_time: istIso(choice.better_departure_ms) } : {}),
    mode_factors_used: { ...MODE_FACTORS[req.mode], note: 'Planning values — not medical advice' },
  });
}
