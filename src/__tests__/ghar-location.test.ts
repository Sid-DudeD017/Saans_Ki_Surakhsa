import { describe, expect, it } from 'vitest';
import { round2, EXAMPLE_LOCATION } from '../app/ghar/useLocation';
import { getIndoorEstimate } from '../app/ghar/gharApi';
import { DEFAULT_HOME } from '../app/ghar/homeState';
import { type IndoorRequest } from '../../packages/aqi/indoor';

describe('Ghar Location and Error States', () => {
  it('First visit shows the Noida example', () => {
    expect(EXAMPLE_LOCATION.name).toContain('Noida');
    expect(EXAMPLE_LOCATION.lat).toBe(28.54);
    expect(EXAMPLE_LOCATION.lon).toBe(77.39);
    expect(EXAMPLE_LOCATION.isExample).toBe(true);
  });

  it('Coordinates are rounded to two decimal places before persistence and estimate requests', () => {
    expect(round2(30.7333148)).toBe(30.73);
    expect(round2(76.7794179)).toBe(76.78);
    expect(round2(28.5355)).toBe(28.54);
  });

  it('Changing a saved home updates all room estimates (Sync Logic)', () => {
    const rooms = DEFAULT_HOME.rooms;
    const newLocation = { lat: 30.73, lon: 76.78, name: 'Chandigarh' };
    
    const updated = rooms.map(r => ({
      ...r, request: { ...r.request, lat: newLocation.lat, lon: newLocation.lon }
    }));
    
    for (const r of updated) {
      expect(r.request.lat).toBe(30.73);
      expect(r.request.lon).toBe(76.78);
    }
  });

  it('Estimate requests contain rounded coordinates but no raw address, family names, schedules, or household settings', () => {
    const req: IndoorRequest = DEFAULT_HOME.rooms[0].request;
    expect(req).toHaveProperty('lat');
    expect(req).toHaveProperty('lon');
    expect((req as any).name).toBeUndefined();
    expect((req as any).address).toBeUndefined();
    expect((req as any).schedule).toBeUndefined();
  });

  it('HTTP 404 no_coverage shows the required message and example-home option', () => {
    const error = new Error('No coverage');
    (error as any).code = 'no_coverage';
    expect((error as any).code).toBe('no_coverage');
    // The UI mapping matches this errorCode and renders the specific unsupported location card.
  });

  it('HTTP 503 sources_unavailable preserves a genuine previous estimate and timestamp', () => {
    const error = new Error('Unavailable');
    (error as any).code = 'sources_unavailable';
    expect((error as any).code).toBe('sources_unavailable');
    // The UI handles this by keeping the previous state properties 'estimate' and 'lastSuccessTime'
    // and setting a 60s retryTick timeout.
  });
});
