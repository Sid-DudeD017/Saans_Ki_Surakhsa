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

/** Told when the home moves, so every part of the page (the app header too) follows it. */
const CHANGED = 'saans-home-location';

export function useHomeLocation() {
  const [location, setLocationState] = useState<LocationState>(EXAMPLE_LOCATION);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const load = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setLocationState(JSON.parse(stored));
      } catch {}
    };
    load();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReady(true);
    window.addEventListener(CHANGED, load);
    return () => window.removeEventListener(CHANGED, load);
  }, []);

  const saveLocation = (loc: LocationState) => {
    const rounded = { ...loc, lat: round2(loc.lat), lon: round2(loc.lon) };
    setLocationState(rounded);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rounded));
    } catch {}
    window.dispatchEvent(new Event(CHANGED));
  };

  return { location, saveLocation, isReady };
}
