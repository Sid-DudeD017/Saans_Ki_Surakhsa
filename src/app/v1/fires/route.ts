import { NextResponse } from 'next/server';
import { fetchFires } from '../../../../services/aqi/fires';
import { errorResponse } from '../../../../services/aqi/errors';
import { getDistanceFromLatLonInKm } from '../../../../services/aqi/index';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bbox = searchParams.get('bbox');

  const latStr = searchParams.get('lat');
  const lonStr = searchParams.get('lon');
  const radiusStr = searchParams.get('radius_km');

  let fetchBbox = bbox;
  let filterCenter: { lat: number, lon: number, radius: number } | null = null;

  if (bbox) {
    // Valid as is
  } else if (latStr || lonStr || radiusStr) {
    if (!latStr || !lonStr || !radiusStr) {
       return errorResponse(422, "invalid_request", "Missing complete point-radius parameters (lat, lon, radius_km)", [
         ...(["lat", "lon", "radius_km"] as const).filter((k) => !searchParams.get(k)).map((k) => ({ field: `query.${k}`, problem: "required" })),
       ]);
    }
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    const radius = parseFloat(radiusStr);

    if (isNaN(lat) || lat < -90 || lat > 90) return errorResponse(422, "invalid_request", "Invalid lat", [{ field: "query.lat", problem: "must be a number from -90 to 90" }]);
    if (isNaN(lon) || lon < -180 || lon > 180) return errorResponse(422, "invalid_request", "Invalid lon", [{ field: "query.lon", problem: "must be a number from -180 to 180" }]);
    if (isNaN(radius) || radius <= 0) return errorResponse(422, "invalid_request", "Invalid radius_km", [{ field: "query.radius_km", problem: "must be a number above 0" }]);

    // Calculate approximate bounding box for FIRMS fetch
    const degLatKm = 111;
    const minLat = lat - (radius / degLatKm);
    const maxLat = lat + (radius / degLatKm);
    const minLon = lon - (radius / (degLatKm * Math.cos(lat * (Math.PI / 180))));
    const maxLon = lon + (radius / (degLatKm * Math.cos(lat * (Math.PI / 180))));
    fetchBbox = `${minLon.toFixed(4)},${minLat.toFixed(4)},${maxLon.toFixed(4)},${maxLat.toFixed(4)}`;

    filterCenter = { lat, lon, radius };
  } else {
    return errorResponse(422, "invalid_request", "Missing bbox or point-radius parameters", [{ field: "query.bbox", problem: "required unless lat, lon and radius_km are given" }]);
  }

  const mapKey = process.env.NASA_FIRMS_MAP_KEY;
  if (!mapKey) {
    console.warn("Missing keys: NASA_FIRMS_MAP_KEY");
    return errorResponse(503, "sources_unavailable", "NASA FIRMS API failed to respond. Retry after 60 seconds.");
  }

  try {
    // We know fetchBbox is defined here
    let fires = await fetchFires(fetchBbox as string, mapKey);

    if (filterCenter) {
      fires = fires.filter(f => getDistanceFromLatLonInKm(filterCenter!.lat, filterCenter!.lon, f.lat, f.lon) <= filterCenter!.radius);
    }

    const localDate = new Date(Date.now() + 5.5 * 3600000);
    const asOfIso = localDate.toISOString().replace("Z", "+05:30");
    return NextResponse.json({
      fires: fires,
      count: fires.length,
      as_of: asOfIso
    });
  } catch (e) {
    return errorResponse(503, "sources_unavailable", "NASA FIRMS API failed to respond. Retry after 60 seconds.");
  }
}
