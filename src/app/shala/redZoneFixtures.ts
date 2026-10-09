// Demo points for the red-zone map in mock mode (P2), placed by distance and bearing from the demo
// school. They are examples, not real stations or fire detections, and the map says so. In live mode the
// fires come from P3's GET /v1/fires; the API has no station list yet.
import type { components } from '../../../packages/contracts/types';
import schools from '../../config/schools.json';
import { destination } from './redZone';

type FirePoint = components['schemas']['FirePoint'];

const school = schools.schools[0].location;

function fire(bearing: number, km: number, time: string, confidence: string, frp: number): FirePoint {
  const at = destination(school, bearing, km);
  return { lat: Number(at.lat.toFixed(5)), lon: Number(at.lon.toFixed(5)), acquisition_time: time, satellite: 'N', confidence, frp };
}

export const DEMO_FIRES: FirePoint[] = [
  fire(300, 1.4, '2026-10-08T13:42:00+05:30', 'high', 9.8),
  fire(315, 5.8, '2026-10-08T13:42:00+05:30', 'nominal', 4.1),
  fire(95, 3.1, '2026-10-08T13:41:00+05:30', 'nominal', 3.6),
  fire(200, 8.0, '2026-10-08T01:58:00+05:30', 'low', 1.9),
];

export interface DemoStation {
  name: string;
  lat: number;
  lon: number;
  /** Added to the day's AQI, so the stations follow the example-day switch. */
  aqiOffset: number;
}

function station(name: string, bearing: number, km: number, aqiOffset: number): DemoStation {
  const at = destination(school, bearing, km);
  return { name, lat: Number(at.lat.toFixed(5)), lon: Number(at.lon.toFixed(5)), aqiOffset };
}

export const DEMO_STATIONS: DemoStation[] = [station('Demo station A', 40, 0.9, 14), station('Demo station B', 225, 1.7, -22)];
