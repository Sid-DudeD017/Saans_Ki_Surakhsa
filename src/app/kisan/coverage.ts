// The coverage engine (services/agent-kisan/src/agent_kisan/coverage.py), copied for demo mode only so
// the "is it enough?" verdict answers to the farmer's own numbers without the agent running. The real
// app calls POST /v1/farm/coverage. src/__tests__/kisan-coverage.test.ts runs the Python tests' 14
// worked cases against this copy, so the two can't quietly drift.
import type { components } from '../../../packages/contracts/types';

export type CoverageRequest = components['schemas']['CoverageRequest'];
export type CoverageResponse = components['schemas']['CoverageResponse'];

export const CAPACITY_ACRES_PER_DAY: Record<string, number> = {
  happy_seeder: 7.0,
  super_seeder: 5.5,
  mulcher_rmb: 4.5, // mulcher + reversible mould-board plough
  baler: 15.0, // baler + rake
};
export const DECOMPOSER_MIN_WINDOW_DAYS = 25;
export const STRAW_T_PER_ACRE = 2.5;
export const PM25_G_PER_KG_STRAW = 8.0;

export interface CoverageResult {
  paddyAcres: number;
  coveredAcres: number;
  gapAcres: number;
  coverage: number;
  coveragePct: number;
  strawT: number;
  pm25Kg: number;
  workDays: number;
  tractorDaysAvailable: number;
  tractorDaysUsed: number;
  machineDaysUsed: Record<string, number>;
}

export function estimateCoverage(
  paddyAcres: number,
  windowDays: number,
  machineDays: Record<string, number> = {},
  { tractors = 1, rainDays = 0, decomposerAcres = 0, machineUnits = {} as Record<string, number> } = {},
): CoverageResult {
  for (const [name, v] of Object.entries({ paddyAcres, windowDays, tractors, rainDays, decomposerAcres, ...machineDays })) {
    if (v < 0) throw new Error(`values can't be negative: ${name}=${v}`);
  }
  if (!Number.isInteger(tractors)) throw new Error(`tractors must be a whole number: ${tractors}`);
  const unknown = Object.keys(machineDays).filter((m) => !(m in CAPACITY_ACRES_PER_DAY));
  if (unknown.length) throw new Error(`unknown machines: ${unknown.sort().join(', ')}`);

  const workDays = Math.max(0, windowDays - rainDays);
  const tractorDays = tractors * workDays;
  let covered = windowDays >= DECOMPOSER_MIN_WINDOW_DAYS ? decomposerAcres : 0;
  covered = Math.min(covered, paddyAcres);

  let usedTotal = 0;
  const used: Record<string, number> = {};
  for (const machine of Object.keys(machineDays).sort((a, b) => CAPACITY_ACRES_PER_DAY[b] - CAPACITY_ACRES_PER_DAY[a])) {
    const capacity = CAPACITY_ACRES_PER_DAY[machine];
    const days = Math.max(
      0,
      Math.min(machineDays[machine], workDays * (machineUnits[machine] ?? 1), tractorDays - usedTotal, capacity ? (paddyAcres - covered) / capacity : 0),
    );
    used[machine] = days;
    usedTotal += days;
    covered += capacity * days;
  }

  covered = Math.min(covered, paddyAcres);
  const gap = paddyAcres - covered;
  const strawT = gap * STRAW_T_PER_ACRE;
  const coverage = paddyAcres ? covered / paddyAcres : 0;
  return {
    paddyAcres,
    coveredAcres: covered,
    gapAcres: gap,
    coverage,
    coveragePct: Math.floor(coverage * 100 + 0.5),
    strawT,
    pm25Kg: strawT * PM25_G_PER_KG_STRAW,
    workDays,
    tractorDaysAvailable: tractorDays,
    tractorDaysUsed: usedTotal,
    machineDaysUsed: used,
  };
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** What POST /v1/farm/coverage would answer, for paddy in acres. */
export function coverageResponse(req: CoverageRequest): CoverageResponse {
  const window =
    req.window_days ??
    (req.harvest_date && req.wheat_deadline ? (Date.parse(req.wheat_deadline) - Date.parse(req.harvest_date)) / 86_400_000 : 0);
  const machines = req.machines ?? [];
  const r = estimateCoverage(req.paddy.value, window, Object.fromEntries(machines.map((m) => [m.type, m.days])), {
    tractors: req.tractors ?? 1,
    rainDays: req.rain_days ?? 0,
    decomposerAcres: req.decomposer_acres ?? 0,
    machineUnits: Object.fromEntries(machines.map((m) => [m.type, m.units ?? 1])),
  });
  return {
    paddy_acres: r2(r.paddyAcres),
    covered_acres: r2(r.coveredAcres),
    gap_acres: r2(r.gapAcres),
    coverage: Math.round(r.coverage * 10_000) / 10_000,
    coverage_pct: r.coveragePct,
    straw_t: r2(r.strawT),
    pm25_kg: r2(r.pm25Kg),
    window_days: window,
    work_days: r.workDays,
    tractor_days: { available: r.tractorDaysAvailable, used: r2(r.tractorDaysUsed) },
    machine_days_used: Object.fromEntries(Object.entries(r.machineDaysUsed).map(([m, d]) => [m, r2(d)])),
    assumptions: {
      capacity_acres_per_day: CAPACITY_ACRES_PER_DAY,
      decomposer_min_window_days: DECOMPOSER_MIN_WINDOW_DAYS,
      straw_t_per_acre: STRAW_T_PER_ACRE,
      pm25_g_per_kg_straw: PM25_G_PER_KG_STRAW,
    },
  };
}
