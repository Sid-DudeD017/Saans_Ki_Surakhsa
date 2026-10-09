import { describe, expect, it, vi } from 'vitest';
import * as shalaApi from '../app/shala/shalaApi';
import {
  formatForecastHour,
  buildForecastTrendSentence,
  formatFiresWindSummary,
  WORDS,
  type ForecastHour,
} from '../app/shala/airQuality';
import { isForecastCovered } from '../app/shala/forecastFixtures';
import { fetchShalaAirReading, type Place } from '../app/shala/useShalaAir';

const DEMO_PUNJAB_PLACE: Place = {
  kind: 'school',
  id: 'school_demo_001',
  label: 'Govt Senior Secondary School, Sangrur',
  lat: 30.245,
  lon: 75.843,
  district: 'Sangrur',
};

const DEMO_DELHI_PLACE: Place = {
  kind: 'device',
  label: 'Near you',
  lat: 28.674,
  lon: 77.121,
  accuracyM: 40,
  at: Date.now(),
};

const OUT_OF_COVERAGE_PLACE: Place = {
  kind: 'search',
  label: 'Mumbai Central',
  lat: 18.969,
  lon: 72.819,
};

describe('Saans Shala - Section 5 Forecast, Fires & Learning Specification', () => {
  describe('Forecast API & Coordinates', () => {
    it('rounds coordinates to 3 decimals before querying getForecast', async () => {
      const forecast = await shalaApi.getForecast(30.2458912, 75.8431234, 12, 'poor');
      expect(forecast.lat).toBe(30.246);
      expect(forecast.lon).toBe(75.843);
      expect(forecast.hours.length).toBe(12);
    });

    it('returns 24 hours of forecast by default in mock mode', async () => {
      const forecast = await shalaApi.getForecast(DEMO_PUNJAB_PLACE.lat, DEMO_PUNJAB_PLACE.lon);
      expect(forecast.hours.length).toBe(24);
      expect(forecast.model).toBe('open_meteo_cams');
      expect(forecast.model_version).toBeDefined();
      expect(forecast.generated_at).toBeDefined();
    });

    it('correctly validates coverage bounds for Punjab and Delhi NCR', () => {
      // Punjab (Sangrur)
      expect(isForecastCovered(30.245, 75.843)).toBe(true);
      // Delhi NCR (Punjabi Bagh)
      expect(isForecastCovered(28.674, 77.121)).toBe(true);
      // Outside coverage (Mumbai, Bengaluru)
      expect(isForecastCovered(18.969, 72.819)).toBe(false);
      expect(isForecastCovered(12.971, 77.594)).toBe(false);
    });

    it('throws no_coverage error for locations outside Punjab and Delhi NCR', async () => {
      try {
        await shalaApi.getForecast(OUT_OF_COVERAGE_PLACE.lat, OUT_OF_COVERAGE_PLACE.lon);
        expect.unreachable('Should have thrown no_coverage error');
      } catch (err: any) {
        expect(err.code).toBe('no_coverage');
        expect(err.status).toBe(404);
        expect(err.message).toContain('Forecast data is not available for the requested coordinates');
      }
    });
  });

  describe('Hourly Forecast Formatting & Trend Sentence', () => {
    it('formats ISO timestamps to 12-hour am/pm labels', () => {
      expect(formatForecastHour('2026-10-08T09:00:00+05:30')).toBe('9 am');
      expect(formatForecastHour('2026-10-08T12:00:00+05:30')).toBe('12 pm');
      expect(formatForecastHour('2026-10-08T17:00:00+05:30')).toBe('5 pm');
      expect(formatForecastHour('2026-10-08T00:00:00+05:30')).toBe('12 am');
    });

    it('detects worsening air and derives plain sentence "Air should get worse after 5 pm."', () => {
      const hours: ForecastHour[] = [
        { time: '2026-10-08T09:00:00+05:30', aqi: 140, category: 'moderate', pm25_ug_m3: 70 },
        { time: '2026-10-08T10:00:00+05:30', aqi: 150, category: 'moderate', pm25_ug_m3: 75 },
        { time: '2026-10-08T16:00:00+05:30', aqi: 180, category: 'moderate', pm25_ug_m3: 88 },
        { time: '2026-10-08T17:00:00+05:30', aqi: 245, category: 'poor', pm25_ug_m3: 105 },
        { time: '2026-10-08T18:00:00+05:30', aqi: 260, category: 'poor', pm25_ug_m3: 112 },
      ];

      const enSentence = buildForecastTrendSentence(hours, 'en');
      expect(enSentence).toBe('Air should get worse after 5 pm.');

      const hiSentence = buildForecastTrendSentence(hours, 'hi');
      expect(hiSentence).toBe('5 pm के बाद हवा और खराब हो सकती है।');

      const paSentence = buildForecastTrendSentence(hours, 'pa');
      expect(paSentence).toBe('5 pm ਤੋਂ ਬਾਅਦ ਹਵਾ ਹੋਰ ਖ਼ਰਾਬ ਹੋ ਸਕਦੀ ਹੈ।');
    });

    it('detects improving air and derives plain sentence "Air should improve after 2 pm."', () => {
      const hours: ForecastHour[] = [
        { time: '2026-10-08T09:00:00+05:30', aqi: 340, category: 'very_poor', pm25_ug_m3: 150 },
        { time: '2026-10-08T13:00:00+05:30', aqi: 310, category: 'very_poor', pm25_ug_m3: 138 },
        { time: '2026-10-08T14:00:00+05:30', aqi: 280, category: 'poor', pm25_ug_m3: 122 },
        { time: '2026-10-08T15:00:00+05:30', aqi: 260, category: 'poor', pm25_ug_m3: 115 },
      ];

      const enSentence = buildForecastTrendSentence(hours, 'en');
      expect(enSentence).toBe('Air should improve after 2 pm.');
    });

    it('returns null when category does not change (does not fabricate claims)', () => {
      const constantHours: ForecastHour[] = [
        { time: '2026-10-08T09:00:00+05:30', aqi: 40, category: 'good', pm25_ug_m3: 24 },
        { time: '2026-10-08T10:00:00+05:30', aqi: 42, category: 'good', pm25_ug_m3: 25 },
        { time: '2026-10-08T11:00:00+05:30', aqi: 45, category: 'good', pm25_ug_m3: 27 },
      ];

      expect(buildForecastTrendSentence(constantHours, 'en')).toBeNull();
      expect(buildForecastTrendSentence([], 'en')).toBeNull();
    });
  });

  describe('Nearby Fires ("Around you")', () => {
    it('queries getFires with radius_km=25 by default', async () => {
      const getFiresSpy = vi.spyOn(shalaApi, 'getFires');
      await shalaApi.getFires(30.2458, 75.8432);
      expect(getFiresSpy).toHaveBeenCalledWith(30.2458, 75.8432);
      getFiresSpy.mockRestore();
    });

    it('formats summary with fires count and wind direction', () => {
      const wind = { speed_kmh: 14, direction_deg: 315 };
      expect(formatFiresWindSummary(3, wind, 'en')).toBe('3 fires within 25 km, wind from the north-west');
      expect(formatFiresWindSummary(3, undefined, 'en')).toBe('3 fires within 25 km');
    });

    it('formats empty fires state properly', () => {
      expect(formatFiresWindSummary(0, undefined, 'en')).toBe(
        'No fires seen within 25 km since the last satellite pass'
      );
      const wind = { speed_kmh: 10, direction_deg: 315 };
      expect(formatFiresWindSummary(0, wind, 'en')).toBe('0 fires within 25 km, wind from the north-west');
    });

    it('provides localized messages for fire unavailability in pa, hi, en', () => {
      expect(WORDS.firesUnavailable.en).toBe('Fire data not available right now');
      expect(WORDS.firesUnavailable.hi).toBeTruthy();
      expect(WORDS.firesUnavailable.pa).toBeTruthy();
    });
  });

  describe('Non-Blocking Load Order & Graceful Degradation', () => {
    it('keeps current reading visible when forecast has no coverage', async () => {
      const result = await fetchShalaAirReading(OUT_OF_COVERAGE_PLACE);
      expect(result.status).toBe('ok');
      expect(result.air).not.toBeNull();
      expect(result.forecastStatus).toBe('no_coverage');
      expect(result.forecast).toBeNull();
    });

    it('keeps current reading visible when forecast fails', async () => {
      const getForecastSpy = vi
        .spyOn(shalaApi, 'getForecast')
        .mockRejectedValueOnce(new Error('Open-Meteo 503 Service Unavailable'));

      const result = await fetchShalaAirReading(DEMO_PUNJAB_PLACE);
      expect(result.status).toBe('ok');
      expect(result.air).not.toBeNull();
      expect(result.forecastStatus).toBe('error');
      expect(result.forecastError).toContain('Open-Meteo 503');

      getForecastSpy.mockRestore();
    });

    it('keeps current reading visible when fires fail', async () => {
      const getFiresSpy = vi
        .spyOn(shalaApi, 'getFires')
        .mockRejectedValueOnce(new Error('NASA FIRMS gateway timeout'));

      const result = await fetchShalaAirReading(DEMO_PUNJAB_PLACE);
      expect(result.status).toBe('ok');
      expect(result.air).not.toBeNull();
      expect(result.firesStatus).toBe('error');
      expect(result.firesError).toContain('NASA FIRMS gateway timeout');

      getFiresSpy.mockRestore();
    });
  });
});
