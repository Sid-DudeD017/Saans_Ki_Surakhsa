// Ghar ki Hawa's indoor model (P3). A room's PM2.5 settles at
//   C_in = (P·a·C_out + S/V) / (a + k + CADR/V)
// (P penetration, a air changes an hour, k deposition, S indoor sources in µg/h, V room volume). Hour by hour
// it moves toward that level as dC/dt = P·a·C_out + S/V − (a + k + CADR/V)·C, solved exactly in 10-minute
// steps. The same functions build POST /v1/indoor/estimate and /ghar's mock mode.
import { INDOOR_DEFAULTS, type CookingFuel, type IndoorDefaults, type Ventilation } from './indoorDefaults';

const HOUR_MS = 3_600_000;
const IST_MS = 5.5 * HOUR_MS;
const STEP_H = 1 / 6;

export interface SteadyInput {
  outdoor: number;
  penetration: number;
  airExchangePerH: number;
  depositionPerH: number;
  cadrM3H: number;
  volumeM3: number;
  sourceUgPerH?: number;
}

/** The level a room settles at when nothing changes. */
export function steadyIndoor(p: SteadyInput): number {
  const removal = p.airExchangePerH + p.depositionPerH + p.cadrM3H / p.volumeM3;
  return (p.penetration * p.airExchangePerH * p.outdoor + (p.sourceUgPerH ?? 0) / p.volumeM3) / removal;
}

/** The request body of POST /v1/indoor/estimate (p3-aqi.openapi.json's IndoorEstimateRequest), defaults filled. */
export interface IndoorRequest {
  lat: number;
  lon: number;
  room_area_m2: number;
  ceiling_height_m: number;
  windows: number;
  windows_open: boolean;
  purifier_cadr_m3_h: number;
  hepa_class: 'none' | 'h11' | 'h12' | 'h13' | 'h14';
  cooking_fuel: CookingFuel;
  smokers: number;
  incense: boolean;
  mosquito_coils: boolean;
  meal_times_h?: [number, number][];
}

/** Shut windows, one open (single-sided airing), or two or more open (cross-ventilation). */
export function ventilationFor(windows: number, open: boolean): Ventilation {
  if (!open || windows < 1) return 'closed';
  return windows === 1 ? 'ajar' : 'open';
}

/** Hours since midnight in India, 0–24. */
export function istHourOf(ms: number): number {
  return (((ms + IST_MS) % (24 * HOUR_MS)) + 24 * HOUR_MS) % (24 * HOUR_MS) / HOUR_MS;
}

const within = (hour: number, spans: [number, number][]) => spans.some(([from, to]) => (hour >= from && hour < to) || (hour + 24 >= from && hour + 24 < to));

export interface SourceSwitches {
  cooking_fuel: CookingFuel;
  smokers: number;
  incense: boolean;
  mosquito_coils: boolean;
}

/** Indoor sources burning at this moment, µg/h, by name. */
export function sourcesAt(ms: number, s: SourceSwitches, d: IndoorDefaults = INDOOR_DEFAULTS): Record<string, number> {
  const hour = istHourOf(ms);
  const out: Record<string, number> = {};
  const cooking = d.cooking.fuels[s.cooking_fuel].mg_per_h;
  if (cooking > 0 && within(hour, d.cooking.hours)) out.cooking = cooking * 1000;
  if (s.smokers > 0 && within(hour, d.smoker.hours)) out.smoking = s.smokers * d.smoker.mg_per_h * 1000;
  if (s.incense && within(hour, d.incense.hours)) out.incense = d.incense.mg_per_h * 1000;
  if (s.mosquito_coils && within(hour, d.mosquito_coil.hours)) out.mosquito_coil = d.mosquito_coil.mg_per_h * 1000;
  return out;
}

export interface Room {
  volumeM3: number;
  ventilation: Ventilation;
  cadrM3H: number;
  sources: SourceSwitches;
}

/** Outdoor PM2.5 at an instant, or null where there is no forecast. */
export type OutdoorAt = (ms: number) => number | null;

/**
 * The room's PM2.5 at each of `times` (UTC ms, ascending), starting from the settled level 24 hours before the
 * first, so tonight's coil or this morning's cooking is already in the air at the start.
 */
export function simulateIndoor(room: Room, outdoorAt: OutdoorAt, times: number[], d: IndoorDefaults = INDOOR_DEFAULTS): number[] {
  const v = d.ventilation[room.ventilation];
  const k = d.deposition_per_h.value;
  const removal = v.air_exchange_per_h + k + room.cadrM3H / room.volumeM3;
  const stepMs = STEP_H * HOUR_MS;
  let last: number | null = null;
  const outdoor = (ms: number) => {
    const o = outdoorAt(ms);
    if (o !== null) last = o;
    return last ?? 0;
  };
  const source = (ms: number) => Object.values(sourcesAt(ms, room.sources, d)).reduce((a, b) => a + b, 0);
  const settled = (ms: number) => (v.penetration * v.air_exchange_per_h * outdoor(ms) + source(ms) / room.volumeM3) / removal;

  let t = times[0] - 24 * HOUR_MS;
  let c = settled(t);
  const out: number[] = [];
  for (const target of times) {
    while (t < target) {
      const dt = Math.min(stepMs, target - t);
      const mid = t + dt / 2;
      const ss = settled(mid);
      c = ss + (c - ss) * Math.exp((-removal * dt) / HOUR_MS);
      t += dt;
    }
    out.push(c);
  }
  return out;
}

export interface PlanItem {
  kind: 'windows' | 'purifier' | 'source' | 'mask';
  text: string;
  key?: string;
  from?: string;
  to?: string;
  pm25?: number;
  sourceType?: string;
  purifierCadr?: number;
}

export interface IndoorEstimate {
  indoor_pm25_now_ug_m3: number;
  outdoor_pm25_now_ug_m3: number;
  hourly_series: { time: string; indoor_pm25_ug_m3: number; outdoor_pm25_ug_m3: number }[];
  today_plan: string;
  plan: PlanItem[];
  assumptions: Record<string, unknown>;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const ist = (ms: number) => new Date(Math.round(ms / 1000) * 1000 + IST_MS).toISOString().replace(/\.\d{3}Z$/, '+05:30');
const clock = (ms: number) => ist(ms).slice(11, 16);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Clean enough to air the room out: the top of CPCB's "satisfactory" PM2.5 band. */
export const AIRING_UG_M3 = 60;
/** Time for a mask outside: CPCB's "poor" PM2.5 band starts above 90. */
export const MASK_UG_M3 = 90;

/** The 2-hour block with the lowest (or highest) mean; returns its start index. */
function block(values: number[], worst: boolean): number {
  let best = 0;
  let bestMean = worst ? -Infinity : Infinity;
  for (let i = 0; i + 1 < values.length; i++) {
    const m = (values[i] + values[i + 1]) / 2;
    if (worst ? m > bestMean : m < bestMean) {
      best = i;
      bestMean = m;
    }
  }
  return best;
}

const SOURCE_WORDS: Record<string, (z: number, fuel: CookingFuel) => string> = {
  cooking: (z, fuel) => `Cooking on ${fuel === 'biomass' ? 'wood or dung' : fuel === 'lpg' ? 'LPG' : fuel === 'png' ? 'piped gas' : fuel} adds up to ${z} µg/m³ at meal times. Shut the kitchen door and open a kitchen window or run the chimney while you cook.`,
  smoking: (z) => `Smoking indoors adds up to ${z} µg/m³. Smoke outside, away from the windows.`,
  incense: (z) => `Incense adds up to ${z} µg/m³. Light it by an open window, or skip it on bad days.`,
  mosquito_coil: (z) => `A mosquito coil adds up to ${z} µg/m³ overnight. A net or a plug-in repellent adds none.`,
};

/**
 * POST /v1/indoor/estimate's answer: the room now, the next 72 hours in India time, and a plan for the rest of
 * today (at least the next 12 hours) from what the model says each choice would do.
 */
export function estimateIndoor(req: IndoorRequest, outdoorAt: OutdoorAt, now: number, defaultD: IndoorDefaults = INDOOR_DEFAULTS): IndoorEstimate {
  const d = req.meal_times_h ? { ...defaultD, cooking: { ...defaultD.cooking, hours: req.meal_times_h } } : defaultD;
  const volume = req.room_area_m2 * req.ceiling_height_m;
  const ventilation = ventilationFor(req.windows, req.windows_open);
  const sources: SourceSwitches = { cooking_fuel: req.cooking_fuel, smokers: req.smokers, incense: req.incense, mosquito_coils: req.mosquito_coils };
  const room: Room = { volumeM3: volume, ventilation, cadrM3H: req.purifier_cadr_m3_h, sources };

  const first = (Math.floor((now + IST_MS) / HOUR_MS) + 1) * HOUR_MS - IST_MS;
  const hours = Array.from({ length: 72 }, (_, i) => first + i * HOUR_MS);
  const times = [now, ...hours];
  const outdoor = times.map((ms) => outdoorAt(ms));
  const indoor = simulateIndoor(room, outdoorAt, times, d);

  // Rest of today, but at least 12 hours, so a late-evening plan still covers the night.
  const midnight = (Math.floor((now + IST_MS) / (24 * HOUR_MS)) + 1) * 24 * HOUR_MS - IST_MS;
  const horizon = hours.filter((ms) => ms < Math.max(midnight, now + 12 * HOUR_MS));
  const outToday = horizon.map((ms) => outdoorAt(ms) ?? 0);
  const plan: PlanItem[] = [];
  const shut = { ...room, ventilation: 'closed' as const };

  // Windows
  const outNow = outdoor[0] ?? 0;
  if (ventilation !== 'closed' && outNow > AIRING_UG_M3) {
    plan.push({ kind: 'windows', key: 'windows_shut_now', pm25: Math.round(outNow), text: `Shut the windows now: it's ${Math.round(outNow)} µg/m³ outside, and an open room soon matches it.` });
  }
  const air = block(outToday, false);
  const airMean = Math.round((outToday[air] + outToday[air + 1]) / 2);
  const airSpan = `${clock(horizon[air])}–${clock(horizon[air] + 2 * HOUR_MS)}`;
  if (outToday.every((v) => v <= AIRING_UG_M3)) {
    plan.push({ kind: 'windows', key: 'windows_always_open', pm25: AIRING_UG_M3, text: `The air outside stays under ${AIRING_UG_M3} µg/m³: open the windows whenever you like.` });
  } else if (airMean <= AIRING_UG_M3) {
    plan.push({ kind: 'windows', key: 'windows_open_time', from: clock(horizon[air]), to: clock(horizon[air] + 2 * HOUR_MS), pm25: airMean, text: `Open the windows ${airSpan}, when the air outside is cleanest (about ${airMean} µg/m³), and keep them shut the rest of the day.` });
  } else {
    plan.push({ kind: 'windows', key: 'windows_shut_always', from: clock(horizon[air]), to: clock(horizon[air] + 2 * HOUR_MS), pm25: airMean, text: `Keep the windows shut: outside stays above ${AIRING_UG_M3} µg/m³. If the room needs air, open them ${airSpan}, when it's least bad (about ${airMean} µg/m³).` });
  }

  // Purifier
  const without = mean(simulateIndoor({ ...shut, cadrM3H: 0 }, outdoorAt, horizon, d));
  if (req.purifier_cadr_m3_h > 0) {
    const withIt = mean(simulateIndoor(shut, outdoorAt, horizon, d));
    plan.push(
      without <= 15
        ? { kind: 'purifier', key: 'purifier_not_needed', pm25: Math.round(without), text: `The room stays clean without the purifier today (about ${Math.round(without)} µg/m³).` }
        : { kind: 'purifier', key: 'purifier_run', pm25: Math.round(withIt), text: `Run the purifier with the windows shut: the room stays near ${Math.round(withIt)} µg/m³ instead of ${Math.round(without)}.` },
    );
  } else if (without > 30) {
    const cadr = Math.max(50, Math.round((d.purifier.suggested_air_changes_per_h * volume) / 50) * 50);
    const withOne = mean(simulateIndoor({ ...shut, cadrM3H: cadr }, outdoorAt, horizon, d));
    plan.push({ kind: 'purifier', key: 'purifier_buy', purifierCadr: cadr, pm25: Math.round(withOne), text: `A purifier with a CADR of about ${cadr} m³/h would bring this room from ${Math.round(without)} to ${Math.round(withOne)} µg/m³.` });
  }

  // Indoor sources: how much each adds at its worst over the next 24 hours, with the windows shut
  const day = hours.slice(0, 24);
  const base = simulateIndoor({ ...shut, sources: { cooking_fuel: 'none', smokers: 0, incense: false, mosquito_coils: false } }, outdoorAt, day, d);
  const only: [keyof typeof SOURCE_WORDS, Partial<SourceSwitches>][] = [
    ['cooking', { cooking_fuel: req.cooking_fuel }],
    ['smoking', { smokers: req.smokers }],
    ['incense', { incense: req.incense }],
    ['mosquito_coil', { mosquito_coils: req.mosquito_coils }],
  ];
  for (const [name, switches] of only) {
    const one = simulateIndoor({ ...shut, sources: { cooking_fuel: 'none', smokers: 0, incense: false, mosquito_coils: false, ...switches } }, outdoorAt, day, d);
    const added = Math.round(Math.max(0, ...one.map((v, i) => v - base[i])));
    if (added >= 5) plan.push({ kind: 'source', key: `source_${name}`, sourceType: req.cooking_fuel, pm25: added, text: SOURCE_WORDS[name](added, req.cooking_fuel) });
  }

  // Mask
  if (outToday.some((v) => v > MASK_UG_M3)) {
    const w = block(outToday, true);
    plan.push({
      kind: 'mask',
      key: 'mask_outside',
      from: clock(horizon[w]),
      to: clock(horizon[w] + 2 * HOUR_MS),
      pm25: Math.round((outToday[w] + outToday[w + 1]) / 2),
      text: `Wear an N95 outside, most of all ${clock(horizon[w])}–${clock(horizon[w] + 2 * HOUR_MS)} (about ${Math.round((outToday[w] + outToday[w + 1]) / 2)} µg/m³).`,
    });
  }

  const v = d.ventilation[ventilation];
  const cookingRate = d.cooking.fuels[req.cooking_fuel].mg_per_h;
  return {
    indoor_pm25_now_ug_m3: round1(indoor[0]),
    outdoor_pm25_now_ug_m3: round1(outNow),
    hourly_series: hours.map((ms, i) => ({ time: ist(ms), indoor_pm25_ug_m3: round1(indoor[i + 1]), outdoor_pm25_ug_m3: round1(outdoor[i + 1] ?? outNow) })),
    today_plan: plan.map((p) => p.text).join(' '),
    plan,
    assumptions: {
      room_volume_m3: round1(volume),
      ventilation,
      infiltration_rate_ach: v.air_exchange_per_h,
      penetration: v.penetration,
      decay_rate_h: d.deposition_per_h.value,
      purifier_effective_cadr_m3_h: req.purifier_cadr_m3_h,
      hepa_class: req.hepa_class,
      cooking_emission_ug_m3_h: round1((cookingRate * 1000) / volume),
      sources_mg_h: {
        cooking: cookingRate,
        smoking_per_smoker: d.smoker.mg_per_h,
        incense: d.incense.mg_per_h,
        mosquito_coil: d.mosquito_coil.mg_per_h,
      },
      defaults: 'packages/aqi/indoor-defaults.json',
    },
  };
}
