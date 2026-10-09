// Saans Shala's school-day rules (src/config/school-rules.json) are the plan's go/no-go defaults, and
// the loader refuses rules that leave an AQI value without a band.
import { describe, expect, it } from 'vitest';

import raw from '../config/school-rules.json';
import { SCHOOL_RULES, parseSchoolRules } from '../config/schoolRules';

const pick = (from: number) => SCHOOL_RULES.bands.find((b) => b.from === from)!;

describe("the plan's school go/no-go defaults", () => {
  it('has the five AQI bands', () => {
    expect(SCHOOL_RULES.bands.map((b) => [b.from, b.to])).toEqual([[0, 100], [101, 200], [201, 300], [301, 400], [401, 500]]);
  });

  it('0–100: everything outdoors as normal', () => {
    expect(pick(0)).toMatchObject({ assembly: 'outdoors', pe: 'normal', recess: 'outdoors', classroomPurifiers: false, outdoorTrips: true, parentSms: 'none' });
  });

  it('101–200: still outdoors, light PE for children with asthma, purifiers on in classrooms', () => {
    expect(pick(101)).toMatchObject({ assembly: 'outdoors', pe: 'light_for_asthma', classroomPurifiers: true, outdoorTrips: true });
  });

  it('201–300: assembly and PE indoors, no outdoor trips', () => {
    expect(pick(201)).toMatchObject({ assembly: 'indoors', pe: 'indoors', recess: 'outdoors', outdoorTrips: false, parentSms: 'none' });
  });

  it('301–400: indoors, no recess outside, parent SMS, masks for the commute', () => {
    expect(pick(301)).toMatchObject({ assembly: 'indoors', pe: 'indoors', recess: 'indoors', parentSms: 'once', commuteMasks: true });
  });

  it('401+: follow the state order, parent SMS each morning', () => {
    expect(pick(401)).toMatchObject({ assembly: 'state_order', pe: 'state_order', parentSms: 'every_morning', commuteMasks: true });
  });

  it('what a band adds stays on in worse bands', () => {
    const order = SCHOOL_RULES.bands;
    for (let i = 1; i < order.length; i++) {
      if (order[i - 1].classroomPurifiers) expect(order[i].classroomPurifiers).toBe(true);
      if (!order[i - 1].outdoorTrips) expect(order[i].outdoorTrips).toBe(false);
      if (order[i - 1].commuteMasks) expect(order[i].commuteMasks).toBe(true);
    }
  });

  it('a heat index of 41 °C or more moves everything indoors', () => {
    expect(SCHOOL_RULES.heatIndex.indoorsAtOrAboveC).toBe(41);
  });
});

describe('the loader', () => {
  const bands = raw.bands;

  it('refuses a gap between bands', () => {
    const gap = { ...raw, bands: [bands[0], { ...bands[1], from: 102 }, ...bands.slice(2)] };
    expect(() => parseSchoolRules(gap)).toThrow('bands.1.from: must be 101');
  });

  it('refuses bands that stop short of 500', () => {
    expect(() => parseSchoolRules({ ...raw, bands: bands.slice(0, 4) })).toThrow('must reach AQI 500');
  });

  it('refuses an unknown decision', () => {
    const typo = { ...raw, bands: [{ ...bands[0], assembly: 'outside' }, ...bands.slice(1)] };
    expect(() => parseSchoolRules(typo)).toThrow('bands.0.assembly');
  });
});
