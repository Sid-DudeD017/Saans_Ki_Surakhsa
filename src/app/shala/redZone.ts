// The red-zone map's geometry (P2): distances and bearings on the earth, the upwind rule, and Web
// Mercator for placing OpenStreetMap tiles and points around a school.

export interface LatLon {
  lat: number;
  lon: number;
}

const R_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export const RED_ZONE_KM = 2;
/** A fire is upwind when its bearing from the school is within this many degrees of where the wind comes from. */
export const UPWIND_DEGREES = 45;

export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

/** Compass bearing from a to b, 0–360, clockwise from north. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** The point km away from a on a bearing. */
export function destination(a: LatLon, bearing: number, km: number): LatLon {
  const d = km / R_KM;
  const lat = Math.asin(Math.sin(rad(a.lat)) * Math.cos(d) + Math.cos(rad(a.lat)) * Math.sin(d) * Math.cos(rad(bearing)));
  const lon = rad(a.lon) + Math.atan2(Math.sin(rad(bearing)) * Math.sin(d) * Math.cos(rad(a.lat)), Math.cos(d) - Math.sin(rad(a.lat)) * Math.sin(lat));
  return { lat: deg(lat), lon: ((deg(lon) + 540) % 360) - 180 };
}

/** Smallest angle between two bearings, 0–180. */
export function angleBetween(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/**
 * Whether a fire's smoke is coming at the school. windFromDeg is where the wind blows from
 * (meteorological, as in /v1/aqi). Calm air (under 1 km/h) has no upwind.
 */
export function isUpwind(school: LatLon, fire: LatLon, windFromDeg: number, windKmh: number): boolean {
  if (windKmh < 1) return false;
  return angleBetween(bearingDeg(school, fire), windFromDeg) <= UPWIND_DEGREES;
}

/** "NW" for 315. */
export function compass(bearing: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

// ---- Web Mercator, for OpenStreetMap tiles ----

export const TILE = 256;

/** World pixel position at a zoom level. */
export function project(p: LatLon, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  const s = Math.sin(rad(Math.max(-85.0511, Math.min(85.0511, p.lat))));
  return { x: ((p.lon + 180) / 360) * scale, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale };
}

/** Metres per pixel at a latitude and zoom. */
export function metresPerPixel(lat: number, zoom: number): number {
  return (2 * Math.PI * R_KM * 1000 * Math.cos(rad(lat))) / (TILE * 2 ** zoom);
}

/** The tiles that cover a square of halfPx pixels around a centre, with their pixel offsets from it. */
export function tilesAround(centre: LatLon, zoom: number, halfPx: number) {
  const c = project(centre, zoom);
  const first = { x: Math.floor((c.x - halfPx) / TILE), y: Math.floor((c.y - halfPx) / TILE) };
  const last = { x: Math.floor((c.x + halfPx) / TILE), y: Math.floor((c.y + halfPx) / TILE) };
  const tiles: { x: number; y: number; z: number; left: number; top: number }[] = [];
  for (let x = first.x; x <= last.x; x++) {
    for (let y = first.y; y <= last.y; y++) tiles.push({ x, y, z: zoom, left: x * TILE - c.x, top: y * TILE - c.y });
  }
  return tiles;
}
