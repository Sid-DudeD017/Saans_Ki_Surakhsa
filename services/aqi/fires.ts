export interface FirePoint {
  lat: number;
  lon: number;
  acquisition_time: string;
  satellite: string;
  confidence: string;
  frp: number;
}

export async function fetchFires(bbox: string, mapKey: string): Promise<FirePoint[]> {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/VIIRS_SNPP_NRT/${bbox}/1`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      console.warn("NASA_FIRMS_MAP_KEY is invalid or missing");
      return [];
    }
    throw new Error("FIRMS fetch failed");
  }
  
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",");
  const latIdx = headers.indexOf("latitude");
  const lonIdx = headers.indexOf("longitude");
  const acqDateIdx = headers.indexOf("acq_date");
  const acqTimeIdx = headers.indexOf("acq_time");
  const satIdx = headers.indexOf("satellite");
  const confIdx = headers.indexOf("confidence");
  const frpIdx = headers.indexOf("frp");

  const results: FirePoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < headers.length) continue;
    
    // ISO 8601 with +05:30
    const rawDate = cols[acqDateIdx];
    let rawTime = cols[acqTimeIdx];
    if (rawTime.length === 4) {
      rawTime = rawTime.slice(0, 2) + ":" + rawTime.slice(2) + ":00";
    }
    
    // FIRMS is in UTC. We convert it to +05:30.
    const utcDate = new Date(`${rawDate}T${rawTime}Z`);
    const offsetMs = 5.5 * 60 * 60 * 1000;
    const localDate = new Date(utcDate.getTime() + offsetMs);
    const acqIso = localDate.toISOString().replace("Z", "+05:30");

    results.push({
      lat: parseFloat(cols[latIdx]),
      lon: parseFloat(cols[lonIdx]),
      acquisition_time: acqIso,
      satellite: cols[satIdx],
      confidence: cols[confIdx],
      frp: parseFloat(cols[frpIdx])
    });
  }

  return results;
}
