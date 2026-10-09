// One farm profile for every Kisan tab (K4): where the farm is, how much paddy, tractors, the sowing
// window, and the machines the farmer photographed. It lives on the phone only. The chat fills it
// once the farmer confirms the read-back; the farm card lets them type it instead.
import { localStore } from '../../lib/localStore';
import type { CardItem, Language, Readback } from './kisanApi';

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

/** The chat's confirmed numbers replace the typed ones; machines and location stay. */
export function mergeFromChat(farm: FarmProfile, fromChat: Partial<FarmProfile>): FarmProfile {
  if (Object.keys(fromChat).length === 0) return farm;
  return { ...farm, ...fromChat, machines: farm.machines, location: farm.location, source: 'chat' };
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
