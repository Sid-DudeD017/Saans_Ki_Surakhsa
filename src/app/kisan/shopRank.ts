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

/** One way to rent: a machine from one CHC, with what it can do for this farm in the days it's free. */
export interface RentOption {
  itemId: string;
  machine: string;
  chc: { id: string; name: string; distanceKm: number | null };
  /** After the CHC's subsidy, per acre. */
  ratePerAcre: number;
  /** Gap acres it can clear in its free days this season (all its gain if free days aren't known). */
  acres: number;
  /** Working days that takes. */
  days: number;
  freeDays: number | null;
  firstFree: string | null;
  cost: number;
  /** It clears the whole gap. */
  enough: boolean;
}

/** The CHC search's answer (ChcsResponse), as much of it as this needs. */
export interface ChcsFound {
  chcs: { chc_id: string; name: string; distance_km?: number | null; machines: { machine: string; cost_per_acre_inr: number; free_days?: number | null; first_free?: string | null }[] }[];
}

/**
 * Every machine in the shop that helps and can be rented, at its best CHC (most acres in its free days,
 * then cheapest, then nearest). Best first: whole gap cleared, then most acres, cheapest, nearest.
 */
export function rentOptions(fit: ShopFit, items: ShopItem[], found: Record<string, ChcsFound | undefined>): RentOption[] {
  const out: RentOption[] = [];
  for (const f of fit.fits) {
    const item = items.find((i) => i.id === f.id);
    const type = item?.engine_type;
    if (!item || !type || !item.rent_from_chc || !f.gainAcres || f.gainAcres <= 0) continue;
    const perDay = CAPACITY_ACRES_PER_DAY[type];
    const gain = Math.min(f.gainAcres, fit.gapAcres);
    const options = (found[type]?.chcs ?? []).flatMap((c) =>
      c.machines
        .filter((m) => m.machine === type)
        .map((m): RentOption => {
          const freeDays = m.free_days ?? null;
          const acres = freeDays === null ? gain : Math.min(gain, freeDays * perDay);
          return {
            itemId: item.id,
            machine: type,
            chc: { id: c.chc_id, name: c.name, distanceKm: c.distance_km ?? null },
            ratePerAcre: m.cost_per_acre_inr,
            acres,
            days: Math.ceil((acres / perDay) * 2) / 2,
            freeDays,
            firstFree: m.first_free ?? null,
            cost: Math.round(acres * m.cost_per_acre_inr),
            enough: acres >= fit.gapAcres - 0.01,
          };
        }),
    );
    options.sort(byBest);
    if (options[0] && options[0].acres > 0) out.push(options[0]);
  }
  return out.sort(byBest);
}

function byBest(a: RentOption, b: RentOption): number {
  return (
    Number(b.enough) - Number(a.enough) ||
    b.acres - a.acres ||
    a.cost - b.cost ||
    (a.chc.distanceKm ?? Infinity) - (b.chc.distanceKm ?? Infinity)
  );
}
