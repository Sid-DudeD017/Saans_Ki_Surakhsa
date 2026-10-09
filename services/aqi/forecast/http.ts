// GET /v1/aqi/forecast?lat&lon&hours (P3): the 1 km cell's hourly PM2.5 as p3-aqi.openapi.json's ForecastResponse.
import { NextResponse } from 'next/server';

import { getCategoryCode, subIndex } from '../../../packages/aqi/index';
import { errorResponse, type ErrorDetail } from '../errors';
import { DEFAULT_HOURS, MAX_HOURS, MODEL_VERSION } from './config';
import { forecastSeries, istIso, modelName } from './forecast';
import { inCoverage, type ForecastSnapshot } from './grid';

function number(params: URLSearchParams, name: string, min: number, max: number, problems: ErrorDetail[]): number | null {
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') {
    problems.push({ field: `query.${name}`, problem: 'required' });
    return null;
  }
  const v = Number(raw);
  if (!Number.isFinite(v) || v < min || v > max) {
    problems.push({ field: `query.${name}`, problem: `must be a number from ${min} to ${max}` });
    return null;
  }
  return v;
}

export async function answerForecast(url: URL, current: () => Promise<ForecastSnapshot | null>, now = Date.now()) {
  const q = url.searchParams;
  const problems: ErrorDetail[] = [];
  const lat = number(q, 'lat', -90, 90, problems);
  const lon = number(q, 'lon', -180, 180, problems);
  let hours = DEFAULT_HOURS;
  const rawHours = q.get('hours');
  if (rawHours !== null) {
    const h = Number(rawHours);
    if (rawHours.trim() === '' || !Number.isInteger(h) || h < 1 || h > MAX_HOURS) {
      problems.push({ field: 'query.hours', problem: `must be a whole number from 1 to ${MAX_HOURS}` });
    } else hours = h;
  }
  if (problems.length || lat === null || lon === null) {
    return errorResponse(422, 'invalid_request', 'Invalid forecast query', problems);
  }
  if (!inCoverage(lat, lon)) {
    return errorResponse(404, 'no_coverage', 'Forecast data is not available for the requested coordinates.');
  }

  const unavailable = () =>
    errorResponse(503, 'sources_unavailable', 'Forecast upstream (Open-Meteo CAMS) failed to respond. Retry after 60 seconds.');
  const snapshot = await current().catch(() => null);
  if (!snapshot) return unavailable();
  const series = forecastSeries(snapshot, lat, lon, now, hours);
  if (!series.length) return unavailable();

  return NextResponse.json({
    lat,
    lon,
    generated_at: istIso(Date.parse(snapshot.generated_at)),
    hours: series.map((h) => {
      const pm25 = Math.round(h.pm25 * 10) / 10;
      const aqi = subIndex('pm25', pm25).value;
      return { time: istIso(h.at), pm25_ug_m3: pm25, aqi, category: getCategoryCode(aqi) };
    }),
    model: modelName(snapshot),
    model_version: MODEL_VERSION,
  });
}
