'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AqiResponse, Category } from './airQuality';
import { buildAdvisory, type SchoolAdvisory, type SchoolIdentity } from './advisory';
import { getAir, getFires, getForecast, type FirePoint, type ForecastResponse } from './shalaApi';

export interface Place {
  id?: string;
  label: string;
  lat: number;
  lon: number;
  district?: string;
  kind?: 'device' | 'school' | 'search';
  accuracyM?: number;
  at?: number;
  rawCoords?: { lat: number; lon: number };
}

export type ShalaAirStatus = 'loading' | 'ok' | 'error';
export type ForecastStatus = 'loading' | 'ok' | 'no_coverage' | 'error';
export type FiresStatus = 'loading' | 'ok' | 'error';

export interface ShalaAirResult {
  status: 'ok' | 'error';
  air: AqiResponse | null;
  advisory: SchoolAdvisory | null;
  fires: FirePoint[];
  firesError?: string;
  firesStatus?: FiresStatus;
  forecast?: ForecastResponse | null;
  forecastStatus?: ForecastStatus;
  forecastError?: string;
  error?: string;
  isStale: boolean;
  staleHours: number;
  fetchedForPlace: Place | null;
}

export interface ShalaAirState extends Omit<ShalaAirResult, 'status'> {
  status: ShalaAirStatus;
  forecast: ForecastResponse | null;
  forecastStatus: ForecastStatus;
  forecastError?: string;
  firesStatus: FiresStatus;
  lastFetchedAt: Date | null;
  refetch: () => void;
  refetchForecast: () => void;
  refetchFires: () => void;
}

/**
 * Checks whether an AQI reading is stale (older than 2 hours or marked stale by the API).
 */
export function checkStaleness(
  dataTimestamp?: string,
  reportedStale?: boolean,
  nowMs = Date.now()
): { isStale: boolean; staleHours: number } {
  if (reportedStale === true) {
    return { isStale: true, staleHours: 2 };
  }
  if (!dataTimestamp) return { isStale: false, staleHours: 0 };
  const timestampMs = new Date(dataTimestamp).getTime();
  if (isNaN(timestampMs)) return { isStale: false, staleHours: 0 };

  const diffMs = Math.max(0, nowMs - timestampMs);
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const isStale = diffHours >= 2;

  return { isStale, staleHours: isStale ? diffHours : 0 };
}

/**
 * Formats ISO timestamp to human-readable time with offset indicator.
 */
export function formatMeasurementTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    if (isoString.includes('+05:30')) {
      const timeMatch = isoString.match(/T(\d{2}:\d{2})/);
      if (timeMatch) {
        return `${timeMatch[1]} IST`;
      }
    }
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const istMs = d.getTime() + 330 * 60_000;
    const istDate = new Date(istMs);
    const hh = String(istDate.getUTCHours()).padStart(2, '0');
    const mm = String(istDate.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm} IST`;
  } catch {
    return isoString;
  }
}

function isNoCoverageError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    if (anyErr.code === 'no_coverage' || anyErr.status === 404) return true;
    const msg = String(anyErr.message || '').toLowerCase();
    if (msg.includes('no_coverage') || msg.includes('not available for the requested coordinates') || msg.includes('coverage area')) {
      return true;
    }
  }
  return false;
}

/**
 * Pure asynchronous fetch function for a single AQI reading and associated school advisory,
 * forecast and fires. Guarantees one place and one unified reading source.
 */
export async function fetchShalaAirReading(
  place: Place,
  options?: {
    fixtureDay?: Category;
    fireRadiusKm?: number;
    nowMs?: number;
    mockMode?: boolean;
  }
): Promise<ShalaAirResult> {
  const fixtureDay = options?.fixtureDay ?? 'poor';
  const fireRadiusKm = options?.fireRadiusKm ?? 25;
  const nowMs = options?.nowMs ?? Date.now();

  try {
    // Exactly one call to GET /v1/aqi (or mock fixture in mock mode)
    // Plus fire tracking points and forecast
    const [airResult, firesResult, forecastResult] = await Promise.allSettled([
      getAir(place.lat, place.lon, fixtureDay),
      getFires(place.lat, place.lon, fireRadiusKm),
      getForecast(place.lat, place.lon, 24, fixtureDay),
    ]);

    if (airResult.status === 'rejected') {
      const errorMsg =
        airResult.reason instanceof Error
          ? airResult.reason.message
          : String(airResult.reason);
      return {
        status: 'error',
        air: null,
        advisory: null,
        fires: [],
        forecast: null,
        forecastStatus: 'error',
        error: errorMsg || 'Unable to load air quality data',
        isStale: false,
        staleHours: 0,
        fetchedForPlace: place,
      };
    }

    const air = airResult.value;
    const fires = firesResult.status === 'fulfilled' ? firesResult.value : [];
    const firesStatus: FiresStatus = firesResult.status === 'fulfilled' ? 'ok' : 'error';
    const firesError =
      firesResult.status === 'rejected'
        ? firesResult.reason instanceof Error
          ? firesResult.reason.message
          : String(firesResult.reason)
        : undefined;

    let forecast: ForecastResponse | null = null;
    let forecastStatus: ForecastStatus = 'loading';
    let forecastError: string | undefined;

    if (forecastResult.status === 'fulfilled') {
      forecast = forecastResult.value;
      forecastStatus = 'ok';
    } else {
      if (isNoCoverageError(forecastResult.reason)) {
        forecastStatus = 'no_coverage';
      } else {
        forecastStatus = 'error';
        forecastError =
          forecastResult.reason instanceof Error
            ? forecastResult.reason.message
            : String(forecastResult.reason);
      }
    }

    const school: SchoolIdentity = {
      id: place.id || 'school_demo_001',
      name: place.label,
      district: place.district || 'Sangrur',
      location: { lat: place.lat, lon: place.lon },
    };

    // School advisory is built directly and deterministically from this exact reading
    const advisory = buildAdvisory(
      school,
      air,
      new Date(air.data_timestamp || nowMs)
    );

    const { isStale, staleHours } = checkStaleness(
      air.data_timestamp,
      air.stale,
      nowMs
    );

    return {
      status: 'ok',
      air,
      advisory,
      fires,
      firesStatus,
      firesError,
      forecast,
      forecastStatus,
      forecastError,
      isStale,
      staleHours,
      fetchedForPlace: place,
    };
  } catch (err) {
    return {
      status: 'error',
      air: null,
      advisory: null,
      fires: [],
      forecast: null,
      forecastStatus: 'error',
      error: err instanceof Error ? err.message : String(err),
      isStale: false,
      staleHours: 0,
      fetchedForPlace: place,
    };
  }
}

/**
 * React hook managing the single reliable live AQI data flow for Saans Shala.
 * Load order: "Right now" loads first; forecast and fires load in parallel without
 * blocking or delaying the current reading.
 */
export function useShalaAir(
  place: Place,
  fixtureDay: Category = 'poor',
  fireRadiusKm = 25
): ShalaAirState {
  const [state, setState] = useState<Omit<ShalaAirState, 'refetch' | 'refetchForecast' | 'refetchFires'>>({
    status: 'loading',
    air: null,
    advisory: null,
    fires: [],
    firesStatus: 'loading',
    firesError: undefined,
    forecast: null,
    forecastStatus: 'loading',
    forecastError: undefined,
    error: undefined,
    isStale: false,
    staleHours: 0,
    fetchedForPlace: null,
    lastFetchedAt: null,
  });

  const fetchId = useRef(0);

  const fetchForecastForPlace = useCallback(
    async (id: number, currentPlace: Place) => {
      try {
        const res = await getForecast(currentPlace.lat, currentPlace.lon, 24, fixtureDay);
        if (id !== fetchId.current) return;
        setState((prev) => ({
          ...prev,
          forecast: res,
          forecastStatus: 'ok',
          forecastError: undefined,
        }));
      } catch (err) {
        if (id !== fetchId.current) return;
        if (isNoCoverageError(err)) {
          setState((prev) => ({
            ...prev,
            forecast: null,
            forecastStatus: 'no_coverage',
            forecastError: undefined,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            forecast: null,
            forecastStatus: 'error',
            forecastError: err instanceof Error ? err.message : String(err),
          }));
        }
      }
    },
    [fixtureDay]
  );

  const fetchFiresForPlace = useCallback(
    async (id: number, currentPlace: Place) => {
      try {
        const res = await getFires(currentPlace.lat, currentPlace.lon, fireRadiusKm);
        if (id !== fetchId.current) return;
        setState((prev) => ({
          ...prev,
          fires: res,
          firesStatus: 'ok',
          firesError: undefined,
        }));
      } catch (err) {
        if (id !== fetchId.current) return;
        setState((prev) => ({
          ...prev,
          fires: [],
          firesStatus: 'error',
          firesError: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [fireRadiusKm]
  );

  const loadData = useCallback(
    async (isManualRefetch = false) => {
      const id = ++fetchId.current;
      if (isManualRefetch) {
        setState((prev) => ({
          ...prev,
          status: prev.air ? prev.status : 'loading',
          forecastStatus: prev.forecast ? prev.forecastStatus : 'loading',
          firesStatus: prev.fires.length > 0 ? prev.firesStatus : 'loading',
          error: undefined,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: 'loading',
          forecastStatus: 'loading',
          firesStatus: 'loading',
          error: undefined,
        }));
      }

      // Step 1: Start fetching air for "Right now".
      getAir(place.lat, place.lon, fixtureDay)
        .then((air) => {
          if (id !== fetchId.current) return;
          const school: SchoolIdentity = {
            id: place.id || 'school_demo_001',
            name: place.label,
            district: place.district || 'Sangrur',
            location: { lat: place.lat, lon: place.lon },
          };
          const advisory = buildAdvisory(school, air, new Date(air.data_timestamp || Date.now()));
          const { isStale, staleHours } = checkStaleness(air.data_timestamp, air.stale);

          setState((prev) => ({
            ...prev,
            status: 'ok',
            air,
            advisory,
            isStale,
            staleHours,
            fetchedForPlace: place,
            lastFetchedAt: new Date(),
          }));
        })
        .catch((err) => {
          if (id !== fetchId.current) return;
          setState((prev) => ({
            ...prev,
            status: 'error',
            air: null,
            advisory: null,
            error: err instanceof Error ? err.message : String(err),
            fetchedForPlace: place,
          }));
        });

      // Step 2: In parallel, fetch forecast and fires without blocking air reading
      fetchForecastForPlace(id, place);
      fetchFiresForPlace(id, place);
    },
    [place, fixtureDay, fetchForecastForPlace, fetchFiresForPlace]
  );

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        loadData(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadData]);

  const refetch = useCallback(() => {
    loadData(true);
  }, [loadData]);

  const refetchForecast = useCallback(() => {
    const id = ++fetchId.current;
    setState((prev) => ({ ...prev, forecastStatus: 'loading', forecastError: undefined }));
    fetchForecastForPlace(id, place);
  }, [fetchForecastForPlace, place]);

  const refetchFires = useCallback(() => {
    const id = ++fetchId.current;
    setState((prev) => ({ ...prev, firesStatus: 'loading', firesError: undefined }));
    fetchFiresForPlace(id, place);
  }, [fetchFiresForPlace, place]);

  // Synchronously guard against showing an old place's reading under a newly selected place
  const isPlaceMismatch =
    state.fetchedForPlace !== null &&
    (state.fetchedForPlace.lat !== place.lat ||
      state.fetchedForPlace.lon !== place.lon ||
      state.fetchedForPlace.kind !== place.kind);

  const effectiveStatus = isPlaceMismatch ? 'loading' : state.status;
  const effectiveAir = isPlaceMismatch ? null : state.air;
  const effectiveAdvisory = isPlaceMismatch ? null : state.advisory;
  const effectiveForecastStatus = isPlaceMismatch ? 'loading' : state.forecastStatus;
  const effectiveForecast = isPlaceMismatch ? null : state.forecast;
  const effectiveFiresStatus = isPlaceMismatch ? 'loading' : state.firesStatus;
  const effectiveFires = isPlaceMismatch ? [] : state.fires;

  return {
    ...state,
    status: effectiveStatus,
    air: effectiveAir,
    advisory: effectiveAdvisory,
    forecast: effectiveForecast,
    forecastStatus: effectiveForecastStatus,
    fires: effectiveFires,
    firesStatus: effectiveFiresStatus,
    refetch,
    refetchForecast,
    refetchFires,
  };
}
