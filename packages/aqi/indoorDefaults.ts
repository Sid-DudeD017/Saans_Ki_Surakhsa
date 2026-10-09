// The indoor model's defaults (P3), read from indoor-defaults.json and checked when loaded: every value
// needs a source, and every schedule needs hours that make sense. Edit the JSON, not this file.
import { z } from 'zod';

import raw from './indoor-defaults.json';

const source = z.string().min(10);
const hours = z
  .array(z.tuple([z.number().min(0).max(24), z.number().min(0).max(48)]).refine(([from, to]) => to > from, 'ends before it starts'))
  .min(1);
const ventilation = z.strictObject({ air_exchange_per_h: z.number().positive(), penetration: z.number().min(0).max(1), source });
const emitter = z.strictObject({ mg_per_h: z.number().min(0), hours, source });

const Defaults = z.object({
  ventilation: z.strictObject({ closed: ventilation, ajar: ventilation, open: ventilation }),
  deposition_per_h: z.strictObject({ value: z.number().positive(), source }),
  ceiling_height_m: z.strictObject({ value: z.number().min(1).max(10), source }),
  cooking: z.strictObject({
    hours,
    hours_source: source,
    fuels: z.strictObject(
      Object.fromEntries(
        (['none', 'electric', 'lpg', 'png', 'kerosene', 'biomass'] as const).map((f) => [f, z.strictObject({ mg_per_h: z.number().min(0), source })]),
      ) as Record<'none' | 'electric' | 'lpg' | 'png' | 'kerosene' | 'biomass', z.ZodObject<{ mg_per_h: z.ZodNumber; source: z.ZodString }>>,
    ),
  }),
  smoker: emitter,
  incense: emitter,
  mosquito_coil: emitter,
  purifier: z.strictObject({ suggested_air_changes_per_h: z.number().positive(), source }),
  rooms: z.strictObject({
    kitchen: z.strictObject({ area_m2: z.number().positive(), windows: z.number().min(0), ceiling_height_m: z.number().positive(), source }),
    master_bedroom: z.strictObject({ area_m2: z.number().positive(), windows: z.number().min(0), ceiling_height_m: z.number().positive(), source }),
    living_room: z.strictObject({ area_m2: z.number().positive(), windows: z.number().min(0), ceiling_height_m: z.number().positive(), source }),
  }),
});

export type IndoorDefaults = z.infer<typeof Defaults>;
export type Ventilation = keyof IndoorDefaults['ventilation'];
export type CookingFuel = keyof IndoorDefaults['cooking']['fuels'];

export function parseIndoorDefaults(value: unknown): IndoorDefaults {
  return Defaults.parse(value);
}

export const INDOOR_DEFAULTS = parseIndoorDefaults(raw);
