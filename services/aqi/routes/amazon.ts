// Amazon Location Service routes (P3): up to 5 alternatives for the departure time, with traffic. Each span's
// congestion is 1 − (time without traffic ÷ time with it). Two-wheelers ride as Scooter; Amazon has no bicycle
// mode, so cycling (and anything Amazon can't answer) goes to OSRM.
import { CalculateRoutesCommand, GeoRoutesClient, type CalculateRoutesCommandOutput, type RouteTravelMode } from '@aws-sdk/client-geo-routes';

import { NoRouteError, type Mode, type RouteOption, type RouteProvider, type RouteStep } from './providers';

const TRAVEL_MODES: Partial<Record<Mode, RouteTravelMode>> = {
  two_wheeler: 'Scooter',
  car_windows_up: 'Car',
  bus: 'Car',
  walk: 'Pedestrian',
};

type Span = { Distance?: number; Duration?: number; BestCaseDuration?: number; GeometryOffset?: number; Names?: { Value?: string; Language?: string }[] };

/** A CalculateRoutes answer (LegGeometryFormat Simple, span names and durations) as route options. */
export function fromAmazon(answer: Pick<CalculateRoutesCommandOutput, 'Routes'>): RouteOption[] {
  const routes = answer.Routes ?? [];
  if (!routes.length) throw new NoRouteError('Amazon Location found no route');
  return routes.map((route) => {
    const steps: RouteStep[] = [];
    for (const leg of route.Legs ?? []) {
      const line = (leg.Geometry?.LineString ?? []).map(([lon, lat]) => [lon, lat] as [number, number]);
      const spans: Span[] = leg.VehicleLegDetails?.Spans ?? leg.PedestrianLegDetails?.Spans ?? [];
      spans.forEach((span, i) => {
        const from = span.GeometryOffset ?? 0;
        const to = spans[i + 1]?.GeometryOffset ?? line.length - 1;
        const coords = line.slice(from, to + 1);
        const duration = span.Duration ?? 0;
        const free = span.BestCaseDuration ?? duration;
        if (!span.Distance || coords.length < 2) return;
        steps.push({
          name: span.Names?.find((n) => n.Language?.startsWith('en'))?.Value ?? span.Names?.[0]?.Value ?? '',
          distance_m: span.Distance,
          duration_s: duration,
          coords,
          congestion: duration > 0 ? Math.min(1, Math.max(0, 1 - free / duration)) : 0,
        });
      });
    }
    return {
      distance_m: route.Summary?.Distance ?? steps.reduce((a, s) => a + s.distance_m, 0),
      duration_s: route.Summary?.Duration ?? steps.reduce((a, s) => a + s.duration_s, 0),
      steps,
      source: 'amazon' as const,
    };
  });
}

/** Amazon Location for the modes it has, `fallback` (OSRM) for the rest and whenever Amazon fails. */
export function amazonProvider(fallback: RouteProvider, client: Pick<GeoRoutesClient, 'send'> = new GeoRoutesClient({ region: process.env.ROUTES_REGION ?? process.env.AWS_REGION ?? 'ap-south-1' })): RouteProvider {
  return {
    async routes(origin, destination, departAt, mode) {
      const travelMode = TRAVEL_MODES[mode];
      if (!travelMode) return fallback.routes(origin, destination, departAt, mode);
      try {
        const answer = await client.send(
          new CalculateRoutesCommand({
            Origin: [origin.lon, origin.lat],
            Destination: [destination.lon, destination.lat],
            DepartureTime: new Date(Math.max(departAt, Date.now())).toISOString(),
            TravelMode: travelMode,
            MaxAlternatives: 4,
            LegGeometryFormat: 'Simple',
            Languages: ['en'],
            SpanAdditionalFeatures: ['Names', 'Distance', 'Duration', 'BestCaseDuration'],
            Traffic: { Usage: 'UseTrafficData' },
          }),
        );
        return fromAmazon(answer);
      } catch (e) {
        if (e instanceof NoRouteError) throw e;
        console.warn('Amazon Location failed, using OSRM:', e instanceof Error ? e.message : e);
        return fallback.routes(origin, destination, departAt, mode);
      }
    },
  };
}
