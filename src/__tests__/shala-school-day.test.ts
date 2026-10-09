// The principal's go/no-go (P2): the rules at every band edge and at the heat-index limit, the advisory
// in p2-shala.openapi.json's shape, and GET /v1/schools/{id}/advisory's answers.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildAdvisory, findSchool } from '../app/shala/advisory';
import { answerAdvisory } from '../app/shala/advisoryHttp';
import { AQI_FIXTURES } from '../app/shala/aqiFixtures';
import { CATEGORIES } from '../app/shala/airQuality';
import { schoolDay } from '../app/shala/schoolDay';

const spec = JSON.parse(readFileSync(join(__dirname, '../../packages/contracts/proposals/p2-shala.openapi.json'), 'utf8'));

type Schema = { $ref?: string; type?: string | string[]; enum?: unknown[]; required?: string[]; properties?: Record<string, Schema>; items?: Schema };

/** Enough of JSON Schema to check an answer against P2's contract: $ref, type, enum, required, properties, items. */
function problems(value: unknown, schema: Schema, path = '$'): string[] {
  if (schema.$ref) {
    if (schema.$ref.startsWith('./')) return [];
    return problems(value, spec.components.schemas[schema.$ref.split('/').pop()!], path);
  }
  const out: string[] = [];
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  if (types.length && !types.includes(kind) && !(kind === 'integer' && types.includes('number'))) out.push(`${path}: ${kind}, not ${types.join('|')}`);
  if (schema.enum && !schema.enum.includes(value)) out.push(`${path}: ${String(value)} not in ${schema.enum.join(', ')}`);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) out.push(`${path}.${key}: missing`);
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) out.push(...problems((value as Record<string, unknown>)[key], sub, `${path}.${key}`));
    }
  }
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => out.push(...problems(v, schema.items!, `${path}[${i}]`)));
  return out;
}

describe('the school day at every band edge', () => {
  it.each([
    [100, 'outdoors', 'normal', 'outdoors', true, 'go'],
    [101, 'outdoors', 'light_for_asthma', 'outdoors', true, 'caution'],
    [200, 'outdoors', 'light_for_asthma', 'outdoors', true, 'caution'],
    [201, 'indoors', 'indoors', 'outdoors', false, 'no_go'],
    [300, 'indoors', 'indoors', 'outdoors', false, 'no_go'],
    [301, 'indoors', 'indoors', 'indoors', false, 'no_go'],
    [400, 'indoors', 'indoors', 'indoors', false, 'no_go'],
    [401, 'state_order', 'state_order', 'indoors', false, 'no_go'],
  ])('AQI %i: assembly %s, PE %s, recess %s, trips %s, %s', (aqi, assembly, pe, recess, trips, decision) => {
    expect(schoolDay(aqi, null)).toMatchObject({ assembly, pe, recess, outdoor_trips: trips, decision, heat_override: false });
  });

  it('purifiers start at 101, parent SMS and commute masks at 301, SMS every morning from 401', () => {
    expect([100, 101].map((a) => schoolDay(a, null).classroom_purifiers)).toEqual([false, true]);
    expect([300, 301, 401].map((a) => schoolDay(a, null).parent_sms)).toEqual(['none', 'once', 'every_morning']);
    expect([300, 301].map((a) => schoolDay(a, null).commute_masks)).toEqual([false, true]);
  });

  it('severity and action code follow the decision', () => {
    expect([50, 150, 250, 350].map((a) => [schoolDay(a, null).severity, schoolDay(a, null).action_code])).toEqual([
      ['normal', 'normal_operations'],
      ['caution', 'limit_outdoor_exposure'],
      ['warning', 'suspend_outdoor_activities'],
      ['critical', 'suspend_outdoor_activities'],
    ]);
  });

  it('a heat index of 41 °C moves everything indoors; 40.9 °C does not', () => {
    expect(schoolDay(60, 40.9)).toMatchObject({ assembly: 'outdoors', pe: 'normal', recess: 'outdoors', outdoor_trips: true, heat_override: false, decision: 'go' });
    expect(schoolDay(60, 41)).toMatchObject({ assembly: 'indoors', pe: 'indoors', recess: 'indoors', outdoor_trips: false, heat_override: true, decision: 'no_go' });
  });

  it('heat leaves a state order alone, and changes nothing that was already indoors', () => {
    expect(schoolDay(450, 45)).toMatchObject({ assembly: 'state_order', pe: 'state_order', recess: 'indoors' });
    expect(schoolDay(350, 45).heat_override).toBe(false);
  });

  it('AQI is clamped to 0–500', () => {
    expect(schoolDay(-3, null).band).toEqual({ from: 0, to: 100 });
    expect(schoolDay(612, null).band).toEqual({ from: 401, to: 500 });
  });
});

describe('the advisory', () => {
  const school = findSchool('school_demo_001')!;
  const at = new Date('2026-10-08T04:00:00Z'); // 09:30 in India

  it.each(CATEGORIES)("matches P2's contract on a %s day", (category) => {
    const advisory = buildAdvisory(school, AQI_FIXTURES[category], at);
    expect(problems(advisory, spec.components.schemas.SchoolAdvisoryResponse)).toEqual([]);
  });

  it('the contract check does catch a wrong answer', () => {
    const advisory = buildAdvisory(school, AQI_FIXTURES.poor, at);
    const { summary: _summary, ...noSummary } = advisory;
    expect(problems({ ...advisory, severity: 'awful' }, spec.components.schemas.SchoolAdvisoryResponse)).toEqual(['$.severity: awful not in normal, caution, warning, critical']);
    expect(problems(noSummary, spec.components.schemas.SchoolAdvisoryResponse)).toEqual(['$.summary: missing']);
    expect(problems({ ...advisory, school_day: { ...advisory.school_day, recess: 'roof' } }, spec.components.schemas.SchoolAdvisoryResponse)).toHaveLength(1);
  });

  it('is issued now and lasts until 18:00 India time', () => {
    const advisory = buildAdvisory(school, AQI_FIXTURES.poor, at);
    expect([advisory.issued_at, advisory.valid_until]).toEqual(['2026-10-08T09:30:00+05:30', '2026-10-08T18:00:00+05:30']);
    expect(buildAdvisory(school, AQI_FIXTURES.poor, new Date('2026-10-08T13:00:00Z')).valid_until).toBe('2026-10-09T18:00:00+05:30');
  });

  it('carries the school day and agrees with it', () => {
    const a = buildAdvisory(school, AQI_FIXTURES.very_poor, at);
    expect(a.school_day).toMatchObject({ aqi: 348, recess: 'indoors', parent_sms: 'once', decision: 'no_go' });
    expect([a.assembly_permitted, a.outdoor_activities_permitted, a.mask_recommended, a.role_advisories.principal.decision]).toEqual([false, false, true, 'no_go']);
  });

  it('uses the heat index from the reading', () => {
    expect(buildAdvisory(school, AQI_FIXTURES.severe, at).school_day.heat_index_c).toBe(45.9);
  });
});

describe('GET /v1/schools/{id}/advisory', () => {
  const url = (q = '') => new URL(`http://saans.test/v1/schools/school_demo_001/advisory${q}`);
  const air = async () => AQI_FIXTURES.poor;

  it('answers with the advisory', async () => {
    const res = await answerAdvisory('school_demo_001', url('?role=principal'), air, new Date('2026-10-08T04:00:00Z'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(problems(body, spec.components.schemas.SchoolAdvisoryResponse)).toEqual([]);
    expect(body.school_day.decision).toBe('no_go');
  });

  it('404s an unknown school, 422s an unknown role, 503s when P3 has no reading', async () => {
    const r404 = await answerAdvisory('school_999', url(), air);
    const r422 = await answerAdvisory('school_demo_001', url('?role=janitor'), air);
    const r503 = await answerAdvisory('school_demo_001', url(), async () => null);
    const r503b = await answerAdvisory('school_demo_001', url(), async () => { throw new Error('down'); });
    expect([r404.status, r422.status, r503.status, r503b.status]).toEqual([404, 422, 503, 503]);
    expect((await r404.json()).error.code).toBe('not_found');
    expect((await r422.json()).error.details[0].field).toBe('query.role');
    expect((await r503.json()).error.code).toBe('sources_unavailable');
  });
});
