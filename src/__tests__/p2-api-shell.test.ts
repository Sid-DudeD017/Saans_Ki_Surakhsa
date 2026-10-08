import fs from 'fs';
import path from 'path';
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

  it('submits complaint with canonical lat/lon coordinates', async () => {
    const response = await submitComplaint({
      category: 'Dust',
      description: 'Heavy construction dust near campus entrance',
      lat: 30.245,
      lon: 75.842,
      reported_by_role: 'principal',
      school_id: 'school_demo_001',
    });
    expect(response.status).toBe('received');
    expect(response.ticket_id).toBeDefined();
    expect(response.message).toContain('Report submitted successfully');
  });
});

describe('P2 G2 Contract Specification (p2-shala.openapi.json)', () => {
  const contractPath = path.resolve(
    __dirname,
    '../../packages/contracts/proposals/p2-shala.openapi.json'
  );
  const rawContract = fs.readFileSync(contractPath, 'utf-8');
  const contract = JSON.parse(rawContract);

  it('validates contract header and version', () => {
    expect(contract.openapi).toBe('3.1.0');
    expect(contract.info.title).toBe('Saans Shala API');
    expect(contract.info.version).toBe('1.0.0');
  });

  it('declares GET /v1/schools/{id}/advisory endpoint with id parameter', () => {
    const advisoryPath = contract.paths['/v1/schools/{id}/advisory'];
    expect(advisoryPath).toBeDefined();
    expect(advisoryPath.get).toBeDefined();

    const idParam = advisoryPath.get.parameters.find(
      (p: { name: string; in: string }) => p.name === 'id' && p.in === 'path'
    );
    expect(idParam).toBeDefined();
    expect(idParam.required).toBe(true);

    const okResponse = advisoryPath.get.responses['200'];
    expect(okResponse).toBeDefined();
    expect(
      okResponse.content['application/json'].schema.$ref
    ).toBe('#/components/schemas/SchoolAdvisoryResponse');
  });

  it('declares POST /v1/schools/{id}/alerts/subscribe endpoint with requestBody and 201 response', () => {
    const subscribePath =
      contract.paths['/v1/schools/{id}/alerts/subscribe'];
    expect(subscribePath).toBeDefined();
    expect(subscribePath.post).toBeDefined();

    const idParam = subscribePath.post.parameters.find(
      (p: { name: string; in: string }) => p.name === 'id' && p.in === 'path'
    );
    expect(idParam).toBeDefined();
    expect(idParam.required).toBe(true);

    expect(subscribePath.post.requestBody.required).toBe(true);
    expect(
      subscribePath.post.requestBody.content['application/json'].schema.$ref
    ).toBe('#/components/schemas/AlertSubscriptionRequest');

    const createdResponse = subscribePath.post.responses['201'];
    expect(createdResponse).toBeDefined();
    expect(
      createdResponse.content['application/json'].schema.$ref
    ).toBe('#/components/schemas/AlertSubscriptionResponse');
  });

  it('strictly adheres to lat/lon coordinates convention', () => {
    const locSchema = contract.components.schemas.Location;
    expect(locSchema).toBeDefined();
    expect(locSchema.required).toEqual(['lat', 'lon']);
    expect(locSchema.properties.lat).toBeDefined();
    expect(locSchema.properties.lon).toBeDefined();
    expect(locSchema.properties.lng).toBeUndefined();
    expect(locSchema.properties.latitude).toBeUndefined();
    expect(locSchema.properties.longitude).toBeUndefined();
  });

  it('strictly enforces lowercase wire enum codes per CONVENTIONS.md', () => {
    const schemas = contract.components.schemas;
    expect(schemas.AqiCategory.enum).toEqual([
      'good',
      'satisfactory',
      'moderate',
      'poor',
      'very_poor',
      'severe',
    ]);
    expect(schemas.GrapStage.enum).toEqual([
      'none',
      'stage_1',
      'stage_2',
      'stage_3',
      'stage_4',
    ]);
    expect(schemas.PrincipalDecision.enum).toEqual(['go', 'caution', 'no_go']);
  });
});
