import { NextResponse } from 'next/server';
import { updateDataForLocation, getAqiForLocation } from '../../../../services/aqi/index';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lonStr = searchParams.get('lon');

  if (!latStr || !lonStr) {
    return NextResponse.json({ error: "Missing lat or lon parameters" }, { status: 422 });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "Invalid lat or lon parameters" }, { status: 422 });
  }

  // Load keys from process.env
  const keys = {
    openaq: process.env.OPENAQ_API_KEY,
    cpcb: process.env.CPCB_API_KEY,
  };

  const { missingKeys, allFailed } = await updateDataForLocation(lat, lon, keys);

  if (allFailed) {
    if (missingKeys.length > 0) console.warn("Missing keys:", missingKeys);
    return NextResponse.json({ 
      error: "sources_unavailable",
      detail: "All upstream AQI data sources (OpenAQ, CPCB, Open-Meteo) failed to respond. Retry after 60 seconds."
    }, { status: 503 });
  }

  const aqiData = await getAqiForLocation(lat, lon);

  if (!aqiData) {
    if (missingKeys.length > 0) console.warn("Missing keys:", missingKeys);
    return NextResponse.json({ 
      error: "no_coverage",
      detail: "No monitoring stations found within interpolation radius of the requested coordinates."
    }, { status: 404 });
  }

  const response = {
    ...aqiData,
  };

  if (missingKeys.length > 0) {
    console.warn("Missing keys:", missingKeys);
  }

  return NextResponse.json(response);
}
