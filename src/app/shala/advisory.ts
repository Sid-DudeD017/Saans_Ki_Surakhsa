// GET /v1/schools/{id}/advisory (P2): today's advisory for a school, built from P3's AQI reading and the
// school rules, in p2-shala.openapi.json's SchoolAdvisoryResponse. The app's mock mode builds the same
// answer from the AQI fixtures, so the mock and the real one can't disagree.
import type { components } from '../../../packages/contracts/types';
import schools from '../../config/schools.json';
import type { AqiResponse } from './airQuality';
import { schoolDay, type SchoolDay } from './schoolDay';

export type SchoolAdvisory = components['schemas']['SchoolAdvisoryResponse'];
export type SchoolIdentity = components['schemas']['SchoolIdentity'];
type RoleAdvisory = components['schemas']['RoleAdvisoryItem'];

export const SCHOOLS: (SchoolIdentity & { demo?: boolean })[] = schools.schools;

export function findSchool(id: string) {
  return SCHOOLS.find((s) => s.id === id) ?? null;
}

const IST_MS = 330 * 60_000;

/** "2026-10-08T09:30:00+05:30" for a moment, in India time. */
function india(at: Date) {
  return new Date(at.getTime() + IST_MS).toISOString().replace(/\.\d{3}Z$/, '+05:30');
}

/** The advisory lasts until 18:00 India time on the day it was issued (or the next day, after 18:00). */
function endOfSchoolDay(now: Date) {
  const local = new Date(now.getTime() + IST_MS);
  const end = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 18) - IST_MS;
  return new Date(end > now.getTime() ? end : end + 86_400_000);
}

const CATEGORY = { good: 'Good', satisfactory: 'Satisfactory', moderate: 'Moderate', poor: 'Poor', very_poor: 'Very poor', severe: 'Severe' } as const;

function where(v: string) {
  return v === 'state_order' ? 'as the state order says' : v === 'light_for_asthma' ? 'outdoors, light for children with asthma' : v;
}

function principalItems(day: SchoolDay): string[] {
  return [
    `Assembly: ${where(day.assembly)}`,
    `PE: ${where(day.pe === 'normal' ? 'outdoors' : day.pe)}`,
    `Recess: ${day.recess}`,
    day.outdoor_trips ? 'Outdoor trips can go ahead' : 'No outdoor trips today',
    day.classroom_purifiers ? 'Purifiers on in every classroom' : 'Purifiers not needed',
    day.parent_sms === 'every_morning' ? 'Text parents every morning' : day.parent_sms === 'once' ? 'Text parents today' : 'No parent SMS needed',
    ...(day.heat_override ? ['Heat index is too high: everything moves indoors'] : []),
  ];
}

function roles(day: SchoolDay, category: keyof typeof CATEGORY): SchoolAdvisory['role_advisories'] {
  const outside = day.recess === 'outdoors' && day.pe !== 'indoors' && day.pe !== 'state_order';
  const masks = day.commute_masks;
  const student: RoleAdvisory = {
    title: 'Air Buddy Student Advisory',
    summary: outside ? 'You can play outside today. Rest if you start to cough.' : 'Play inside today and keep the windows shut.',
    mask_recommended: masks,
    outdoor_activities_permitted: outside,
    action_items: [
      ...(masks ? ['Wear your mask on the way to and from school'] : []),
      'Drink water through the day',
      'Tell your teacher if you smell burning or find it hard to breathe',
    ],
  };
  const teacher: RoleAdvisory = {
    title: 'Teacher Classroom Advisory',
    summary: `Assembly ${where(day.assembly)}, PE ${where(day.pe === 'normal' ? 'outdoors' : day.pe)}, recess ${day.recess}.`,
    mask_recommended: masks,
    outdoor_activities_permitted: outside,
    action_items: [
      ...(day.classroom_purifiers ? ['Keep the classroom purifier on and the windows shut'] : []),
      'Watch children with asthma or other breathing conditions',
      ...(day.outdoor_trips ? [] : ['Postpone outdoor trips']),
    ],
  };
  const parent: RoleAdvisory = {
    title: 'Parent Commute & Health Advisory',
    summary: `Air quality is ${CATEGORY[category]} (AQI ${day.aqi}).${masks ? ' Send your child with a well-fitting mask for the commute.' : ''}`,
    mask_recommended: masks,
    outdoor_activities_permitted: outside,
    action_items: [
      ...(masks ? ['A well-fitting N95 mask for the commute'] : []),
      'Pack any prescribed inhaler',
      ...(outside ? [] : ['Keep evening play indoors until the air improves']),
    ],
  };
  return {
    student,
    teacher,
    parent,
    principal: {
      title: 'Principal Go/No-Go Decision',
      summary: day.decision === 'go' ? 'Normal school day.' : day.decision === 'caution' ? 'Outdoors, with care.' : 'Keep the school day indoors.',
      decision: day.decision,
      assembly_permitted: day.assembly === 'outdoors',
      outdoor_activities_permitted: outside,
      mask_mandated: false,
      action_items: principalItems(day),
    },
  };
}

export function buildAdvisory(school: SchoolIdentity, air: AqiResponse, now = new Date()): SchoolAdvisory & { school_day: SchoolDay } {
  const day = schoolDay(air.aqi, air.weather?.heat_index_c ?? null);
  const outside = day.recess === 'outdoors' && day.pe !== 'indoors' && day.pe !== 'state_order';
  return {
    school: { id: school.id, name: school.name, district: school.district, location: school.location },
    aqi: air.aqi,
    category: air.category,
    dominant_pollutant: air.dominant_pollutant,
    grap_stage: air.grap_stage,
    severity: day.severity,
    action_code: day.action_code,
    outdoor_activities_permitted: outside,
    assembly_permitted: day.assembly === 'outdoors',
    mask_recommended: day.commute_masks,
    summary: `${school.name}: AQI ${air.aqi} (${CATEGORY[air.category]}). ${principalItems(day).slice(0, 3).join('. ')}.`,
    issued_at: india(now),
    valid_until: india(endOfSchoolDay(now)),
    role_advisories: roles(day, air.category),
    school_day: day,
  };
}
