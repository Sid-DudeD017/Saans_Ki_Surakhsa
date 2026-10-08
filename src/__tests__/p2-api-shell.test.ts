import { describe, it, expect } from 'vitest';
import {
  getAqi,
  getFires,
  getSchoolAdvisory,
  getNotifications,
  submitComplaint,
} from '../lib/api';

describe('P2 API Client & Mock Backbone', () => {
  it('retrieves deterministic AQI reading', async () => {
    const aqi = await getAqi(28.6472, 77.3058);
    expect(aqi).toBeDefined();
    expect(aqi.aqi).toBe(287);
    expect(aqi.category).toBe('Poor');
    expect(aqi.dominant_pollutant).toBe('PM2.5');
    expect(aqi.pm25).toBe(168);
  });

  it('retrieves upwind fire hotspots', async () => {
    const firesData = await getFires(28.6472, 77.3058, 10);
    expect(firesData.fires).toBeDefined();
    expect(firesData.fires.length).toBeGreaterThan(0);
    expect(firesData.fires[0].is_upwind).toBe(true);
  });

  it('retrieves school advisory for active campus', async () => {
    const advisory = await getSchoolAdvisory('school_demo_001', 'student');
    expect(advisory.school_name).toContain('Government Model School');
    expect(advisory.aqi).toBe(287);
    expect(advisory.outdoor_activities_permitted).toBe(false);
  });

  it('retrieves notifications feed', async () => {
    const notifs = await getNotifications();
    expect(Array.isArray(notifs)).toBe(true);
    expect(notifs.length).toBeGreaterThanOrEqual(3);
  });

  it('submits complaint and logs confirmation ticket', async () => {
    const response = await submitComplaint({
      category: 'Smoke',
      description: 'Open burning behind school boundary',
      latitude: 28.6472,
      longitude: 77.3058,
      reported_by_role: 'teacher',
    });
    expect(response.status).toBe('received');
    expect(response.ticket_id).toBeDefined();
    expect(response.ticket_id.startsWith('TKT-')).toBe(true);
  });
});
