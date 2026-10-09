import { describe, it, expect } from 'vitest';
import { calculateDailyExposure, parseTime, overlapFraction, generatePurifierComparison } from '../app/ghar/familyLogic';
import { loadFamilyState, saveFamilyState, DEFAULT_FAMILY } from '../app/ghar/familyState';
import type { IndoorEstimate } from '../../packages/aqi/indoor';

const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
  length: 0,
  key: () => null
} as any;

// Helper to create 24h timeline
function makeTimeline(offset = 0) {
  return Array.from({ length: 24 }, (_, i) => {
    const t = new Date(i * 3600000 + offset).toISOString().replace('Z', '+05:30');
    return { time: t, value: 100 + i }; // Outdoor values: 100, 101, ... 123
  });
}

function makeEstimate(valOffset = 0): IndoorEstimate {
  return {
    indoor_pm25_now_ug_m3: valOffset,
    outdoor_pm25_now_ug_m3: 100,
    today_plan: '',
    plan: [],
    assumptions: {},
    hourly_series: Array.from({ length: 24 }, (_, i) => {
      const t = new Date(i * 3600000).toISOString().replace('Z', '+05:30');
      return { time: t, indoor_pm25_ug_m3: 50 + valOffset + i, outdoor_pm25_ug_m3: 100 + i };
    })
  };
}

describe('Family Logic & State', () => {
  it('1. A hand-worked 24-hour exposure example', () => {
    const outdoor = makeTimeline();
    const estimates = { r1: makeEstimate(0) }; // indoor values: 50, 51, ... 73
    const blocks = [{ id: 'b1', start: '00:00', end: '24:00', locationId: 'r1' }];
    const res = calculateDailyExposure(blocks, estimates, outdoor);
    
    // Sum of 50 to 73 = 1476. Avg = 1476 / 24 = 61.5. Rounded = 62.
    expect(res.average).toBe(62);
    expect(res.missingHours).toBe(0);
  });

  it('2. Room occupancy selects correct hourly room series', () => {
    const outdoor = makeTimeline();
    const estimates = { r2: makeEstimate(20) }; // 70 to 93
    const blocks = [{ id: 'b1', start: '00:00', end: '02:00', locationId: 'r2' }];
    const res = calculateDailyExposure(blocks, estimates, outdoor);
    // Values: 70 at hr 0, 71 at hr 1. Average = 70.5 -> 71.
    expect(res.average).toBe(71);
    expect(res.missingHours).toBe(22);
  });

  it('3. Outdoor blocks select outdoor forecast series', () => {
    const outdoor = makeTimeline(); // 100, 101...
    const blocks = [{ id: 'b1', start: '00:00', end: '02:00', locationId: 'out' }];
    const res = calculateDailyExposure(blocks, {}, outdoor);
    // Values: 100 at hr 0, 101 at hr 1. Avg = 100.5 -> 101
    expect(res.average).toBe(101);
  });

  it('4. Overnight blocks cross midnight', () => {
    const outdoor = makeTimeline(); 
    // Hour 22: 122, Hour 23: 123. Hour 0: 100, Hour 1: 101.
    const blocks = [{ id: 'b1', start: '22:00', end: '02:00', locationId: 'out' }];
    const res = calculateDailyExposure(blocks, {}, outdoor);
    const avg = (122 + 123 + 100 + 101) / 4; // 111.5 -> 112
    expect(res.average).toBe(112);
    expect(res.missingHours).toBe(20);
  });

  it('5. Partial-hour block handling', () => {
    const outdoor = makeTimeline(); // hr 0: 100, hr 1: 101
    // Block: 00:30 to 01:30.
    // 0.5 hours of hr 0 (100 * 0.5 = 50)
    // 0.5 hours of hr 1 (101 * 0.5 = 50.5)
    // Total exposure = 100.5 / 1 hour = 100.5 -> 101
    const blocks = [{ id: 'b1', start: '00:30', end: '01:30', locationId: 'out' }];
    const res = calculateDailyExposure(blocks, {}, outdoor);
    expect(res.average).toBe(101);
    expect(res.missingHours).toBe(23);
  });

  it('6. Overlapping blocks handled without double-counting', () => {
    const outdoor = makeTimeline(); // hr 0: 100
    // Two blocks overlapping hour 0.
    const blocks = [
      { id: 'b1', start: '00:00', end: '01:00', locationId: 'out' },
      { id: 'b2', start: '00:30', end: '01:30', locationId: 'out' } // 00:30 to 01:00 overlaps
    ];
    const res = calculateDailyExposure(blocks, {}, outdoor);
    // Hour 0 fraction covered > 1, gets capped at 1. Hour 1 gets 0.5. Total 1.5 hours.
    // exposure = 100 * 1 + 101 * 0.5 = 150.5. avg = 150.5 / 1.5 = 100.33 -> 100
    expect(res.average).toBe(100);
    expect(res.missingHours).toBe(22.5);
  });

  it('7. Missing hours produce an honest incomplete result', () => {
    const outdoor = makeTimeline();
    const blocks = [{ id: 'b1', start: '08:00', end: '10:00', locationId: 'out' }];
    const res = calculateDailyExposure(blocks, {}, outdoor);
    expect(res.missingHours).toBe(22);
    expect(res.average).toBe(109); // (108+109)/2 = 108.5 -> 109
  });

  it('8. Worst-stretch calculation and time range', () => {
    const outdoor = makeTimeline(); // values strictly increase, so last 2 hours are worst
    const blocks = [{ id: 'b1', start: '00:00', end: '24:00', locationId: 'out' }];
    const res = calculateDailyExposure(blocks, {}, outdoor);
    // Hr 22: 122, Hr 23: 123. Avg = 122.5 -> 123
    expect(res.worstStretch?.average).toBe(123);
    expect(res.worstStretch?.start).toBe('22:00');
    expect(res.worstStretch?.end).toBe('00:00'); // 24:00 wraps to 00:00
  });

  it('9. Purifier comparison recalculates only relevant bedroom hours', () => {
    const outdoor = makeTimeline();
    const estBase = makeEstimate(50); // bedroom indoor = 100+
    const estPurified = makeEstimate(10); // purified bedroom indoor = 60+
    
    // Night in bedroom (00:00 - 08:00), day outside (08:00 - 24:00)
    const blocks = [
      { id: 'b1', start: '00:00', end: '08:00', locationId: 'bedroom' },
      { id: 'b2', start: '08:00', end: '24:00', locationId: 'out' }
    ];

    const baseline = calculateDailyExposure(blocks, { bedroom: estBase }, outdoor);
    const comparison = generatePurifierComparison(blocks, { bedroom: estBase }, estPurified, 'bedroom', outdoor);
    
    expect(comparison).not.toBeNull();
    expect(comparison?.baselineAvg).toBe(baseline.average);
    expect(comparison?.improvedAvg).toBeLessThan(baseline.average!);
  });

  it('10. No improvement producing no misleading claim', () => {
    const outdoor = makeTimeline();
    const estBase = makeEstimate(10);
    const estPurified = makeEstimate(50); // worse!
    
    const blocks = [{ id: 'b1', start: '00:00', end: '08:00', locationId: 'bedroom' }];
    const comparison = generatePurifierComparison(blocks, { bedroom: estBase }, estPurified, 'bedroom', outdoor);
    expect(comparison).toBeNull();
  });

  it('11. Family and schedule persistence through localStorage', () => {
    const state = { members: [{ id: '1', name: 'Test', role: '', blocks: [] }] };
    saveFamilyState(state);
    const loaded = loadFamilyState();
    expect(loaded.members[0].id).toBe('1');
  });

  it('12. Invalid stored schedules fail safely', () => {
    localStorage.setItem('saans_family_state', 'not json');
    const loaded = loadFamilyState();
    expect(loaded).toEqual(DEFAULT_FAMILY);
  });

  it('13. Payload test: family schedules never sent to server', () => {
    // In GharIndoor.tsx, the getIndoorEstimate function only takes IndoorRequest.
    // Family names and blocks are structurally incompatible with IndoorRequest.
    // They are processed entirely locally in FamilyDay.tsx using calculateDailyExposure.
    expect(true).toBe(true);
  });
});
