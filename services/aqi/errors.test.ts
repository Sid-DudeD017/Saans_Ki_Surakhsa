// P3's routes answer every error in P4's ErrorEnvelope. None of these cases reaches the network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { GET as getAqi } from '../../src/app/v1/aqi/route';
import { GET as getFires } from '../../src/app/v1/fires/route';

const p4 = readFileSync(join(__dirname, '../../packages/contracts/proposals/p4-command.openapi.yaml'), 'utf8');
const p4Codes = [...p4.split('    ErrorCode:')[1].split('    ErrorDetail:')[0].matchAll(/^\s+- (\w+)$/gm)].map((m) => m[1]);

async function errorOf(res: Response) {
  const body = await res.json();
  expect(Object.keys(body)).toEqual(['error']);
  expect(p4Codes).toContain(body.error.code);
  expect(typeof body.error.message).toBe('string');
  return body.error;
}

describe('P3 errors are P4 ErrorEnvelopes', () => {
  const savedKey = process.env.NASA_FIRMS_MAP_KEY;
  afterEach(() => {
    if (savedKey === undefined) delete process.env.NASA_FIRMS_MAP_KEY;
    else process.env.NASA_FIRMS_MAP_KEY = savedKey;
  });

  it('a missing lat says which field', async () => {
    const res = await getAqi(new Request('http://saans.test/v1/aqi?lon=76.04'));
    expect(res.status).toBe(422);
    const error = await errorOf(res);
    expect(error.code).toBe('invalid_request');
    expect(error.details).toEqual([{ field: 'query.lat', problem: 'required' }]);
  });

  it('a lon that is not a number says which field', async () => {
    const res = await getAqi(new Request('http://saans.test/v1/aqi?lat=30.2&lon=east'));
    expect(res.status).toBe(422);
    expect((await errorOf(res)).details).toEqual([{ field: 'query.lon', problem: 'must be a number' }]);
  });

  it('fires without a bbox', async () => {
    const res = await getFires(new Request('http://saans.test/v1/fires'));
    expect(res.status).toBe(422);
    expect((await errorOf(res)).details).toEqual([
      { field: 'query.bbox', problem: 'required unless lat, lon and radius_km are given' },
    ]);
  });

  it('a half-given point-radius search names the missing fields', async () => {
    const res = await getFires(new Request('http://saans.test/v1/fires?lat=30.27'));
    expect(res.status).toBe(422);
    expect((await errorOf(res)).details).toEqual([
      { field: 'query.lon', problem: 'required' },
      { field: 'query.radius_km', problem: 'required' },
    ]);
  });

  it('fires without a FIRMS key are sources_unavailable', async () => {
    delete process.env.NASA_FIRMS_MAP_KEY;
    const res = await getFires(new Request('http://saans.test/v1/fires?bbox=75.99,30.22,76.09,30.31'));
    expect(res.status).toBe(503);
    expect((await errorOf(res)).code).toBe('sources_unavailable');
  });
});
