import { haversineDistanceKm } from './useLocation';

export interface KnownStation {
  id: string;
  name: string;
  city: string;
  state: 'Delhi' | 'Punjab';
  lat: number;
  lon: number;
}

/**
 * Key monitoring stations in Punjab and Delhi NCR.
 * Used for deterministic station distance resolution and fallback attribution.
 */
export const KNOWN_STATIONS: KnownStation[] = [
  // Delhi NCR
  { id: 'dl-punjabi-bagh', name: 'Punjabi Bagh', city: 'Delhi', state: 'Delhi', lat: 28.674, lon: 77.121 },
  { id: 'dl-anand-vihar', name: 'Anand Vihar', city: 'Delhi', state: 'Delhi', lat: 28.647, lon: 77.305 },
  { id: 'dl-mandir-marg', name: 'Mandir Marg', city: 'Delhi', state: 'Delhi', lat: 28.625, lon: 77.201 },
  { id: 'dl-rk-puram', name: 'R K Puram', city: 'Delhi', state: 'Delhi', lat: 28.563, lon: 77.186 },
  { id: 'dl-igi-airport', name: 'IGI Airport T3', city: 'Delhi', state: 'Delhi', lat: 28.562, lon: 77.118 },
  { id: 'dl-dwarka', name: 'Dwarka Sector 8', city: 'Delhi', state: 'Delhi', lat: 28.571, lon: 77.071 },
  { id: 'dl-bawana', name: 'Bawana', city: 'Delhi', state: 'Delhi', lat: 28.776, lon: 77.051 },
  { id: 'dl-jahangirpuri', name: 'Jahangirpuri', city: 'Delhi', state: 'Delhi', lat: 28.732, lon: 77.170 },
  { id: 'dl-shadipur', name: 'Shadipur', city: 'Delhi', state: 'Delhi', lat: 28.651, lon: 77.157 },
  { id: 'dl-lodhi-road', name: 'Lodhi Road', city: 'Delhi', state: 'Delhi', lat: 28.591, lon: 77.227 },
  { id: 'dl-wazirpur', name: 'Wazirpur', city: 'Delhi', state: 'Delhi', lat: 28.699, lon: 77.165 },
  { id: 'dl-rohini', name: 'Rohini', city: 'Delhi', state: 'Delhi', lat: 28.732, lon: 77.119 },
  // Punjab
  { id: 'pb-sangrur', name: 'Sangrur Regional CAAQMS', city: 'Sangrur', state: 'Punjab', lat: 30.245, lon: 75.842 },
  { id: 'pb-patiala', name: 'Civil Line, Patiala', city: 'Patiala', state: 'Punjab', lat: 30.340, lon: 76.390 },
  { id: 'pb-ludhiana', name: 'PAU, Ludhiana', city: 'Ludhiana', state: 'Punjab', lat: 30.901, lon: 75.807 },
  { id: 'pb-amritsar', name: 'Golden Temple, Amritsar', city: 'Amritsar', state: 'Punjab', lat: 31.620, lon: 74.876 },
  { id: 'pb-jalandhar', name: 'Civil Hospital, Jalandhar', city: 'Jalandhar', state: 'Punjab', lat: 31.326, lon: 75.576 },
  { id: 'pb-bathinda', name: 'Bathinda Regional CAAQMS', city: 'Bathinda', state: 'Punjab', lat: 30.211, lon: 74.945 },
  { id: 'pb-rupnagar', name: 'Rupnagar CAAQMS', city: 'Rupnagar', state: 'Punjab', lat: 30.970, lon: 76.530 },
  { id: 'pb-khanna', name: 'Khanna Regional CAAQMS', city: 'Khanna', state: 'Punjab', lat: 30.707, lon: 76.216 },
  { id: 'pb-mandi-gobindgarh', name: 'Mandi Gobindgarh CAAQMS', city: 'Mandi Gobindgarh', state: 'Punjab', lat: 30.666, lon: 76.303 },
];

/**
 * Finds the geographically closest monitoring station to a coordinate pair.
 */
export function findNearestStation(lat: number, lon: number): {
  station: KnownStation;
  distanceKm: number;
} {
  let nearest = KNOWN_STATIONS[0];
  let minD = Infinity;

  for (const s of KNOWN_STATIONS) {
    const d = haversineDistanceKm(lat, lon, s.lat, s.lon);
    if (d < minD) {
      minD = d;
      nearest = s;
    }
  }

  return {
    station: nearest,
    distanceKm: Math.round(minD * 10) / 10,
  };
}
