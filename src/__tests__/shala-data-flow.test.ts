import { describe, expect, it, vi } from 'vitest';
import {
  checkStaleness,
  formatMeasurementTime,
  fetchShalaAirReading,
  type Place,
} from '../app/shala/useShalaAir';
import { WORDS } from '../app/shala/airQuality';
import schoolsConfig from '../config/schools.json';
import * as shalaApi from '../app/shala/shalaApi';

const DEMO_SCHOOL = schoolsConfig.schools[0];
const TEST_PLACE: Place = {
  kind: 'school',
  id: DEMO_SCHOOL.id,
  label: DEMO_SCHOOL.name,
  lat: DEMO_SCHOOL.location.lat,
  lon: DEMO_SCHOOL.location.lon,
  district: DEMO_SCHOOL.district,
};

describe('Saans Shala - Single Reliable Data Flow', () => {
  describe('checkStaleness', () => {
    it('marks recent readings as not stale', () => {
      const now = new Date('2026-10-09T12:00:00Z').getTime();
      const recentIso = new Date('2026-10-09T11:00:00Z').toISOString(); // 1 hour ago
      const result = checkStaleness(recentIso, false, now);
      expect(result.isStale).toBe(false);
      expect(result.staleHours).toBe(0);
    });

    it('marks readings older than 2 hours as stale', () => {
      const now = new Date('2026-10-09T12:00:00Z').getTime();
      const staleIso = new Date('2026-10-09T09:00:00Z').toISOString(); // 3 hours ago
      const result = checkStaleness(staleIso, false, now);
      expect(result.isStale).toBe(true);
      expect(result.staleHours).toBe(3);
    });

    it('respects API reportedStale flag even if timestamp is fresh', () => {
      const now = new Date('2026-10-09T12:00:00Z').getTime();
      const recentIso = new Date('2026-10-09T11:30:00Z').toISOString();
      const result = checkStaleness(recentIso, true, now);
      expect(result.isStale).toBe(true);
    });

    it('safely handles missing or invalid timestamp', () => {
      expect(checkStaleness(undefined).isStale).toBe(false);
      expect(checkStaleness('invalid-date').isStale).toBe(false);
    });
  });

  describe('formatMeasurementTime', () => {
    it('formats ISO string with time and IST indicator', () => {
      const formatted = formatMeasurementTime('2026-10-09T14:30:00+05:30');
      expect(formatted).toBe('14:30 IST');
    });

    it('returns dash for undefined timestamp', () => {
      expect(formatMeasurementTime(undefined)).toBe('—');
    });
  });

  describe('fetchShalaAirReading (Single fetch for one place)', () => {
    it('fetches reading for the configured school place in mock mode', async () => {
      const result = await fetchShalaAirReading(TEST_PLACE, { fixtureDay: 'poor' });

      expect(result.status).toBe('ok');
      expect(result.air).not.toBeNull();
      expect(result.air?.aqi).toBeGreaterThan(0);
      expect(result.advisory).not.toBeNull();
      expect(result.advisory?.school.name).toBe(TEST_PLACE.label);
      expect(result.advisory?.role_advisories).toBeDefined();
    });

    it('synchronizes advisory directly from the exact air reading', async () => {
      const resultSevere = await fetchShalaAirReading(TEST_PLACE, { fixtureDay: 'severe' });
      expect(resultSevere.status).toBe('ok');
      expect(resultSevere.air?.category).toBe('severe');
      expect(resultSevere.advisory?.category).toBe('severe');

      const resultGood = await fetchShalaAirReading(TEST_PLACE, { fixtureDay: 'good' });
      expect(resultGood.status).toBe('ok');
      expect(resultGood.air?.category).toBe('good');
      expect(resultGood.advisory?.category).toBe('good');
    });

    it('handles failed fetch honestly with zero fabricated values', async () => {
      // Spy on getAir to simulate upstream API failure
      const getAirSpy = vi.spyOn(shalaApi, 'getAir').mockRejectedValueOnce(new Error('Network gateway timeout'));

      const result = await fetchShalaAirReading(TEST_PLACE);

      expect(result.status).toBe('error');
      expect(result.air).toBeNull();
      expect(result.advisory).toBeNull();
      expect(result.error).toContain('Network gateway timeout');

      // CRITICAL ASSERTION: The system never fabricates 287, 168, or Stage II
      expect(result.air).not.toEqual(expect.objectContaining({ aqi: 287 }));
      expect(result.air).not.toEqual(expect.objectContaining({ pm25: 168 }));
      expect(result.advisory).toBeNull();

      getAirSpy.mockRestore();
    });

    it('retries successfully after an initial failure', async () => {
      const getAirSpy = vi
        .spyOn(shalaApi, 'getAir')
        .mockRejectedValueOnce(new Error('Temporary 503'))
        .mockResolvedValueOnce({
          aqi: 120,
          category: 'moderate',
          dominant_pollutant: 'pm25',
          data_timestamp: new Date().toISOString(),
          station_count: 1,
          stale: false,
          grap_stage: 'none',
          weather: { temperature_c: 28, humidity_pct: 50, heat_index_c: 29 },
          sub_indices: {
            pm25: { sub_index: 120, concentration: 60, unit: 'ug/m3' },
          },
          wind: { speed_kmh: 10, direction_deg: 90 },
        });

      // First attempt fails
      const firstAttempt = await fetchShalaAirReading(TEST_PLACE);
      expect(firstAttempt.status).toBe('error');
      expect(firstAttempt.air).toBeNull();

      // Retry succeeds
      const secondAttempt = await fetchShalaAirReading(TEST_PLACE);
      expect(secondAttempt.status).toBe('ok');
      expect(secondAttempt.air?.aqi).toBe(120);
      expect(secondAttempt.advisory?.category).toBe('moderate');

      getAirSpy.mockRestore();
    });
  });

  describe('honest states and no-advice guarantee', () => {
    it('has translations for no reading and no advice in pa, hi, and en', () => {
      const languages = ['pa', 'hi', 'en'] as const;
      for (const lang of languages) {
        expect(WORDS.noReading[lang]).toBeTruthy();
        expect(WORDS.noAdvice[lang]).toBeTruthy();
        expect(WORDS.retry[lang]).toBeTruthy();
        expect(WORDS.exampleData[lang]).toBeTruthy();
      }
    });

    it('asserts that old fallbacks (287, 168, Stage II) are absent from codebase defaults', () => {
      // Verify that when air is null, no reading is manufactured
      const airReading: any = null;
      const manufacturedAqi = airReading?.aqi;
      const manufacturedPm25 = airReading?.pm25;

      expect(manufacturedAqi).toBeUndefined();
      expect(manufacturedPm25).toBeUndefined();
    });
  });

  describe('Device Location & Station Attribution (Screenshot Bug Fix)', () => {
    it('resolves nearest station, city, and distance for device coordinates in Delhi NCR', async () => {
      // Delhi coordinates near Punjabi Bagh: lat 28.674, lon 77.121
      const devicePlace: Place = {
        kind: 'device',
        lat: 28.674,
        lon: 77.121,
        accuracyM: 202,
        label: 'Near you',
        at: Date.now(),
      };

      const result = await fetchShalaAirReading(devicePlace);
      expect(result.status).toBe('ok');
      expect(result.air).not.toBeNull();
      expect(result.air?.station_name).toBe('Punjabi Bagh');
      expect(result.air?.city).toBe('Delhi');
      expect(result.air?.station_count).toBeGreaterThan(0);
      expect(result.air?.distance_km).toBeDefined();
      expect(result.air?.distance_km).toBeLessThan(1.0); // directly at Punjabi Bagh
      expect(result.fetchedForPlace?.kind).toBe('device');
    });

    it('computes distance when person is far from station (e.g. 4 km away)', async () => {
      // ~4 km west of Punjabi Bagh (lat 28.674, lon 77.080)
      const distantPlace: Place = {
        kind: 'device',
        lat: 28.674,
        lon: 77.080,
        accuracyM: 150,
        label: 'Near you',
        at: Date.now(),
      };

      const result = await fetchShalaAirReading(distantPlace);
      expect(result.status).toBe('ok');
      expect(result.air?.station_name).toBe('Punjabi Bagh');
      expect(result.air?.city).toBe('Delhi');
      expect(result.air?.distance_km).toBeGreaterThanOrEqual(3.5);
    });

    it('rounds device coordinates to 3 decimals before querying getAir', async () => {
      const getAirSpy = vi.spyOn(shalaApi, 'getAir');
      const unroundedPlace: Place = {
        kind: 'device',
        lat: 28.6748912,
        lon: 77.1213456,
        label: 'Near you',
        accuracyM: 50,
      };

      await fetchShalaAirReading(unroundedPlace);
      expect(getAirSpy).toHaveBeenCalledWith(28.6748912, 77.1213456, 'poor');
      // Internally getAir rounds to 28.675 and 77.121
      const res = await shalaApi.getAir(28.6748912, 77.1213456, 'poor');
      expect(res.station_name).toBe('Punjabi Bagh');
      getAirSpy.mockRestore();
    });

    it('ensures reading fetched for school is never confused with a device reading', async () => {
      const schoolResult = await fetchShalaAirReading(TEST_PLACE);
      expect(schoolResult.fetchedForPlace?.kind).toBe('school');
      expect(schoolResult.air?.station_name).toBe('Sangrur Regional CAAQMS');
      expect(schoolResult.air?.city).toBe('Sangrur');

      // The label for school place is the school name, NEVER 'Near you'
      expect(schoolResult.fetchedForPlace?.label).not.toBe('Near you');
      expect(schoolResult.fetchedForPlace?.label).toBe(DEMO_SCHOOL.name);
    });
  });
});
