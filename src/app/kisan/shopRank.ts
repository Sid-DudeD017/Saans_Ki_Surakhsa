// Which shop items fit this farm (K15, K16): for each one, how many of the farm's gap acres it would
// clear before the wheat deadline, worked out with the coverage engine (coverage.ts, tested against
// coverage.py). A machine is tried as one more unit for the whole window; the decomposer clears the
// whole gap, but only when the window is long enough for it to work.
import { CAPACITY_ACRES_PER_DAY, DECOMPOSER_MIN_WINDOW_DAYS, estimateCoverage } from './coverage';
import { coverageInput, machineDays, windowDays, type FarmProfile } from './farmProfile';
import type { ShopItem } from './shopCatalogue';

export interface Fit {
  id: string;
  /** Gap acres this item clears; null when the coverage engine doesn't know the machine. */
  gainAcres: number | null;
  /** Working days it needs for that, for a machine. */
  days: number | null;
  /** The decomposer, when there are fewer days left than it needs. */
  tooLate: boolean;
}

export interface ShopFit {
  gapAcres: number;
  windowDays: number;
  fits: Fit[]; // best first
}

/** Null until the farm card has paddy and both dates. */
export function rankShop(farm: FarmProfile, items: ShopItem[]): ShopFit | null {
  const input = coverageInput(farm);
  const window = windowDays(farm);
  if ('missing' in input || window === undefined || farm.paddyAcres === undefined) return null;

  const own = machineDays(farm, window);
  const days = Object.fromEntries(own.map((m) => [m.type, m.days]));
  const units = Object.fromEntries(own.map((m) => [m.type, m.units]));
  const tractors = farm.tractors ?? 1;
  const base = estimateCoverage(farm.paddyAcres, window, days, { tractors, machineUnits: units });

  const fits: Fit[] = items.map((item) => {
    if (item.kind === 'decomposer') {
      const tooLate = window < (item.min_window_days ?? DECOMPOSER_MIN_WINDOW_DAYS);
      return { id: item.id, gainAcres: tooLate ? 0 : base.gapAcres, days: null, tooLate };
    }
    const type = item.engine_type;
    if (!type) return { id: item.id, gainAcres: null, days: null, tooLate: false };
    const withIt = estimateCoverage(
      farm.paddyAcres!,
      window,
      { ...days, [type]: (days[type] ?? 0) + window },
      { tractors, machineUnits: { ...units, [type]: (units[type] ?? 0) + 1 } },
    );
    const gain = withIt.coveredAcres - base.coveredAcres;
    // The engine may hand this machine the whole field (it runs the fastest first), so "days" is just
    // the gap at this machine's rate: what the farmer would rent it for on top of what they have.
    const rentDays = gain > 0 ? Math.ceil((gain / CAPACITY_ACRES_PER_DAY[type]) * 2) / 2 : null;
    return { id: item.id, gainAcres: gain, days: rentDays, tooLate: false };
  });

  // Most gap cleared first; machines the engine doesn't know go last, in catalogue order.
  const order = (f: Fit) => (f.gainAcres === null ? -1 : f.gainAcres);
  fits.sort((a, b) => order(b) - order(a));
  return { gapAcres: base.gapAcres, windowDays: window, fits };
}
