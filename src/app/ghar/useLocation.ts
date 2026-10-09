// TODO(P2 useLocation.ts): Shared location hook
import { useState } from 'react';

export function useLocation() {
  const [location, setLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);
  return { location, setLocation };
}
