import { describe, expect, it, vi } from 'vitest';
import {
  getAqi,
  getFires,
  getSchoolAdvisory,
  submitComplaint,
  mapCategoryToCitizenType,
  generateIdempotencyKey,
  SUPPORTED_COMPLAINT_CATEGORIES,
} from '../lib/api';
import { buildAdvisory, findSchool } from '../app/shala/advisory';
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

describe('P2 G6 Complaint Category Mapping & Idempotency Audit', () => {
  it('maps supported UI categories to intentional backend CITIZEN_TYPES', () => {
    expect(mapCategoryToCitizenType('Smoke')).toBe('farm_fire');
    expect(mapCategoryToCitizenType('Stubble burning')).toBe('farm_fire');
    expect(mapCategoryToCitizenType('farm_fire')).toBe('farm_fire');
    expect(mapCategoryToCitizenType('Burning waste')).toBe('garbage');
    expect(mapCategoryToCitizenType('garbage')).toBe('garbage');
    expect(mapCategoryToCitizenType('Vehicle idling')).toBe('vehicle');
    expect(mapCategoryToCitizenType('vehicle')).toBe('vehicle');
    expect(mapCategoryToCitizenType('Firecrackers')).toBe('firecrackers');
    expect(mapCategoryToCitizenType('firecrackers')).toBe('firecrackers');
  });

  it('explicitly returns null for unsupported categories rather than silently mismapping', () => {
    expect(mapCategoryToCitizenType('Dust')).toBeNull();
    expect(mapCategoryToCitizenType('Industrial')).toBeNull();
    expect(mapCategoryToCitizenType('Industrial pollution')).toBeNull();
    expect(mapCategoryToCitizenType('Other')).toBeNull();
    expect(mapCategoryToCitizenType('Unknown hazard')).toBeNull();
    expect(mapCategoryToCitizenType('')).toBeNull();
    expect(mapCategoryToCitizenType(undefined)).toBeNull();
  });

  it('generates a stable, deterministic Idempotency-Key for unchanged retries', () => {
    const payloadA = {
      category: 'Smoke',
      description: 'Plume near north gate',
      lat: 30.245,
      lon: 75.842,
      school_id: 'school_demo_001',
    };

    const key1 = generateIdempotencyKey(payloadA);
    const key2 = generateIdempotencyKey(payloadA);

    expect(key1).toBe(key2);
    expect(key1.length).toBeGreaterThanOrEqual(6);
    expect(key1.length).toBeLessThanOrEqual(128);
    expect(key1.startsWith('idem-')).toBe(true);

    const payloadB = {
      ...payloadA,
      description: 'Plume near south gate',
    };
    const key3 = generateIdempotencyKey(payloadB);
    expect(key3).not.toBe(key1);
  });

  it('preserves caller-provided Idempotency-Key if valid', () => {
    const customKey = 'custom-key-123456';
    const key = generateIdempotencyKey({
      category: 'Smoke',
      description: 'Plume near gate',
      idempotency_key: customKey,
    });
    expect(key).toBe(customKey);
  });

  it('rejects unsupported categories with a descriptive error when submitting in live mode', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_USE_MOCKS;
    try {
      process.env.NEXT_PUBLIC_USE_MOCKS = 'false';

      await expect(
        submitComplaint({
          category: 'Dust',
          description: 'Heavy construction dust near playground',
          lat: 30.245,
          lon: 75.842,
        })
      ).rejects.toThrow(/Unsupported complaint category/);

      await expect(
        submitComplaint({
          category: 'Industrial',
          description: 'Chimney emissions from adjacent mill',
          lat: 30.245,
          lon: 75.842,
        })
      ).rejects.toThrow(/Unsupported complaint category/);
    } finally {
      process.env.NEXT_PUBLIC_USE_MOCKS = originalEnv;
    }
  });

  it('validates live submission reaches API endpoint with contract-compliant headers and body', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_USE_MOCKS;
    const originalBase = process.env.NEXT_PUBLIC_COMMAND_API_BASE_URL;

    let interceptedUrl = '';
    let interceptedOptions: RequestInit = {};

    const mockFetch = vi.fn().mockImplementation((url: string, options: RequestInit) => {
      interceptedUrl = url;
      interceptedOptions = options;
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'complaint_test_live_001', status: 'received' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    const originalGlobalFetch = global.fetch;
    global.fetch = mockFetch;

    try {
      process.env.NEXT_PUBLIC_USE_MOCKS = 'false';
      process.env.NEXT_PUBLIC_COMMAND_API_BASE_URL = 'http://localhost:3100';

      const res = await submitComplaint({
        category: 'Burning waste',
        description: 'Trash burning behind boundary wall',
        lat: 30.245,
        lon: 75.842,
        school_id: 'school_demo_001',
      });

      expect(res.status).toBe('received');
      expect(res.id).toBe('complaint_test_live_001');
      expect(res.ticket_id).toBe('complaint_test_live_001');
      expect(interceptedUrl).toBe('http://localhost:3100/v1/complaints');
      expect(interceptedOptions.method).toBe('POST');

      const headers = interceptedOptions.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Idempotency-Key']).toBeDefined();
      expect(headers['Idempotency-Key'].length).toBeGreaterThanOrEqual(6);
      expect(headers['Idempotency-Key'].length).toBeLessThanOrEqual(128);

      const parsedBody = JSON.parse(interceptedOptions.body as string);
      expect(parsedBody.type).toBe('garbage');
      expect(parsedBody.location).toEqual({ lat: 30.245, lon: 75.842 });
      expect(parsedBody.description).toBe('Trash burning behind boundary wall');
      expect(parsedBody.evidence).toEqual([]);
    } finally {
      process.env.NEXT_PUBLIC_USE_MOCKS = originalEnv;
      process.env.NEXT_PUBLIC_COMMAND_API_BASE_URL = originalBase;
      global.fetch = originalGlobalFetch;
    }
  });
});
