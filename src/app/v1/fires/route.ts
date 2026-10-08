import { NextResponse } from 'next/server';
import { fetchFires } from '../../../../services/aqi/fires';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bbox = searchParams.get('bbox');

  if (!bbox) {
    return NextResponse.json({ error: "Missing bbox parameter" }, { status: 422 });
  }

  const mapKey = process.env.NASA_FIRMS_MAP_KEY;
  if (!mapKey) {
    console.warn("Missing keys: NASA_FIRMS_MAP_KEY");
    return NextResponse.json({ 
      error: "sources_unavailable",
      detail: "NASA FIRMS API failed to respond. Retry after 60 seconds."
    }, { status: 503 }); // 503 because it can't fetch fires
  }

  try {
    const fires = await fetchFires(bbox, mapKey);
    return NextResponse.json({
      fires: fires,
      count: fires.length,
      as_of: new Date().toISOString().replace("Z", "+05:30")
    });
  } catch (e) {
    return NextResponse.json({ 
      error: "sources_unavailable",
      detail: "NASA FIRMS API failed to respond. Retry after 60 seconds." 
    }, { status: 503 });
  }
}
