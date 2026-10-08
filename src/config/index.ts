import { z } from "zod";

export const EnvSchema = z.object({
  SATELLITE_MATCH_MAX_DISTANCE_METERS: z.coerce.number().default(1000),
  SATELLITE_MATCH_MAX_HOURS_BEFORE: z.coerce.number().default(24),
  SATELLITE_MATCH_MAX_HOURS_AFTER: z.coerce.number().default(6),
  SATELLITE_MATCH_MIN_CONFIDENCE: z.coerce.number().default(70),
  HELP_REQUEST_MAX_DISTANCE_METERS: z.coerce.number().default(5000),
  HELP_REQUEST_TIE_TOLERANCE_METERS: z.coerce.number().default(100), // For ambiguity detection
});

// Since we're not running a build process that populates process.env automatically yet,
// we'll safely parse whatever is there, or fall back to defaults.
export const config = EnvSchema.parse(
  typeof process !== "undefined" ? process.env : {},
);
