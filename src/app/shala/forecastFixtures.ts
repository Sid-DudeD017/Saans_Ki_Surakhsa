// Forecast fixtures for Saans Shala (Section 5) in mock mode.
// Follows the contract components['schemas']['ForecastResponse'] with hourly entries.
import type { components } from '../../../packages/contracts/types';
import type { Category } from './airQuality';

export type ForecastResponse = components['schemas']['ForecastResponse'];
export type ForecastHour = components['schemas']['ForecastHour'];

function build24Hours(
  startHour: number,
  pattern: { hour: number; aqi: number; category: Category; pm25: number }[],
  baseDate = new Date()
): ForecastHour[] {
  const result: ForecastHour[] = [];
  // Use current date as basis
  const curHour = baseDate.getHours();
  for (let i = 0; i < 24; i++) {
    const d = new Date(baseDate.getTime() + i * 60 * 60 * 1000);
    const h = d.getHours();
    
    // Format ISO string in IST (+05:30)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hourStr = String(h).padStart(2, '0');
    const time = `${year}-${month}-${day}T${hourStr}:00:00+05:30`;

    // Pick closest match from pattern by hour-of-day
    const match = pattern.find((p) => p.hour === h) || pattern[(i + curHour) % pattern.length] || pattern[pattern.length - 1];
    result.push({
      time,
      aqi: match.aqi,
      category: match.category,
      pm25_ug_m3: match.pm25,
    });
  }
  return result;
}

// Poor day fixture: Starts moderate in morning, worsens after 5 pm (17:00) to poor
const POOR_DAY_HOURS = build24Hours(9, [
  { hour: 9, aqi: 130, category: 'moderate', pm25: 68 },
  { hour: 10, aqi: 145, category: 'moderate', pm25: 74 },
  { hour: 11, aqi: 155, category: 'moderate', pm25: 78 },
  { hour: 12, aqi: 140, category: 'moderate', pm25: 72 },
  { hour: 13, aqi: 125, category: 'moderate', pm25: 66 },
  { hour: 14, aqi: 135, category: 'moderate', pm25: 70 },
  { hour: 15, aqi: 160, category: 'moderate', pm25: 80 },
  { hour: 16, aqi: 185, category: 'moderate', pm25: 90 },
  { hour: 17, aqi: 245, category: 'poor', pm25: 105 }, // Worsens after 5 pm
  { hour: 18, aqi: 260, category: 'poor', pm25: 112 },
  { hour: 19, aqi: 275, category: 'poor', pm25: 120 },
  { hour: 20, aqi: 285, category: 'poor', pm25: 126 },
  { hour: 21, aqi: 290, category: 'poor', pm25: 128 },
  { hour: 22, aqi: 295, category: 'poor', pm25: 130 },
  { hour: 23, aqi: 305, category: 'very_poor', pm25: 135 },
  { hour: 0, aqi: 310, category: 'very_poor', pm25: 138 },
  { hour: 1, aqi: 315, category: 'very_poor', pm25: 140 },
  { hour: 2, aqi: 320, category: 'very_poor', pm25: 142 },
  { hour: 3, aqi: 325, category: 'very_poor', pm25: 144 },
  { hour: 4, aqi: 330, category: 'very_poor', pm25: 146 },
  { hour: 5, aqi: 320, category: 'very_poor', pm25: 142 },
  { hour: 6, aqi: 290, category: 'poor', pm25: 128 },
  { hour: 7, aqi: 250, category: 'poor', pm25: 108 },
  { hour: 8, aqi: 200, category: 'poor', pm25: 95 },
]);

// Moderate day fixture: Starts satisfactory, worsens after 3 pm (15:00) to moderate
const MODERATE_DAY_HOURS = build24Hours(9, [
  { hour: 9, aqi: 85, category: 'satisfactory', pm25: 48 },
  { hour: 10, aqi: 88, category: 'satisfactory', pm25: 50 },
  { hour: 11, aqi: 92, category: 'satisfactory', pm25: 52 },
  { hour: 12, aqi: 80, category: 'satisfactory', pm25: 45 },
  { hour: 13, aqi: 75, category: 'satisfactory', pm25: 42 },
  { hour: 14, aqi: 85, category: 'satisfactory', pm25: 48 },
  { hour: 15, aqi: 125, category: 'moderate', pm25: 66 }, // Worsens after 3 pm
  { hour: 16, aqi: 140, category: 'moderate', pm25: 72 },
  { hour: 17, aqi: 155, category: 'moderate', pm25: 78 },
  { hour: 18, aqi: 165, category: 'moderate', pm25: 82 },
  { hour: 19, aqi: 170, category: 'moderate', pm25: 84 },
  { hour: 20, aqi: 160, category: 'moderate', pm25: 80 },
]);

// Good day fixture: Stays good across all hours (trend sentence should be null)
const GOOD_DAY_HOURS = build24Hours(9, [
  { hour: 9, aqi: 40, category: 'good', pm25: 24 },
  { hour: 10, aqi: 42, category: 'good', pm25: 25 },
  { hour: 11, aqi: 45, category: 'good', pm25: 27 },
  { hour: 12, aqi: 38, category: 'good', pm25: 23 },
  { hour: 13, aqi: 35, category: 'good', pm25: 21 },
  { hour: 14, aqi: 36, category: 'good', pm25: 22 },
  { hour: 15, aqi: 42, category: 'good', pm25: 25 },
  { hour: 16, aqi: 46, category: 'good', pm25: 28 },
  { hour: 17, aqi: 48, category: 'good', pm25: 29 },
  { hour: 18, aqi: 45, category: 'good', pm25: 27 },
]);

// Satisfactory day fixture:
const SATISFACTORY_DAY_HOURS = build24Hours(9, [
  { hour: 9, aqi: 75, category: 'satisfactory', pm25: 42 },
  { hour: 10, aqi: 80, category: 'satisfactory', pm25: 45 },
  { hour: 11, aqi: 85, category: 'satisfactory', pm25: 48 },
  { hour: 12, aqi: 78, category: 'satisfactory', pm25: 44 },
  { hour: 13, aqi: 70, category: 'satisfactory', pm25: 40 },
  { hour: 14, aqi: 74, category: 'satisfactory', pm25: 42 },
  { hour: 15, aqi: 82, category: 'satisfactory', pm25: 46 },
  { hour: 16, aqi: 90, category: 'satisfactory', pm25: 51 },
  { hour: 17, aqi: 115, category: 'moderate', pm25: 62 },
  { hour: 18, aqi: 125, category: 'moderate', pm25: 66 },
]);

// Very poor day fixture: Starts very poor, improves after 2 pm (14:00) to poor
const VERY_POOR_DAY_HOURS = build24Hours(9, [
  { hour: 9, aqi: 340, category: 'very_poor', pm25: 150 },
  { hour: 10, aqi: 345, category: 'very_poor', pm25: 152 },
  { hour: 11, aqi: 335, category: 'very_poor', pm25: 148 },
  { hour: 12, aqi: 320, category: 'very_poor', pm25: 142 },
  { hour: 13, aqi: 310, category: 'very_poor', pm25: 138 },
  { hour: 14, aqi: 280, category: 'poor', pm25: 122 }, // Improves after 2 pm
  { hour: 15, aqi: 265, category: 'poor', pm25: 115 },
  { hour: 16, aqi: 250, category: 'poor', pm25: 108 },
  { hour: 17, aqi: 260, category: 'poor', pm25: 112 },
  { hour: 18, aqi: 285, category: 'poor', pm25: 124 },
]);

// Severe day fixture:
const SEVERE_DAY_HOURS = build24Hours(9, [
  { hour: 9, aqi: 440, category: 'severe', pm25: 275 },
  { hour: 10, aqi: 450, category: 'severe', pm25: 285 },
  { hour: 11, aqi: 445, category: 'severe', pm25: 280 },
  { hour: 12, aqi: 430, category: 'severe', pm25: 265 },
  { hour: 13, aqi: 420, category: 'severe', pm25: 255 },
  { hour: 14, aqi: 410, category: 'severe', pm25: 245 },
  { hour: 15, aqi: 425, category: 'severe', pm25: 260 },
  { hour: 16, aqi: 390, category: 'very_poor', pm25: 220 }, // Improves after 4 pm
  { hour: 17, aqi: 395, category: 'very_poor', pm25: 225 },
  { hour: 18, aqi: 430, category: 'severe', pm25: 265 },
]);

export const FORECAST_FIXTURES: Record<Category, ForecastResponse> = {
  poor: {
    lat: 30.245,
    lon: 75.843,
    generated_at: '2026-10-08T08:00:00+05:30',
    model: 'open_meteo_cams',
    model_version: '0.2.0',
    hours: POOR_DAY_HOURS,
  },
  moderate: {
    lat: 30.245,
    lon: 75.843,
    generated_at: '2026-10-08T08:00:00+05:30',
    model: 'open_meteo_cams',
    model_version: '0.2.0',
    hours: MODERATE_DAY_HOURS,
  },
  good: {
    lat: 30.245,
    lon: 75.843,
    generated_at: '2026-10-08T08:00:00+05:30',
    model: 'open_meteo_cams',
    model_version: '0.2.0',
    hours: GOOD_DAY_HOURS,
  },
  satisfactory: {
    lat: 30.245,
    lon: 75.843,
    generated_at: '2026-10-08T08:00:00+05:30',
    model: 'open_meteo_cams',
    model_version: '0.2.0',
    hours: SATISFACTORY_DAY_HOURS,
  },
  very_poor: {
    lat: 30.245,
    lon: 75.843,
    generated_at: '2026-10-08T08:00:00+05:30',
    model: 'open_meteo_cams',
    model_version: '0.2.0',
    hours: VERY_POOR_DAY_HOURS,
  },
  severe: {
    lat: 30.245,
    lon: 75.843,
    generated_at: '2026-10-08T08:00:00+05:30',
    model: 'open_meteo_cams',
    model_version: '0.2.0',
    hours: SEVERE_DAY_HOURS,
  },
};

const PATTERNS_BY_CATEGORY: Record<Category, { hour: number; aqi: number; category: Category; pm25: number }[]> = {
  poor: [
    { hour: 9, aqi: 130, category: 'moderate', pm25: 68 },
    { hour: 13, aqi: 125, category: 'moderate', pm25: 66 },
    { hour: 17, aqi: 245, category: 'poor', pm25: 105 },
    { hour: 20, aqi: 285, category: 'poor', pm25: 126 },
  ],
  moderate: [
    { hour: 9, aqi: 85, category: 'satisfactory', pm25: 48 },
    { hour: 13, aqi: 75, category: 'satisfactory', pm25: 42 },
    { hour: 15, aqi: 125, category: 'moderate', pm25: 66 },
    { hour: 19, aqi: 170, category: 'moderate', pm25: 84 },
  ],
  good: [
    { hour: 9, aqi: 40, category: 'good', pm25: 24 },
    { hour: 13, aqi: 35, category: 'good', pm25: 21 },
    { hour: 17, aqi: 48, category: 'good', pm25: 29 },
  ],
  satisfactory: [
    { hour: 9, aqi: 75, category: 'satisfactory', pm25: 42 },
    { hour: 13, aqi: 70, category: 'satisfactory', pm25: 40 },
    { hour: 17, aqi: 115, category: 'moderate', pm25: 62 },
  ],
  very_poor: [
    { hour: 9, aqi: 340, category: 'very_poor', pm25: 150 },
    { hour: 14, aqi: 280, category: 'poor', pm25: 122 },
    { hour: 18, aqi: 285, category: 'poor', pm25: 124 },
  ],
  severe: [
    { hour: 9, aqi: 440, category: 'severe', pm25: 275 },
    { hour: 13, aqi: 420, category: 'severe', pm25: 255 },
    { hour: 16, aqi: 390, category: 'very_poor', pm25: 220 },
    { hour: 18, aqi: 430, category: 'severe', pm25: 265 },
  ],
};

export function getDynamicForecastFixture(category: Category, now = new Date()): ForecastResponse {
  const base = FORECAST_FIXTURES[category] || FORECAST_FIXTURES.poor;
  const pattern = PATTERNS_BY_CATEGORY[category] || PATTERNS_BY_CATEGORY.poor;
  return {
    ...base,
    generated_at: now.toISOString(),
    hours: build24Hours(now.getHours(), pattern, now),
  };
}

/**
 * Checks whether coordinates fall into the forecast service's coverage area (Punjab & Delhi NCR).
 * Based on services/aqi/forecast/config.ts REGIONS.
 */
export function isForecastCovered(lat: number, lon: number): boolean {
  const inPunjab = lat >= 29.5 && lat <= 32.6 && lon >= 73.8 && lon <= 77.0;
  const inNcr = lat >= 27.0 && lat <= 30.0 && lon >= 75.9 && lon <= 78.6;
  return inPunjab || inNcr;
}
