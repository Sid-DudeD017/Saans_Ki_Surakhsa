// Saaf Raasta's candidate routes (P3). OSRM for now (no key: the public demo routers, car for two-wheelers,
// cars and buses, foot and bike from FOSSGIS); Amazon Location Service, with traffic, is to come once the Saans
// AWS account is set up. Saved OSRM answers in fixtures/ keep the tests off the network.
import type { Fetch } from '../forecast/sources';

export type Mode = 'two_wheeler' | 'car_windows_up' | 'bus' | 'walk' | 'cycle' | 'metro';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface RouteStep {
  name: string;
  distance_m: number;
  duration_s: number;
  /** [lon, lat] along the step. */
  coords: [number, number][];
  /** 0 free flow … 1 gridlock. OSRM has no traffic, so its steps say 0. */
  congestion: number;
}

export interface RouteOption {
  distance_m: number;
  duration_s: number;
  steps: RouteStep[];
  source: 'osrm' | 'amazon';
}

export interface RouteProvider {
  routes(origin: LatLon, destination: LatLon, departAt: number, mode: Mode): Promise<RouteOption[]>;
}

export class NoRouteError extends Error {}

const OSRM_PROFILES: Record<Exclude<Mode, 'metro'>, string> = {
  two_wheeler: 'https://router.project-osrm.org/route/v1/driving',
  car_windows_up: 'https://router.project-osrm.org/route/v1/driving',
  bus: 'https://router.project-osrm.org/route/v1/driving',
  walk: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  cycle: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike',
};

interface OsrmStep {
  name?: string;
  ref?: string;
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
}
interface OsrmAnswer {
  code: string;
  routes?: { distance: number; duration: number; legs: { steps: OsrmStep[] }[] }[];
}

/** An OSRM /route answer (steps=true, geometries=geojson) as route options. */
export function fromOsrm(answer: OsrmAnswer): RouteOption[] {
  if (answer.code !== 'Ok' || !answer.routes?.length) throw new NoRouteError(`OSRM found no route (${answer.code})`);
  return answer.routes.map((r) => ({
    distance_m: r.distance,
    duration_s: r.duration,
    source: 'osrm',
    steps: r.legs
      .flatMap((l) => l.steps)
      .filter((s) => s.distance > 0)
      .map((s) => ({ name: s.name || s.ref || '', distance_m: s.distance, duration_s: s.duration, coords: s.geometry.coordinates, congestion: 0 })),
  }));
}

export function osrmUrl(origin: LatLon, destination: LatLon, mode: Exclude<Mode, 'metro'>): string {
  const pair = `${origin.lon.toFixed(5)},${origin.lat.toFixed(5)};${destination.lon.toFixed(5)},${destination.lat.toFixed(5)}`;
  return `${OSRM_PROFILES[mode]}/${pair}?alternatives=3&overview=false&steps=true&geometries=geojson`;
}

export function osrmProvider(fetcher: Fetch = fetch): RouteProvider {
  return {
    async routes(origin, destination, _departAt, mode) {
      if (mode === 'metro') throw new NoRouteError('Metro journeys are not routed yet');
      const res = await fetcher(osrmUrl(origin, destination, mode), { headers: { 'User-Agent': 'Saans/0.1 (Environmental Hacks 2026)' } });
      if (res.status === 400) throw new NoRouteError('OSRM found no route');
      if (!res.ok) throw new Error(`OSRM answered ${res.status}`);
      return fromOsrm((await res.json()) as OsrmAnswer);
    },
  };
}
