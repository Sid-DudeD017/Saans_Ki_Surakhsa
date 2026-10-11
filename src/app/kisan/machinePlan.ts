// The Machines tab's arithmetic, kept free of React so it can be tested: "what if" more days of a
// machine would close the gap, and the season strip (one square per day from harvest to the wheat
// deadline: his machines' days, rain, CHC bookings, idle days). Both use the coverage engine's
// TypeScript copy (coverage.ts), tested against coverage.py.
import { CAPACITY_ACRES_PER_DAY, estimateCoverage } from './coverage';
import { machineDays, windowDays, type FarmProfile, type MachineType } from './farmProfile';

export interface WhatIf {
  machine: MachineType;
  /** Extra days of that machine, in half days. */
  extraDays: number;
  /** Coverage with those extra days. Below 100 when more days alone can't close the gap. */
  pct: number;
}

/** The machine to suggest more days of: his last rented one, else his fastest, else a Super Seeder. */
export function helperMachine(farm: FarmProfile): MachineType {
  const known = farm.machines.filter((m): m is typeof m & { type: MachineType } => m.type !== 'other');
  const rented = [...known].reverse().find((m) => !m.owned);
  if (rented) return rented.type;
  return known.map((m) => m.type).sort((a, b) => CAPACITY_ACRES_PER_DAY[b] - CAPACITY_ACRES_PER_DAY[a])[0] ?? 'super_seeder';
}

function base(farm: FarmProfile) {
  const window = windowDays(farm);
  if (farm.paddyAcres === undefined || window === undefined) return null;
  const own = machineDays(farm, window);
  return {
    window,
    days: Object.fromEntries(own.map((m) => [m.type, m.days])) as Record<string, number>,
    units: Object.fromEntries(own.map((m) => [m.type, m.units])) as Record<string, number>,
    tractors: farm.tractors ?? 1,
    paddy: farm.paddyAcres,
  };
}

/** The fewest extra days (in half days) of the helper machine that clear the gap, or the most they can. Null with no gap. */
export function whatIf(farm: FarmProfile): WhatIf | null {
  const b = base(farm);
  if (!b) return null;
  const now = estimateCoverage(b.paddy, b.window, b.days, { tractors: b.tractors, machineUnits: b.units });
  if (now.gapAcres <= 0.01) return null;
  const machine = helperMachine(farm);
  const units = { ...b.units, [machine]: Math.max(1, b.units[machine] ?? 0) };
  let best: WhatIf = { machine, extraDays: 0, pct: now.coveragePct };
  for (let extra = 0.5; extra <= b.window; extra += 0.5) {
    const r = estimateCoverage(b.paddy, b.window, { ...b.days, [machine]: (b.days[machine] ?? 0) + extra }, { tractors: b.tractors, machineUnits: units });
    if (r.coveragePct > best.pct) best = { machine, extraDays: extra, pct: r.coveragePct };
    if (r.gapAcres <= 0.01) return { machine, extraDays: extra, pct: 100 };
  }
  return best.extraDays > 0 ? best : null;
}

export type DayKind = 'own' | 'chc' | 'rain' | 'idle';

export interface SeasonDay {
  date: string; // YYYY-MM-DD
  kind: DayKind;
  past: boolean;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * One entry per day from harvest up to (not including) the wheat deadline. His machines take the first
 * dry days that no CHC booking has; how many days that is comes from the coverage engine (machine-days
 * used, spread over his tractors). Rain and bookings come from the zero-burn plan, once it's fetched.
 */
export function seasonDays(
  farm: FarmProfile,
  plan: { rain: string[]; chc: string[] } = { rain: [], chc: [] },
  today = new Date().toISOString().slice(0, 10),
): SeasonDay[] {
  const b = base(farm);
  if (!b || !farm.harvestDate) return [];
  const rain = new Set(plan.rain);
  const chc = new Set(plan.chc);
  const used = estimateCoverage(b.paddy, b.window, b.days, { tractors: b.tractors, machineUnits: b.units, rainDays: rain.size }).machineDaysUsed;
  let ownLeft = Math.ceil(Object.values(used).reduce((sum, d) => sum + d, 0) / Math.max(1, b.tractors));
  return Array.from({ length: Math.max(0, b.window) }, (_, i) => {
    const date = addDays(farm.harvestDate!, i);
    let kind: DayKind = 'idle';
    if (rain.has(date)) kind = 'rain';
    else if (chc.has(date)) kind = 'chc';
    else if (ownLeft > 0) {
      kind = 'own';
      ownLeft -= 1;
    }
    return { date, kind, past: date < today };
  });
}

/** Whole days from today to the wheat deadline (negative once it has passed). */
export function daysLeft(farm: FarmProfile, today = new Date().toISOString().slice(0, 10)): number | null {
  if (!farm.wheatBy) return null;
  return Math.round((Date.parse(farm.wheatBy) - Date.parse(today)) / 86_400_000);
}
