// One farm profile for every Kisan tab (K4): where the farm is, how much paddy, tractors, the sowing
// window, and the machines the farmer photographed. It lives on the phone only. The chat fills it
// once the farmer confirms the read-back; the farm card lets them type it instead.
import { localStore } from '../../lib/localStore';
import type { CardItem, CoverageRequest, FarmHint, Language, PlanRequest, Readback } from './kisanApi';

export const MACHINE_TYPES = ['happy_seeder', 'super_seeder', 'mulcher_rmb', 'baler'] as const;
export type MachineType = (typeof MACHINE_TYPES)[number];

export interface FarmLocation {
  /** Rounded to 2 decimals (about 1 km): enough to find CHCs and the district, no more. */
  lat?: number;
  lon?: number;
  village?: string;
}

export interface OwnedMachine {
  id: string;
  type: MachineType | 'other';
  count: number;
  owned: boolean;
  /** Days the farmer can use each one; unset = the whole sowing window (their own machine). */
  days?: number;
  /** A small preview made on the phone. It never leaves the phone. */
  thumb?: string;
  /** How the photo service guessed it, for the record; the farmer's tap decided the type. */
  guess?: { machine: string | null; confidence: number | null };
  addedAt: string;
}

export interface FarmProfile {
  location?: FarmLocation;
  paddyAcres?: number;
  tractors?: number;
  harvestDate?: string; // YYYY-MM-DD
  wheatBy?: string; // YYYY-MM-DD
  machines: OwnedMachine[];
  /** Where the numbers last came from, so the card can say so. */
  source?: 'chat' | 'form';
}

export const EMPTY_FARM: FarmProfile = { machines: [] };

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Whatever was saved, made safe to use: wrong types are dropped rather than trusted. */
export function cleanFarm(saved: unknown): FarmProfile {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const num = (v: unknown, min = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= min ? v : undefined);
  const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const loc = (s.location && typeof s.location === 'object' ? s.location : {}) as Record<string, unknown>;
  const lat = num(loc.lat, -90);
  const lon = num(loc.lon, -180);
  const village = typeof loc.village === 'string' && loc.village.trim() ? loc.village.trim().slice(0, 80) : undefined;
  const location: FarmLocation | undefined =
    (lat !== undefined && lon !== undefined) || village
      ? { ...(lat !== undefined && lon !== undefined ? { lat: round2(lat), lon: round2(lon) } : {}), ...(village ? { village } : {}) }
      : undefined;
  const machines = Array.isArray(s.machines)
    ? (s.machines as Record<string, unknown>[]).filter(
        (m) => m && typeof m.id === 'string' && ([...MACHINE_TYPES, 'other'] as string[]).includes(m.type as string),
      ).map((m) => ({
        id: m.id as string,
        type: m.type as OwnedMachine['type'],
        count: Math.max(1, Math.round(num(m.count, 1) ?? 1)),
        owned: m.owned !== false,
        ...(num(m.days, 0) !== undefined && (m.days as number) <= 365 ? { days: m.days as number } : {}),
        ...(typeof m.thumb === 'string' && m.thumb.startsWith('data:image/') ? { thumb: m.thumb } : {}),
        ...(m.guess && typeof m.guess === 'object' ? { guess: m.guess as OwnedMachine['guess'] } : {}),
        addedAt: typeof m.addedAt === 'string' ? m.addedAt : new Date(0).toISOString(),
      }))
    : [];
  return {
    ...(location ? { location } : {}),
    ...(num(s.paddyAcres) !== undefined ? { paddyAcres: num(s.paddyAcres) } : {}),
    ...(num(s.tractors) !== undefined ? { tractors: Math.round(num(s.tractors)!) } : {}),
    ...(day(s.harvestDate) ? { harvestDate: day(s.harvestDate) } : {}),
    ...(day(s.wheatBy) ? { wheatBy: day(s.wheatBy) } : {}),
    machines,
    ...(s.source === 'chat' || s.source === 'form' ? { source: s.source } : {}),
  };
}

export const farmStore = localStore<FarmProfile>('saans_kisan_farm', EMPTY_FARM, cleanFarm);

const MONTH_NAMES: Record<Language, string[]> = {
  pa: ['ਜਨਵਰੀ', 'ਫ਼ਰਵਰੀ', 'ਮਾਰਚ', 'ਅਪ੍ਰੈਲ', 'ਮਈ', 'ਜੂਨ', 'ਜੁਲਾਈ', 'ਅਗਸਤ', 'ਸਤੰਬਰ', 'ਅਕਤੂਬਰ', 'ਨਵੰਬਰ', 'ਦਸੰਬਰ'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  en: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
};

/**
 * "9 ਨਵੰਬਰ", "9 नवंबर", "9 November" or "9 Nov" (how the read-back card writes dates) as YYYY-MM-DD.
 * The card has no year: take the one that puts the date within the coming season (no more than
 * 90 days ago).
 */
export function cardDate(value: string, today = new Date()): string | undefined {
  const m = value.trim().match(/^(\d{1,2})\s+(\S+)/u);
  if (!m) return undefined;
  const day = Number(m[1]);
  const word = m[2].toLowerCase().replace(/\.$/, '');
  let month = -1;
  for (const names of Object.values(MONTH_NAMES)) {
    const i = names.findIndex((n) => n === word || (word.length >= 3 && /^[a-z]+$/.test(word) && n.startsWith(word)));
    if (i >= 0) month = i;
  }
  if (month < 0 || day < 1 || day > 31) return undefined;
  let year = today.getFullYear();
  if (Date.UTC(year, month, day) < today.getTime() - 90 * 86_400_000) year += 1;
  const d = new Date(Date.UTC(year, month, day));
  if (d.getUTCMonth() !== month) return undefined; // 31 November
  return d.toISOString().slice(0, 10);
}

// Killa and acre are the same size in Punjab; any other unit the agent converted is left for the farmer to type.
const ACRE_UNITS = ['ਕਿੱਲੇ', 'ਕਿੱਲਾ', 'ਏਕੜ', 'किल्ले', 'किल्ला', 'एकड़', 'acre', 'acres', 'killa', 'killas'];

function cardNumber(item: CardItem | undefined): number | undefined {
  if (!item) return undefined;
  const n = Number(item.value.replace(/[^\d.]/g, ''));
  return item.value.trim() && Number.isFinite(n) ? n : undefined;
}

/** What a confirmed read-back says about the farm. Fields the card doesn't have are left out. */
export function farmFromReadback(readback: Readback, today = new Date()): Partial<FarmProfile> {
  const items = readback.card.items;
  const find = (kind: string) => items.find((i) => i.kind === kind);
  const out: Partial<FarmProfile> = {};
  const paddy = find('paddy');
  const acres = cardNumber(paddy);
  if (acres !== undefined && (!paddy?.unit || ACRE_UNITS.includes(paddy.unit.toLowerCase()))) out.paddyAcres = acres;
  const tractors = cardNumber(find('tractors'));
  if (tractors !== undefined) out.tractors = Math.round(tractors);
  const harvest = find('harvest');
  if (harvest) out.harvestDate = cardDate(harvest.value, today);
  const wheat = find('wheat_by');
  if (wheat) out.wheatBy = cardDate(wheat.value, today);
  for (const k of Object.keys(out) as (keyof FarmProfile)[]) if (out[k] === undefined) delete out[k];
  return out;
}

/** Machines the read-back card lists ("Your machine: Super Seeder, 2 days"), as list entries. */
export function machinesFromReadback(readback: Readback, now = new Date()): OwnedMachine[] {
  return readback.card.items
    .filter((i) => i.kind === 'machine' && (MACHINE_TYPES as readonly string[]).includes(i.icon ?? ''))
    .map((i) => {
      const days = cardNumber(i);
      return {
        id: `chat-${i.icon}`,
        type: i.icon as MachineType,
        count: 1,
        owned: true,
        ...(days !== undefined ? { days } : {}),
        addedAt: now.toISOString(),
      };
    });
}

/**
 * The chat's confirmed numbers replace the typed ones and location stays. Machines the chat confirmed
 * join the list unless that type is already there (a photographed machine keeps its photo).
 */
export function mergeFromChat(farm: FarmProfile, fromChat: Partial<FarmProfile>, chatMachines: OwnedMachine[] = []): FarmProfile {
  const added = chatMachines.filter((m) => !farm.machines.some((old) => old.type === m.type));
  if (Object.keys(fromChat).length === 0 && added.length === 0) return farm;
  return { ...farm, ...fromChat, machines: [...farm.machines, ...added], location: farm.location, source: 'chat' };
}

/** Days from harvest to the wheat deadline, or undefined until both dates are known. */
export function windowDays(farm: FarmProfile): number | undefined {
  if (!farm.harvestDate || !farm.wheatBy) return undefined;
  return Math.round((Date.parse(farm.wheatBy) - Date.parse(farm.harvestDate)) / 86_400_000);
}

/**
 * The machines as the coverage engine wants them: one entry per type, days added up over every unit.
 * "Other" machines aren't in the engine, so they don't count.
 */
export function machineDays(farm: FarmProfile, window: number): { type: MachineType; days: number; units: number }[] {
  const byType = new Map<MachineType, { days: number; units: number }>();
  for (const m of farm.machines) {
    if (m.type === 'other') continue;
    const t = byType.get(m.type) ?? { days: 0, units: 0 };
    t.days += m.count * Math.min(m.days ?? window, window);
    t.units += m.count;
    byType.set(m.type, t);
  }
  return MACHINE_TYPES.filter((t) => byType.has(t)).map((type) => ({ type, ...byType.get(type)! }));
}

export type NeedsFirst = 'paddy' | 'dates';

/** The coverage request for this farm, or what's still missing from the farm card. */
export function coverageInput(farm: FarmProfile): CoverageRequest | { missing: NeedsFirst[] } {
  const window = windowDays(farm);
  const missing: NeedsFirst[] = [];
  if (farm.paddyAcres === undefined) missing.push('paddy');
  if (window === undefined) missing.push('dates');
  if (missing.length || window === undefined || farm.paddyAcres === undefined) return { missing };
  return {
    paddy: { value: farm.paddyAcres, unit: 'acre' },
    harvest_date: farm.harvestDate,
    wheat_deadline: farm.wheatBy,
    tractors: farm.tractors ?? 1,
    machines: machineDays(farm, window),
    rain_days: 0, // the verdict assumes dry days; the plan (K11) checks the forecast
    decomposer_acres: 0,
  };
}

/** How far to look for CHCs; the planner's own default (planner.py DEFAULT_MAX_KM). */
export const PLAN_MAX_KM = 15;

/** The zero-burn plan request: the coverage request plus where the farm is. */
export function planInput(farm: FarmProfile): PlanRequest | null {
  const cov = coverageInput(farm);
  const loc = farm.location;
  if ('missing' in cov || !loc || !cov.harvest_date || !cov.wheat_deadline) return null;
  const where = loc.lat !== undefined && loc.lon !== undefined ? { lat: loc.lat, lon: loc.lon } : loc.village ? { village: loc.village } : null;
  if (!where) return null;
  return { ...cov, harvest_date: cov.harvest_date, wheat_deadline: cov.wheat_deadline, max_km: PLAN_MAX_KM, ...where };
}

/** What a new conversation can start from, so the agent doesn't ask again. Undefined if there's nothing yet. */
export function farmHint(farm: FarmProfile): FarmHint | undefined {
  const window = windowDays(farm);
  const hint: FarmHint = {
    ...(farm.location?.lat !== undefined && farm.location.lon !== undefined ? { lat: farm.location.lat, lon: farm.location.lon } : {}),
    ...(farm.location?.village ? { village: farm.location.village } : {}),
    ...(farm.paddyAcres !== undefined ? { paddy_acres: farm.paddyAcres } : {}),
    ...(farm.tractors !== undefined ? { tractors: farm.tractors } : {}),
    ...(farm.harvestDate ? { harvest_date: farm.harvestDate } : {}),
    ...(farm.wheatBy ? { wheat_deadline: farm.wheatBy } : {}),
  };
  // Days for machines need the window, unless every machine has its own day count.
  const machines = farm.machines.filter((m) => m.type !== 'other');
  if (machines.length && (window !== undefined || machines.every((m) => m.days !== undefined))) {
    hint.machines = Object.fromEntries(machineDays(farm, window ?? 365).map((m) => [m.type, m.days]));
  }
  return Object.keys(hint).length ? hint : undefined;
}

export type Verdict = 'enough' | 'almost' | 'short';

/** ≥ 100% enough, 80–99% almost, under 80% not enough. */
export function verdictOf(coveragePct: number): Verdict {
  if (coveragePct >= 100) return 'enough';
  return coveragePct >= 80 ? 'almost' : 'short';
}

/** About how many more days of a machine would clear the gap, rounded up to half a day. */
export function daysToClear(gapAcres: number, machine: MachineType, capacities: Record<string, number>): number {
  const perDay = capacities[machine] ?? 0;
  return perDay > 0 ? Math.ceil((gapAcres / perDay) * 2) / 2 : 0;
}

/** The guess the photo service made, as the choice to show first. Below 60% the farmer picks. */
export function preselect(guess: { machine?: string | null; confidence?: number | null } | null | undefined): MachineType | 'other' | null {
  if (!guess || !guess.machine || (guess.confidence ?? 0) < 0.6) return null;
  if ((MACHINE_TYPES as readonly string[]).includes(guess.machine)) return guess.machine as MachineType;
  return guess.machine === 'other' ? 'other' : null;
}

export interface FarmForm {
  paddyAcres: string;
  tractors: string;
  harvestDate: string;
  wheatBy: string;
}

export function formOf(farm: FarmProfile): FarmForm {
  return {
    paddyAcres: farm.paddyAcres?.toString() ?? '',
    tractors: farm.tractors?.toString() ?? '',
    harvestDate: farm.harvestDate ?? '',
    wheatBy: farm.wheatBy ?? '',
  };
}

/** The typed farm details, or null if they don't make sense. Blank fields stay unknown. */
export function farmFromForm(form: FarmForm): Pick<FarmProfile, 'paddyAcres' | 'tractors' | 'harvestDate' | 'wheatBy'> | null {
  const number = (text: string, max: number, whole = false) => {
    if (!text.trim()) return { ok: true, value: undefined };
    const n = Number(text.replace(',', '.'));
    const ok = Number.isFinite(n) && n >= 0 && n <= max && (!whole || Number.isInteger(n));
    return { ok, value: ok ? n : undefined };
  };
  const day = (text: string) => (/^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined);
  const paddy = number(form.paddyAcres, 10_000);
  const tractors = number(form.tractors, 50, true);
  const harvestDate = day(form.harvestDate);
  const wheatBy = day(form.wheatBy);
  if (!paddy.ok || !tractors.ok) return null;
  if ((form.harvestDate && !harvestDate) || (form.wheatBy && !wheatBy)) return null;
  if (harvestDate && wheatBy && wheatBy < harvestDate) return null;
  return { paddyAcres: paddy.value, tractors: tractors.value, harvestDate, wheatBy };
}

export type GuessNote =
  | { kind: 'looksLike'; machine: MachineType | 'other'; pct: number }
  | { kind: 'noMachineSeen' | 'notSure' | 'aiUnavailable' };

/** What to tell the farmer about the photo service's guess. */
export function describeGuess(guess: { machine?: string | null; confidence?: number | null; error?: string | null } | null | undefined): GuessNote {
  if (!guess || guess.error || guess.machine === null || guess.machine === undefined) return { kind: 'aiUnavailable' };
  if (guess.machine === 'none') return { kind: 'noMachineSeen' };
  const pick = preselect(guess);
  if (!pick) return { kind: 'notSure' };
  return { kind: 'looksLike', machine: pick, pct: Math.round((guess.confidence ?? 0) * 100) };
}
