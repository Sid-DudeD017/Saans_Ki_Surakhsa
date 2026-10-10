// The demo-mode copy of the coverage engine (src/app/kisan/coverage.ts) against the 14 hand-worked
// cases in services/agent-kisan/tests/test_coverage.py, so the copy can't drift from the real engine.
import { describe, expect, it } from 'vitest';

import { coverageResponse, estimateCoverage } from '../app/kisan/coverage';

describe('coverage engine copy matches coverage.py', () => {
  it('01 Gurpreet', () => {
    const r = estimateCoverage(18, 20, { super_seeder: 2 });
    expect([r.coveragePct, r.coveredAcres, r.gapAcres, r.strawT, r.pm25Kg]).toEqual([61, 11, 7, 17.5, 140]);
    expect([r.tractorDaysUsed, r.tractorDaysAvailable]).toEqual([2, 20]);
  });
  it('02 machine days capped at the window', () => {
    const r = estimateCoverage(500, 20, { happy_seeder: 30 }, { tractors: 3 });
    expect(r.machineDaysUsed.happy_seeder).toBe(20);
    expect(r.coveredAcres).toBe(140);
  });
  it('03 decomposer ignored in a short window', () => {
    expect(estimateCoverage(18, 20, {}, { decomposerAcres: 10 }).coveredAcres).toBe(0);
  });
  it('04 decomposer counted in a 25-day window', () => {
    const r = estimateCoverage(18, 25, {}, { decomposerAcres: 10 });
    expect([r.coveredAcres, r.coveragePct]).toEqual([10, 56]);
  });
  it('05 over-covered caps at 100 and stops early', () => {
    const r = estimateCoverage(10, 20, { happy_seeder: 5 });
    expect([r.coveragePct, r.gapAcres]).toEqual([100, 0]);
    expect(r.tractorDaysUsed).toBeCloseTo(10 / 7);
  });
  it('06 zero paddy', () => {
    const r = estimateCoverage(0, 20, { super_seeder: 2 });
    expect([r.coverage, r.gapAcres]).toEqual([0, 0]);
  });
  it('07 no machines', () => {
    const r = estimateCoverage(18, 20);
    expect([r.gapAcres, r.strawT, r.pm25Kg]).toEqual([18, 45, 360]);
  });
  it('08 hectares, already converted', () => {
    expect(estimateCoverage(9.8842, 20, { super_seeder: 1 }).gapAcres).toBeCloseTo(9.8842 - 5.5);
  });
  it('09 two machines, two tractors add up', () => {
    expect(estimateCoverage(100, 20, { happy_seeder: 2, super_seeder: 2 }, { tractors: 2 }).coveredAcres).toBe(14 + 11);
  });
  it('10 negative acres rejected', () => {
    expect(() => estimateCoverage(-5, 20)).toThrow();
  });
  it('11 one tractor shares its days', () => {
    const r = estimateCoverage(400, 20, { happy_seeder: 15, baler: 15 }, { tractors: 1 });
    expect(r.machineDaysUsed).toEqual({ baler: 15, happy_seeder: 5 });
    expect([r.coveredAcres, r.tractorDaysUsed]).toEqual([260, 20]);
  });
  it('12 a second tractor lifts the limit', () => {
    expect(estimateCoverage(400, 20, { happy_seeder: 15, baler: 15 }, { tractors: 2 }).coveredAcres).toBe(330);
  });
  it('13 rain days shrink the window', () => {
    const r = estimateCoverage(500, 20, { happy_seeder: 20 }, { rainDays: 5 });
    expect([r.workDays, r.coveredAcres]).toEqual([15, 105]);
  });
  it('14 no tractor: only the decomposer counts', () => {
    const r = estimateCoverage(18, 25, { happy_seeder: 3 }, { tractors: 0, decomposerAcres: 5 });
    expect([r.coveredAcres, r.tractorDaysUsed]).toEqual([5, 0]);
  });
  it('two of the same machine need two tractors', () => {
    expect(estimateCoverage(400, 20, { super_seeder: 40 }, { tractors: 2, machineUnits: { super_seeder: 2 } }).coveredAcres).toBe(220);
    expect(estimateCoverage(400, 20, { super_seeder: 40 }, { tractors: 1, machineUnits: { super_seeder: 2 } }).coveredAcres).toBe(110);
    expect(estimateCoverage(400, 20, { super_seeder: 40 }, { tractors: 2 }).coveredAcres).toBe(110);
  });
  it('rejects unknown machines and part tractors', () => {
    expect(() => estimateCoverage(18, 20, { combine: 2 })).toThrow(/combine/);
    expect(() => estimateCoverage(18, 20, { super_seeder: 2 }, { tractors: 1.5 })).toThrow();
  });
});

describe('the demo-mode answer to POST /v1/farm/coverage', () => {
  it("is the contract's Gurpreet example, worked out from the dates", () => {
    const res = coverageResponse({
      paddy: { value: 18, unit: 'acre' },
      harvest_date: '2026-10-20',
      wheat_deadline: '2026-11-09',
      tractors: 1,
      machines: [{ type: 'super_seeder', days: 2, units: 1 }],
      rain_days: 0,
      decomposer_acres: 0,
    });
    expect(res).toMatchObject({ window_days: 20, coverage_pct: 61, covered_acres: 11, gap_acres: 7, straw_t: 17.5, pm25_kg: 140, coverage: 0.6111 });
  });
});
