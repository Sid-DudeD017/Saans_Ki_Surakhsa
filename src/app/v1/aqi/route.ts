import { NextResponse } from 'next/server';
import { updateDataForLocation, getAqiForLocation } from '../../../../services/aqi/index';
import { errorResponse } from '../../../../services/aqi/errors';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lonStr = searchParams.get('lon');

  if (!latStr || !lonStr) {
    return errorResponse(422, "invalid_request", "Missing lat or lon parameters", [
      ...(latStr ? [] : [{ field: "query.lat", problem: "required" }]),
      ...(lonStr ? [] : [{ field: "query.lon", problem: "required" }]),
    ]);
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return errorResponse(422, "invalid_request", "Invalid lat or lon parameters", [
      ...(isNaN(lat) ? [{ field: "query.lat", problem: "must be a number" }] : []),
      ...(isNaN(lon) ? [{ field: "query.lon", problem: "must be a number" }] : []),
    ]);
  }

  // Load keys from process.env
  const keys = {
    openaq: process.env.OPENAQ_API_KEY,
    cpcb: process.env.CPCB_API_KEY,
  };

  const { missingKeys, allFailed } = await updateDataForLocation(lat, lon, keys);

  if (allFailed) {
    if (missingKeys.length > 0) console.warn("Missing keys:", missingKeys);
    return errorResponse(503, "sources_unavailable", "All upstream AQI data sources (OpenAQ, CPCB, Open-Meteo) failed to respond. Retry after 60 seconds.");
  }

  const aqiData = await getAqiForLocation(lat, lon);

  if (!aqiData) {
    if (missingKeys.length > 0) console.warn("Missing keys:", missingKeys);
    return errorResponse(404, "no_coverage", "No monitoring stations found within interpolation radius of the requested coordinates.");
  }

  const response = {
    ...aqiData,
  };

  if (missingKeys.length > 0) {
    console.warn("Missing keys:", missingKeys);
  }

  return NextResponse.json(response);
}
