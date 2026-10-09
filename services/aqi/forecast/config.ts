// The forecast grid's settings (P3). Ĉ = forecast + station_bias·e^(−lead/6 h) + smoke_plume, on 1 km cells.

/** Where we forecast: two boxes, a little larger than Punjab and the NCR. */
export const REGIONS = [
  { name: 'punjab', minLat: 29.5, maxLat: 32.6, minLon: 73.8, maxLon: 77.0 },
  { name: 'ncr', minLat: 27.0, maxLat: 30.0, minLon: 75.9, maxLon: 78.6 },
] as const;

/**
 * Open-Meteo is sampled on a lattice this many degrees apart (about 27 km). Its India forecast is CAMS
 * global (~0.4°), so a finer lattice would only repeat the same values; 1 km cells are interpolated from it.
 */
export const ANCHOR_STEP_DEG = 0.25;

/** Locations per Open-Meteo request. */
export const ANCHORS_PER_REQUEST = 100;

/** Cell size. Cells are square in a projection centred on 30° N, so they are 1 km ± 3% across both regions. */
export const CELL_KM = 1;
export const CELL_LAT0 = 30;

/**
 * Rebuild the grid every 3 hours. CAMS itself runs twice a day, and Open-Meteo counts each location as a call:
 * ~350 anchors × 2 APIs × 8 builds is about 5,600 calls a day, inside its free 10,000.
 */
export const REFRESH_HOURS = 3;
/** Answer from a grid up to 6 hours old; after that, rebuild it, and after 24 hours, give up on it. */
export const FRESH_HOURS = 6;
export const USABLE_HOURS = 24;

export const MAX_HOURS = 72;
export const DEFAULT_HOURS = 24;

export const MODEL = 'open_meteo_cams';
export const MODEL_VERSION = '0.2.0';

export const BIAS = {
  /** Fade: the correction is multiplied by e^(−lead/fadeHours). */
  fadeHours: 6,
  /** A station's pull falls as exp(−d²/2L²) with this L, and stops at 3 L. */
  lengthKm: 15,
  /** Readings older than this are not live. */
  maxAgeHours: 3,
  /**
   * A CPCB station this close to an OpenAQ one is the same monitor (OpenAQ republishes CPCB). We keep
   * OpenAQ's, since it is the hourly reading and data.gov.in's feed gives min/max/average values.
   */
  sameStationKm: 0.5,
  /** Readings outside this range are faults, not air: even a clean day here reads well above 2 µg/m³. */
  minUgM3: 2,
  maxUgM3: 1000,
} as const;

export const PLUME = {
  /**
   * PM2.5 per unit of fire radiative energy, kg/MJ. Ichoku & Kaufman (2005) derived smoke emission
   * coefficients of about 0.02–0.08 kg/MJ from MODIS; we take the low end, since CAMS already carries
   * GFAS fire emissions at ~45 km and this layer should add local detail, not a second copy.
   */
  kgPerMJ: 0.02,
  /**
   * VIIRS sees a fire once. A field's straw burns out quickly, so we assume 1 hour at the seen FRP; with 3 hours
   * the first live run put thousands of µg/m³ 10 km from 3 MW fires.
   */
  burnHours: 1,
  /** A puff is released every 15 minutes, and moved along the hourly wind in 15-minute steps. */
  stepMinutes: 15,
  /** Puffs are dropped after 12 hours; by then they're spread over tens of km. */
  maxAgeHours: 12,
  /** Horizontal spread: Briggs rural, neutral (class D), σ = 0.08·x·(1 + 0.0001·x)^−½, at least half a cell. */
  minSigmaM: 500,
  /**
   * Smoke is mixed through the boundary layer. Open-Meteo's height falls below 100 m on still nights, but hot
   * smoke rises above that, so it is floored at 300 m.
   */
  minMixingM: 300,
  /** FIRMS VIIRS confidence 'l' (low) is left out. */
  minConfidence: ['n', 'h', 'nominal', 'high'],
  /** Scale on the whole layer, for calibration against stations. */
  scale: 1,
} as const;
