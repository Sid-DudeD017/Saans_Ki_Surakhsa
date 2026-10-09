// TODO(P2 useLocation.ts): Shared location hook
import { useState, useEffect } from 'react';

export interface LocationState {
  lat: number;
  lon: number;
  name: string;
  isExample?: boolean;
}

export const EXAMPLE_LOCATION: LocationState = { lat: 28.54, lon: 77.39, name: 'Noida (Example)', isExample: true };
const STORAGE_KEY = 'saans_home_location';

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function useLocation() {
  const [location, setLocationState] = useState<LocationState>(EXAMPLE_LOCATION);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLocationState(JSON.parse(stored));
      }
    } catch {}
    setIsReady(true);
  }, []);

  const saveLocation = (loc: LocationState) => {
    const rounded = { ...loc, lat: round2(loc.lat), lon: round2(loc.lon) };
    setLocationState(rounded);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rounded));
    } catch {}
  };

  return { location, saveLocation, isReady };
}
