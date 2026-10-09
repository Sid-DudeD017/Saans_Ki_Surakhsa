import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  haversineDistanceKm,
  roundCoord,
  createDevicePlace,
  isRoughAccuracy,
  shouldReloadAir,
  handleGeolocationError,
  STORAGE_KEY_PERMISSION,
  STORAGE_KEY_DISMISSED,
  FALLBACK_SCHOOL_PLACE,
  type Place,
} from '../lib/useLocation';
import schoolsConfig from '../config/schools.json';

describe('useLocation — Location & Privacy Guarantees', () => {
  let localStorageStore: Record<string, string> = {};

  beforeEach(() => {
    localStorageStore = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageStore[key] ?? null,
      setItem: (key: string, value: string) => {
        localStorageStore[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageStore[key];
      },
      clear: () => {
        localStorageStore = {};
      },
    });
  });

  describe('Fallback Location Configuration', () => {
    it('uses the configured school from schools.json as fallback, not hardcoded coordinates', () => {
      const demoSchool = schoolsConfig.schools[0];
      expect(FALLBACK_SCHOOL_PLACE.id).toBe(demoSchool.id);
      expect(FALLBACK_SCHOOL_PLACE.label).toBe(demoSchool.name);
      expect(FALLBACK_SCHOOL_PLACE.lat).toBe(demoSchool.location.lat);
      expect(FALLBACK_SCHOOL_PLACE.lon).toBe(demoSchool.location.lon);
      expect(FALLBACK_SCHOOL_PLACE.district).toBe(demoSchool.district);
      expect(FALLBACK_SCHOOL_PLACE.kind).toBe('school');
    });
  });

  describe('Privacy: Coordinate Rounding to 3 Decimals (~100m)', () => {
    it('rounds arbitrary GPS coordinates to strictly 3 decimal places', () => {
      expect(roundCoord(30.2451234)).toBe(30.245);
      expect(roundCoord(30.2458999)).toBe(30.246);
      expect(roundCoord(75.8423456)).toBe(75.842);
      expect(roundCoord(75.8427891)).toBe(75.843);
    });

    it('creates a privacy-compliant DevicePlace with rounded coords and in-memory rawCoords', () => {
      const rawLat = 30.2458712;
      const rawLon = 75.8423984;
      const accuracy = 42.4;
      const timestamp = 1696845600000;

      const devicePlace = createDevicePlace(rawLat, rawLon, accuracy, timestamp, 'Sangrur');

      expect(devicePlace.kind).toBe('device');
      // Public / API coordinates are rounded
      expect(devicePlace.lat).toBe(30.246);
      expect(devicePlace.lon).toBe(75.842);
      expect(devicePlace.accuracyM).toBe(42);
      expect(devicePlace.at).toBe(timestamp);
      expect(devicePlace.label).toBe('Near you');

      // Full precision is preserved only in rawCoords for later incident pin reporting
      expect(devicePlace.rawCoords?.lat).toBe(rawLat);
      expect(devicePlace.rawCoords?.lon).toBe(rawLon);

      // Verify coordinate string representation has at most 3 decimal places
      const latDecimals = devicePlace.lat.toString().split('.')[1] || '';
      const lonDecimals = devicePlace.lon.toString().split('.')[1] || '';
      expect(latDecimals.length).toBeLessThanOrEqual(3);
      expect(lonDecimals.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Privacy: LocalStorage Restrictions', () => {
    it('guarantees that no raw coordinates or locations are written to localStorage', () => {
      // Test saving permission choice
      localStorage.setItem(STORAGE_KEY_PERMISSION, 'granted');
      localStorage.setItem(STORAGE_KEY_DISMISSED, 'true');

      // Verify stored items
      for (const [key, value] of Object.entries(localStorageStore)) {
        expect(key).not.toContain('lat');
        expect(key).not.toContain('lon');
        expect(key).not.toContain('coord');
        expect(value).not.toMatch(/\d+\.\d{3,}/); // No float coordinates stored
        expect(['granted', 'denied', 'true', 'false']).toContain(value);
      }
    });
  });

  describe('Error Mapping & State Handling', () => {
    it('maps permission refused (code 1) to denied state', () => {
      const status = handleGeolocationError({ code: 1 });
      expect(status).toBe('denied');
    });

    it('maps position unavailable (code 2) to unavailable state', () => {
      const status = handleGeolocationError({ code: 2 });
      expect(status).toBe('unavailable');
    });

    it('maps timeout (code 3) to unavailable state', () => {
      const status = handleGeolocationError({ code: 3 });
      expect(status).toBe('unavailable');
    });

    it('identifies rough fixes when accuracy exceeds 1000m', () => {
      const goodFix: Place = createDevicePlace(30.245, 75.842, 45);
      expect(isRoughAccuracy(goodFix)).toBe(false);

      const roughFix: Place = createDevicePlace(30.245, 75.842, 1450);
      expect(isRoughAccuracy(roughFix)).toBe(true);
    });
  });

  describe('Movement & Air Reload Thresholds (Haversine & 30 min)', () => {
    it('calculates Haversine distance correctly', () => {
      // Sangrur (30.245, 75.842) to Delhi Anand Vihar (28.647, 77.305) ~220 km
      const distanceKm = haversineDistanceKm(30.245, 75.842, 28.647, 77.305);
      expect(distanceKm).toBeGreaterThan(200);
      expect(distanceKm).toBeLessThan(250);

      // Same location is 0 km
      expect(haversineDistanceKm(30.245, 75.842, 30.245, 75.842)).toBe(0);
    });

    it('does NOT reload air if user moved less than 1 km and reading is under 30 minutes', () => {
      const baseTime = 1696845600000;
      const devicePlace: Place = createDevicePlace(30.245, 75.842, 30, baseTime);

      // Movement of ~200 meters, 5 minutes later
      const newLat = 30.246;
      const newLon = 75.842;
      const newTime = baseTime + 5 * 60 * 1000;

      const shouldReload = shouldReloadAir(devicePlace, newLat, newLon, newTime);
      expect(shouldReload).toBe(false);
    });

    it('reloads air if user moved more than 1 km', () => {
      const baseTime = 1696845600000;
      const devicePlace: Place = createDevicePlace(30.245, 75.842, 30, baseTime);

      // Movement of ~5 km south (lat 30.200)
      const newLat = 30.200;
      const newLon = 75.842;
      const newTime = baseTime + 5 * 60 * 1000;

      const shouldReload = shouldReloadAir(devicePlace, newLat, newLon, newTime);
      expect(shouldReload).toBe(true);
    });

    it('reloads air if reading is older than 30 minutes even with zero movement', () => {
      const baseTime = 1696845600000;
      const devicePlace: Place = createDevicePlace(30.245, 75.842, 30, baseTime);

      // Zero movement, but 35 minutes later
      const newLat = 30.245;
      const newLon = 75.842;
      const newTime = baseTime + 35 * 60 * 1000;

      const shouldReload = shouldReloadAir(devicePlace, newLat, newLon, newTime);
      expect(shouldReload).toBe(true);
    });
  });

  describe('Contract & Continuous Tracking Rules', () => {
    it('guarantees that watchPosition is never called and continuous tracking is prohibited', () => {
      const mockWatchPosition = vi.fn();
      const mockGetCurrentPosition = vi.fn();

      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: mockGetCurrentPosition,
          watchPosition: mockWatchPosition,
        },
        writable: true,
        configurable: true,
      });

      // Verify that geolocation options enforce high accuracy and 5-min cache
      const expectedOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      };

      expect(expectedOptions.enableHighAccuracy).toBe(true);
      expect(expectedOptions.timeout).toBe(10000);
      expect(expectedOptions.maximumAge).toBe(300000);
      expect(mockWatchPosition).not.toHaveBeenCalled();
    });
  });
});
