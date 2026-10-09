// Amazon Location routes (P3): reading CalculateRoutes answers, the request we send, and falling back to OSRM.
import { describe, expect, it, vi } from 'vitest';

import { amazonProvider, fromAmazon } from './amazon';
import { NoRouteError, type RouteOption, type RouteProvider } from './providers';

const NOIDA = { lat: 28.5355, lon: 77.391 };
const SAKET = { lat: 28.5245, lon: 77.2167 };
const DEPART = Date.parse('2099-10-09T03:00:00Z');

/** One route, two spans along a four-point line: DND Flyway (free in 300 s, 400 s in traffic), then Ring Road. */
const answer = {
  Routes: [
    {
      Summary: { Distance: 9000, Duration: 1000 },
      Legs: [
        {
          Geometry: { LineString: [[77.39, 28.53], [77.33, 28.55], [77.28, 28.56], [77.22, 28.52]] },
          VehicleLegDetails: {
            Spans: [
              { GeometryOffset: 0, Distance: 6000, Duration: 400, BestCaseDuration: 300, Names: [{ Value: 'डीएनडी फ्लाईवे', Language: 'hi' }, { Value: 'DND Flyway', Language: 'en' }] },
              { GeometryOffset: 2, Distance: 3000, Duration: 600, BestCaseDuration: 600, Names: [{ Value: 'Ring Road' }] },
            ],
          },
        },
      ],
    },
  ],
};

describe('Amazon Location answers', () => {
  it('turns spans into steps with names, geometry and congestion = 1 − free ÷ actual', () => {
    const [route] = fromAmazon(answer);
    expect(route).toMatchObject({ distance_m: 9000, duration_s: 1000, source: 'amazon' });
    expect(route.steps.map((s) => [s.name, s.distance_m, s.duration_s, s.coords.length, s.congestion])).toEqual([
      ['DND Flyway', 6000, 400, 3, 0.25],
      ['Ring Road', 3000, 600, 2, 0],
    ]);
  });

  it('says when there is no route', () => {
    expect(() => fromAmazon({ Routes: [] })).toThrow(NoRouteError);
  });
});

describe('the Amazon provider', () => {
  const osrmRoute: RouteOption = { distance_m: 1, duration_s: 1, steps: [], source: 'osrm' };
  const fallback: RouteProvider = { routes: vi.fn(async () => [osrmRoute]) };

  it('asks for up to 5 routes with traffic, as Scooter for a two-wheeler, from [lon, lat]', async () => {
    const sent: any[] = [];
    const client = { send: vi.fn(async (c: any) => (sent.push(c), answer)) };
    const routes = await amazonProvider(fallback, client).routes(NOIDA, SAKET, DEPART, 'two_wheeler');
    expect(routes[0].source).toBe('amazon');
    expect(sent[0].input).toMatchObject({
      Origin: [77.391, 28.5355],
      Destination: [77.2167, 28.5245],
      DepartureTime: '2099-10-09T03:00:00.000Z',
      TravelMode: 'Scooter',
      MaxAlternatives: 4,
      LegGeometryFormat: 'Simple',
      Traffic: { Usage: 'UseTrafficData' },
    });
  });

  it('sends cycling to OSRM, and falls back to OSRM when Amazon fails, but not when it finds no route', async () => {
    const failing = { send: vi.fn(async () => { throw new Error('AccessDeniedException'); }) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await amazonProvider(fallback, failing).routes(NOIDA, SAKET, DEPART, 'cycle'))[0].source).toBe('osrm');
    expect(failing.send).not.toHaveBeenCalled();
    expect((await amazonProvider(fallback, failing).routes(NOIDA, SAKET, DEPART, 'car_windows_up'))[0].source).toBe('osrm');
    const empty = { send: vi.fn(async () => ({ Routes: [] })) };
    await expect(amazonProvider(fallback, empty).routes(NOIDA, SAKET, DEPART, 'walk')).rejects.toThrow(NoRouteError);
    warn.mockRestore();
  });
});
