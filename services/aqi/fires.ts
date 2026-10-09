export interface FirePoint {
  lat: number;
  lon: number;
  acquisition_time: string;
  satellite: string;
  confidence: string;
  frp: number;
}

/** FIRMS VIIRS (Suomi-NPP) fires in a bbox. dayRange 1 is today's UTC date only; 2 adds yesterday. */
export async function fetchFires(bbox: string, mapKey: string, dayRange = 1): Promise<FirePoint[]> {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/VIIRS_SNPP_NRT/${bbox}/${dayRange}`;
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
    // FIRMS writes HHMM in UTC without leading zeros: "803" is 08:03, "5" is 00:05.
    const hhmm = cols[acqTimeIdx].trim().padStart(4, "0");
    const rawTime = hhmm.slice(0, 2) + ":" + hhmm.slice(2) + ":00";

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
