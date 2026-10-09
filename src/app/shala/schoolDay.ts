// Today's go/no-go for a school (P2): the AQI picks a band from src/config/school-rules.json, and a heat
// index at or above the configured limit moves everything indoors. No band is written here.
import { SCHOOL_RULES, type SchoolBand, type SchoolRules } from '../../config/schoolRules';

export type Decision = 'go' | 'caution' | 'no_go';
export type Severity = 'normal' | 'caution' | 'warning' | 'critical';
export type ActionCode = 'normal_operations' | 'limit_outdoor_exposure' | 'suspend_outdoor_activities';

export interface SchoolDay {
  aqi: number;
  heat_index_c: number | null;
  /** The AQI band's range, as in the config. */
  band: { from: number; to: number };
  assembly: SchoolBand['assembly'];
  pe: SchoolBand['pe'];
  recess: SchoolBand['recess'];
  classroom_purifiers: boolean;
  outdoor_trips: boolean;
  parent_sms: SchoolBand['parentSms'];
  commute_masks: boolean;
  /** True when the heat index, not the AQI, moved something indoors. */
  heat_override: boolean;
  decision: Decision;
  severity: Severity;
  action_code: ActionCode;
}

export function bandFor(aqi: number, rules: SchoolRules = SCHOOL_RULES): SchoolBand {
  const value = Math.max(0, Math.min(500, Math.round(aqi)));
  const band = rules.bands.find((b) => value >= b.from && value <= b.to);
  if (!band) throw new Error(`no school band for AQI ${aqi}`);
  return band;
}

export function schoolDay(aqi: number, heatIndexC: number | null, rules: SchoolRules = SCHOOL_RULES): SchoolDay {
  const band = bandFor(aqi, rules);
  const hot = heatIndexC !== null && heatIndexC >= rules.heatIndex.indoorsAtOrAboveC;
  const indoors = <T extends string>(v: T) => (hot && v !== 'state_order' ? 'indoors' : v);
  const assembly = indoors(band.assembly) as SchoolBand['assembly'];
  const pe = indoors(band.pe) as SchoolBand['pe'];
  const recess = indoors(band.recess) as SchoolBand['recess'];
  const heatOverride = hot && (assembly !== band.assembly || pe !== band.pe || recess !== band.recess || band.outdoorTrips);

  const allOut = assembly === 'outdoors' && pe === 'normal' && recess === 'outdoors';
  const partlyOut = assembly === 'outdoors' && recess === 'outdoors';
  const decision: Decision = allOut ? 'go' : partlyOut ? 'caution' : 'no_go';
  const severity: Severity =
    band.parentSms !== 'none' ? 'critical' : decision === 'no_go' ? 'warning' : decision === 'caution' ? 'caution' : 'normal';
  const action_code: ActionCode =
    decision === 'go' ? 'normal_operations' : decision === 'caution' ? 'limit_outdoor_exposure' : 'suspend_outdoor_activities';

  return {
    aqi,
    heat_index_c: heatIndexC,
    band: { from: band.from, to: band.to },
    assembly,
    pe,
    recess,
    classroom_purifiers: band.classroomPurifiers,
    outdoor_trips: band.outdoorTrips && !hot,
    parent_sms: band.parentSms,
    commute_masks: band.commuteMasks,
    heat_override: heatOverride,
    decision,
    severity,
    action_code,
  };
}
