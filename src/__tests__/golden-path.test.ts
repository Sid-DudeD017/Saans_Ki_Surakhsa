import { describe, expect, it } from 'vitest';
import { getAqi, getFires, getSchoolAdvisory, submitComplaint } from '../lib/api';
import { SCHOOLS, buildAdvisory, findSchool } from '../app/shala/advisory';
import { AQI_FIXTURES } from '../app/shala/aqiFixtures';
import { parseComplaint } from '../../services/command-api/inputs';

describe('P2 Gate 6 Golden Path Integration', () => {
  it('Golden Path Step 1: Fetches air quality data for demo corridor', async () => {
    const aqi = await getAqi(30.245, 75.842);
    expect(aqi).toBeDefined();
    expect(aqi.aqi).toBeGreaterThan(0);
    expect(aqi.category).toBeDefined();
    expect(aqi.dominant_pollutant).toBeDefined();
  });

  it('Golden Path Step 2: Detects upwind fire events impacting campus', async () => {
    const fireData = await getFires(30.245, 75.842, 25);
    expect(fireData).toBeDefined();
    expect(fireData.fires.length).toBeGreaterThan(0);
    expect(fireData.fires[0].is_upwind).toBe(true);
  });

  it('Golden Path Step 3: Generates school-specific advisory for demo school', async () => {
    const school = findSchool('school_demo_001');
    expect(school).not.toBeNull();

    const reading = AQI_FIXTURES.poor;
    const advisory = buildAdvisory(school!, reading);

    expect(advisory.school.id).toBe('school_demo_001');
    expect(advisory.grap_stage).toBe('stage_1');
    expect(advisory.role_advisories.student).toBeDefined();
    expect(advisory.role_advisories.principal).toBeDefined();
    expect(advisory.outdoor_activities_permitted).toBe(false);
  });

  it('Golden Path Step 4: Gets school advisory via client API', async () => {
    const advisoryData = await getSchoolAdvisory('school_demo_001', 'principal');
    expect(advisoryData).toBeDefined();
    expect(advisoryData.school_id).toBe('school_demo_001');
    expect(advisoryData.grap_stage).toBeDefined();
    expect(advisoryData.summary).toBeDefined();
  });

  it('Golden Path Step 5: Submits smoke incident complaint report and obtains receipt ticket', async () => {
    const complaint = await submitComplaint({
      category: 'Smoke',
      description: 'Stubble burning smoke visible northeast of demo school boundary',
      latitude: 30.245,
      longitude: 75.842,
      reported_by_role: 'principal',
      school_id: 'school_demo_001',
    });

    expect(complaint.status).toBe('received');
    expect(complaint.ticket_id).toBeDefined();
    expect(complaint.id).toBeDefined();
    expect(complaint.message).toContain('Report submitted successfully');
  });

  it('Golden Path Step 6: Verifies complaint payload structure satisfies P4 backend contract', () => {
    const validCitizenComplaint = {
      type: 'farm_fire',
      location: { lat: 30.245, lon: 75.842 },
      description: 'Smoke plume detected upwind from school campus',
      evidence: [],
    };

    const parsed = parseComplaint(validCitizenComplaint);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe('farm_fire');
      expect(parsed.data.location.lat).toBe(30.245);
      expect(parsed.data.location.lon).toBe(75.842);
      expect(parsed.data.evidence).toEqual([]);
    }
  });
});
