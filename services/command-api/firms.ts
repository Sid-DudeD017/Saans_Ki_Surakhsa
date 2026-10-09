// The live FIRMS check for triage: P3's FIRMS reader (services/aqi/fires.ts, the same one behind /v1/fires),
// asked for a small box around the report. NASA being down, or no key, means "can't tell" (null), never a
// failed intake: the case is still made, UNVERIFIED.
import { fetchFires } from "../aqi/fires";
import type { FireLookup, FireObservation } from "./deps";

export function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Fires within radiusM of `at`, acquired between since and until. */
export function firesNear(fires: FireObservation[], at: { lat: number; lon: number }, radiusM: number, since: Date, until: Date) {
  return fires
    .filter((f) => {
      const t = Date.parse(f.acquisition_time);
      return t >= since.getTime() && t <= until.getTime() && metres(at, f) <= radiusM;
    })
    .sort((a, b) => metres(at, a) - metres(at, b));
}

export function liveFires(mapKey = process.env.NASA_FIRMS_MAP_KEY): FireLookup | undefined {
  if (!mapKey) return undefined;
  return async (at, radiusM, since, until) => {
    const dLat = radiusM / 111_000 + 0.01;
    const dLon = radiusM / (111_000 * Math.cos((at.lat * Math.PI) / 180)) + 0.01;
    const bbox = [at.lon - dLon, at.lat - dLat, at.lon + dLon, at.lat + dLat].map((v) => v.toFixed(4)).join(",");
    // dayRange counts UTC days back from today, so cover since..now.
    const days = Math.min(5, Math.max(1, Math.ceil((Date.now() - since.getTime()) / 86_400_000) + 1));
    try {
      return firesNear(await fetchFires(bbox, mapKey, days), at, radiusM, since, until);
    } catch (e) {
      console.warn("FIRMS check skipped:", (e as Error).message);
      return null;
    }
  };
}
