import { NextResponse } from 'next/server';
import { fetchFires } from '../../../../services/aqi/fires';
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
       return NextResponse.json({ error: "Missing complete point-radius parameters (lat, lon, radius_km)" }, { status: 422 });
    }
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    const radius = parseFloat(radiusStr);

    if (isNaN(lat) || lat < -90 || lat > 90) return NextResponse.json({ error: "Invalid lat" }, { status: 422 });
    if (isNaN(lon) || lon < -180 || lon > 180) return NextResponse.json({ error: "Invalid lon" }, { status: 422 });
    if (isNaN(radius) || radius <= 0) return NextResponse.json({ error: "Invalid radius_km" }, { status: 422 });

    // Calculate approximate bounding box for FIRMS fetch
    const degLatKm = 111;
    const minLat = lat - (radius / degLatKm);
    const maxLat = lat + (radius / degLatKm);
    const minLon = lon - (radius / (degLatKm * Math.cos(lat * (Math.PI / 180))));
    const maxLon = lon + (radius / (degLatKm * Math.cos(lat * (Math.PI / 180))));
    fetchBbox = `${minLon.toFixed(4)},${minLat.toFixed(4)},${maxLon.toFixed(4)},${maxLat.toFixed(4)}`;

    filterCenter = { lat, lon, radius };
  } else {
    return NextResponse.json({ error: "Missing bbox or point-radius parameters" }, { status: 422 });
  }

  const mapKey = process.env.NASA_FIRMS_MAP_KEY;
  if (!mapKey) {
    console.warn("Missing keys: NASA_FIRMS_MAP_KEY");
    return NextResponse.json({ 
      error: "sources_unavailable",
      detail: "NASA FIRMS API failed to respond. Retry after 60 seconds."
    }, { status: 503 });
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
    return NextResponse.json({ 
      error: "sources_unavailable",
      detail: "NASA FIRMS API failed to respond. Retry after 60 seconds." 
    }, { status: 503 });
  }
}
