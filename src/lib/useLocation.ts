'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import schoolsConfig from '../config/schools.json';

export type LocationStatus =
  | 'idle'
  | 'asking'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'insecure';

export interface DevicePlace {
  kind: 'device';
  lat: number; // rounded to 3 decimals (~100m) for privacy
  lon: number; // rounded to 3 decimals (~100m) for privacy
  accuracyM: number;
  at: number;
  label: string;
  rawCoords?: { lat: number; lon: number }; // preserved only in memory for incident report pin
  id?: string;
  district?: string;
}

export interface SchoolOrSearchPlace {
  kind: 'school' | 'search';
  lat: number;
  lon: number;
  label: string;
  id?: string;
  district?: string;
}

export type Place = DevicePlace | SchoolOrSearchPlace;

export const DEFAULT_SCHOOL = schoolsConfig.schools[0];

export const FALLBACK_SCHOOL_PLACE: SchoolOrSearchPlace = {
  kind: 'school',
  id: DEFAULT_SCHOOL.id,
  label: DEFAULT_SCHOOL.name,
  lat: DEFAULT_SCHOOL.location.lat,
  lon: DEFAULT_SCHOOL.location.lon,
  district: DEFAULT_SCHOOL.district,
};

/**
 * Calculates Haversine distance in kilometres between two coordinates.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Rounds coordinate to 3 decimal places (~100m precision) so server logs never hold a home address.
 */
export function roundCoord(val: number): number {
  return Math.round(val * 1000) / 1000;
}

export const STORAGE_KEY_PERMISSION = 'saans_location_permission';
export const STORAGE_KEY_DISMISSED = 'saans_location_dismissed';

/**
 * Creates a privacy-compliant DevicePlace with coordinates rounded to 3 decimals.
 */
export function createDevicePlace(
  rawLat: number,
  rawLon: number,
  accuracyM: number,
  timestamp = Date.now(),
  district?: string
): DevicePlace {
  return {
    kind: 'device',
    lat: roundCoord(rawLat),
    lon: roundCoord(rawLon),
    accuracyM: Math.round(accuracyM),
    at: timestamp,
    label: 'Near you',
    rawCoords: { lat: rawLat, lon: rawLon },
    district,
  };
}

/**
 * Checks whether an accuracy fix is rough (> 1,000 metres).
 */
export function isRoughAccuracy(place: Place): boolean {
  return place.kind === 'device' && place.accuracyM > 1000;
}

/**
 * Determines whether moving/visibility should trigger an air data reload.
 * True only if moved >= 1 km or reading age >= 30 minutes.
 */
export function shouldReloadAir(
  currentPlace: Place,
  newLat: number,
  newLon: number,
  nowMs = Date.now()
): boolean {
  if (currentPlace.kind !== 'device') return true;
  const distanceKm = haversineDistanceKm(currentPlace.lat, currentPlace.lon, newLat, newLon);
  const ageMs = Math.max(0, nowMs - currentPlace.at);
  return distanceKm >= 1.0 || ageMs >= 30 * 60 * 1000;
}

/**
 * Maps GeolocationPositionError to LocationStatus.
 */
export function handleGeolocationError(error: { code: number }): LocationStatus {
  if (error.code === 1) return 'denied';
  return 'unavailable';
}

export interface UseLocationOptions {
  fallback?: SchoolOrSearchPlace;
}

export interface UseLocationResult {
  place: Place;
  status: LocationStatus;
  ask: () => void;
  setPlace: (p: Place) => void;
  dismissPrompt: () => void;
  promptDismissed: boolean;
  isRough: boolean;
}

/**
 * Shared hook for privacy-first geolocation and place selection.
 * Never calls watchPosition, never requests location on page load, and rounds coordinates to 3 decimals.
 */
export function useLocation(options?: UseLocationOptions): UseLocationResult {
  const fallback = options?.fallback ?? FALLBACK_SCHOOL_PLACE;
  const [place, setPlaceState] = useState<Place>(fallback);
  const [status, setStatus] = useState<LocationStatus>(() => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      return 'insecure';
    }
    return 'idle';
  });

  const [promptDismissed, setPromptDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEY_DISMISSED) === 'true';
    } catch {
      return false;
    }
  });

  const placeRef = useRef(place);
  useEffect(() => {
    placeRef.current = place;
  }, [place]);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Read persisted choices safely on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.isSecureContext === false) return;

    try {
      const storedPerm = localStorage.getItem(STORAGE_KEY_PERMISSION);
      if (storedPerm === 'granted' || storedPerm === 'denied') {
        // Query permissions API asynchronously to confirm state
        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions
            .query({ name: 'geolocation' })
            .then((res) => {
              if (res.state === 'granted') {
                // On subsequent visit where permission was already granted, answer silently
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const rawLat = pos.coords.latitude;
                      const rawLon = pos.coords.longitude;
                      const roundedLat = roundCoord(rawLat);
                      const roundedLon = roundCoord(rawLon);
                      const accuracyM = Math.round(pos.coords.accuracy);

                      setPlaceState({
                        kind: 'device',
                        lat: roundedLat,
                        lon: roundedLon,
                        accuracyM,
                        at: pos.timestamp || Date.now(),
                        label: 'Near you',
                        rawCoords: { lat: rawLat, lon: rawLon },
                      });
                      setStatus('granted');
                    },
                    (err) => {
                      if (err.code === 1) setStatus('denied');
                      else setStatus('unavailable');
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
                  );
                }
              } else if (res.state === 'denied') {
                setStatus('denied');
              }
            })
            .catch(() => {
              // Ignore permissions query failures
            });
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Request device position on user tap
  const ask = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (window.isSecureContext === false || !navigator.geolocation) {
      setStatus('insecure');
      return;
    }

    setStatus('asking');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const rawLat = pos.coords.latitude;
        const rawLon = pos.coords.longitude;
        const roundedLat = roundCoord(rawLat);
        const roundedLon = roundCoord(rawLon);
        const accuracyM = Math.round(pos.coords.accuracy);

        const newPlace: DevicePlace = {
          kind: 'device',
          lat: roundedLat,
          lon: roundedLon,
          accuracyM,
          at: pos.timestamp || Date.now(),
          label: 'Near you',
          rawCoords: { lat: rawLat, lon: rawLon },
        };

        setPlaceState(newPlace);
        setStatus('granted');

        try {
          localStorage.setItem(STORAGE_KEY_PERMISSION, 'granted');
        } catch {
          // Ignore localStorage errors
        }
      },
      (err) => {
        if (err.code === 1) {
          setStatus('denied');
          try {
            localStorage.setItem(STORAGE_KEY_PERMISSION, 'denied');
          } catch {
            // Ignore localStorage errors
          }
        } else {
          setStatus('unavailable');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, []);

  const setPlace = useCallback((newPlace: Place) => {
    setPlaceState(newPlace);
  }, []);

  const dismissPrompt = useCallback(() => {
    setPromptDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY_DISMISSED, 'true');
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Handle visibilitychange: refresh only if moved > 1 km or reading > 30 mins
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return;
      if (statusRef.current !== 'granted' || placeRef.current.kind !== 'device') return;
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const current = placeRef.current;
          if (current.kind !== 'device') return;

          const rawLat = pos.coords.latitude;
          const rawLon = pos.coords.longitude;
          const roundedLat = roundCoord(rawLat);
          const roundedLon = roundCoord(rawLon);
          const accuracyM = Math.round(pos.coords.accuracy);

          const distanceKm = haversineDistanceKm(current.lat, current.lon, roundedLat, roundedLon);
          const ageMs = Date.now() - current.at;

          // Reload air only if moved > 1 km or reading older than 30 minutes
          if (distanceKm >= 1.0 || ageMs >= 30 * 60 * 1000) {
            setPlaceState({
              kind: 'device',
              lat: roundedLat,
              lon: roundedLon,
              accuracyM,
              at: pos.timestamp || Date.now(),
              label: 'Near you',
              rawCoords: { lat: rawLat, lon: rawLon },
            });
          }
        },
        () => {
          // Silently ignore background refresh errors
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const isRough = place.kind === 'device' && place.accuracyM > 1000;

  return {
    place,
    status,
    ask,
    setPlace,
    dismissPrompt,
    promptDismissed,
    isRough,
  };
}
