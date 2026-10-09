import { INDOOR_DEFAULTS } from '../../../packages/aqi/indoorDefaults';
import { type IndoorRequest } from '../../../packages/aqi/indoor';

export interface RoomState {
  id: string;
  name: string;
  request: IndoorRequest;
}

export interface HomeState {
  rooms: RoomState[];
}

const COMMON_REQ = {
  lat: 28.5355,
  lon: 77.391, // Noida
  windows_open: false,
  purifier_cadr_m3_h: 0,
  hepa_class: 'h13' as const,
  cooking_fuel: 'none' as const,
  smokers: 0,
  incense: false,
  mosquito_coils: false,
};

export const DEFAULT_HOME: HomeState = {
  rooms: [
    {
      id: 'kitchen',
      name: 'Kitchen',
      request: {
        ...COMMON_REQ,
        room_area_m2: INDOOR_DEFAULTS.rooms.kitchen.area_m2,
        windows: INDOOR_DEFAULTS.rooms.kitchen.windows,
        ceiling_height_m: INDOOR_DEFAULTS.rooms.kitchen.ceiling_height_m,
        cooking_fuel: 'lpg',
      },
    },
    {
      id: 'master_bedroom',
      name: 'Master Bedroom',
      request: {
        ...COMMON_REQ,
        room_area_m2: INDOOR_DEFAULTS.rooms.master_bedroom.area_m2,
        windows: INDOOR_DEFAULTS.rooms.master_bedroom.windows,
        ceiling_height_m: INDOOR_DEFAULTS.rooms.master_bedroom.ceiling_height_m,
        mosquito_coils: true,
      },
    },
    {
      id: 'living_room',
      name: 'Living Room',
      request: {
        ...COMMON_REQ,
        room_area_m2: INDOOR_DEFAULTS.rooms.living_room.area_m2,
        windows: INDOOR_DEFAULTS.rooms.living_room.windows,
        ceiling_height_m: INDOOR_DEFAULTS.rooms.living_room.ceiling_height_m,
        incense: true,
        smokers: 1,
      },
    },
  ],
};

const STORAGE_KEY = 'saans_home_state';

export function loadHomeState(): HomeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.rooms) && parsed.rooms.length > 0) {
        if (parsed.rooms[0].name && parsed.rooms[0].request) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore and return default
  }
  return DEFAULT_HOME;
}

export function saveHomeState(state: HomeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function addRoomToState(state: HomeState): { state: HomeState; addedId: string | null } {
  const bedroom = state.rooms.find(r => r.id === 'master_bedroom') || state.rooms[0];
  if (!bedroom) return { state, addedId: null };
  const newId = 'room_' + Date.now() + Math.floor(Math.random() * 1000);
  const newRoom: RoomState = {
    id: newId,
    name: 'New Room',
    request: { ...bedroom.request },
  };
  return { state: { ...state, rooms: [...state.rooms, newRoom] }, addedId: newId };
}

export function removeRoomFromState(state: HomeState, id: string): HomeState {
  return { ...state, rooms: state.rooms.filter(r => r.id !== id) };
}
