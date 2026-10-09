// Saans Shala's school-day rules (P2), read from school-rules.json and checked when loaded: the bands
// must cover AQI 0–500 with no gap or overlap. Edit the JSON, not this file.
import { z } from 'zod';

import raw from './school-rules.json';

const Band = z.strictObject({
  from: z.int().min(0).max(500),
  to: z.int().min(0).max(500),
  assembly: z.enum(['outdoors', 'indoors', 'state_order']),
  pe: z.enum(['normal', 'light_for_asthma', 'indoors', 'state_order']),
  recess: z.enum(['outdoors', 'indoors']),
  classroomPurifiers: z.boolean(),
  outdoorTrips: z.boolean(),
  parentSms: z.enum(['none', 'once', 'every_morning']),
  commuteMasks: z.boolean(),
});
export type SchoolBand = z.infer<typeof Band>;

const Rules = z
  .looseObject({
    bands: z.array(Band).min(1),
    heatIndex: z.strictObject({ indoorsAtOrAboveC: z.number().min(25).max(60) }),
  })
  .superRefine((rules, ctx) => {
    let next = 0;
    rules.bands.forEach((band, i) => {
      if (band.from !== next) ctx.addIssue({ code: 'custom', path: ['bands', i, 'from'], message: `must be ${next}, right after the band before` });
      if (band.to < band.from) ctx.addIssue({ code: 'custom', path: ['bands', i, 'to'], message: 'must not be below from' });
      next = band.to + 1;
    });
    if (next !== 501) ctx.addIssue({ code: 'custom', path: ['bands'], message: 'must reach AQI 500' });
  });
export type SchoolRules = z.infer<typeof Rules>;

/** Parses and checks a rules object; throws with the field that's wrong. */
export function parseSchoolRules(input: unknown): SchoolRules {
  const result = Rules.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`school-rules.json: ${issue.path.join('.')}: ${issue.message}`);
  }
  return result.data;
}

export const SCHOOL_RULES: SchoolRules = parseSchoolRules(raw);
