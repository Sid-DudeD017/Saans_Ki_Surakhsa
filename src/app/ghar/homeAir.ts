// Ghar ki Hawa's numbers for the whole home and for each room, from the indoor model's PM2.5 (P3).
//
// The home's figure is the volume-weighted mean: Σ(Cᵢ·Vᵢ) / ΣVᵢ, the PM2.5 you'd measure if all the home's
// air were mixed together, so a big living room counts for more than a small kitchen. It is then put on
// CPCB's AQI scale like any outdoor reading, which stops at 500: a room full of coil smoke shows as
// "500+, Severe", with its µg/m³ beside it, rather than an "AQI" of 957.
import { getCategoryCode, subIndex, type AqiCategoryCode } from '../../../packages/aqi';
import { INDOOR_DEFAULTS } from '../../../packages/aqi/indoorDefaults';
import { sourcesAt, type IndoorRequest } from '../../../packages/aqi/indoor';

export type Category = AqiCategoryCode;

export interface AqiFromPm25 {
  aqi: number;
  /** Past the top of CPCB's PM2.5 table (above 380 µg/m³): shown as 500+. */
  aboveScale: boolean;
  category: Category;
}

/** CPCB's AQI for a PM2.5 level. CPCB's bands are whole numbers (…30, 31…), so the level is rounded first. */
export function pm25Aqi(ug: number): AqiFromPm25 {
  const { value, above_scale } = subIndex('pm25', Math.max(0, Math.round(ug)));
  return { aqi: value, aboveScale: above_scale, category: getCategoryCode(value) };
}

/** "500+" past the top of the scale, the number otherwise. */
export const aqiText = (a: AqiFromPm25) => (a.aboveScale ? '500+' : String(a.aqi));

export interface RoomAir {
  pm25: number;
  volumeM3: number;
}

/** The whole home's PM2.5: each room weighted by how much air it holds. Undefined with no rooms. */
export function wholeHome(rooms: RoomAir[]): number | undefined {
  const total = rooms.reduce((v, r) => v + r.volumeM3, 0);
  if (!rooms.length || total <= 0) return undefined;
  return rooms.reduce((sum, r) => sum + r.pm25 * r.volumeM3, 0) / total;
}

export const volumeOf = (req: Pick<IndoorRequest, 'room_area_m2' | 'ceiling_height_m'>) => req.room_area_m2 * req.ceiling_height_m;

export type SourceKey = 'cooking' | 'smoking' | 'incense' | 'mosquito_coil';

/** The smoke sources a room has, whether or not they're burning now. Cooking only counts if the fuel burns. */
export function roomSources(req: IndoorRequest): SourceKey[] {
  const out: SourceKey[] = [];
  if (INDOOR_DEFAULTS.cooking.fuels[req.cooking_fuel].mg_per_h > 0) out.push('cooking');
  if (req.smokers > 0) out.push('smoking');
  if (req.incense) out.push('incense');
  if (req.mosquito_coils) out.push('mosquito_coil');
  return out;
}

/** The sources burning in the room at this moment (India time), by the model's own schedule. */
export function sourcesNow(req: IndoorRequest, ms: number): SourceKey[] {
  const d = req.meal_times_h ? { ...INDOOR_DEFAULTS, cooking: { ...INDOOR_DEFAULTS.cooking, hours: req.meal_times_h } } : INDOOR_DEFAULTS;
  return Object.keys(sourcesAt(ms, { cooking_fuel: req.cooking_fuel, smokers: req.smokers, incense: req.incense, mosquito_coils: req.mosquito_coils }, d)) as SourceKey[];
}

/** The room whose air is cleanest and the one whose air is worst. */
export function cleanestAndWorst<T extends { pm25: number }>(rooms: T[]): { cleanest?: T; worst?: T } {
  if (rooms.length < 2) return {};
  const sorted = [...rooms].sort((a, b) => a.pm25 - b.pm25);
  return { cleanest: sorted[0], worst: sorted[sorted.length - 1] };
}
