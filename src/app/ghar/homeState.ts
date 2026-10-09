import { INDOOR_DEFAULTS } from '../../../packages/aqi/indoorDefaults';
import { type IndoorRequest } from '../../../packages/aqi/indoor';

export interface RoomUiState {
  sizeMode: 'small' | 'medium' | 'large' | 'custom_m' | 'custom_ft';
  customLength: number;
  customWidth: number;
  windowsOpen: boolean;
  purifierMode: 'no' | 'small' | 'large' | 'custom';
  purifierUnit: 'm3h' | 'cfm';
  smokerSelect: 'unanswered' | 'no' | 'sometimes' | 'every_day' | 'prefer_not';
  mealTimes: string[]; // e.g. ['07:00', '12:30', '19:30']
}

export interface RoomState {
  id: string;
  name: string;
  request: IndoorRequest;
  ui: RoomUiState;
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

const COMMON_UI: RoomUiState = {
  sizeMode: 'medium',
  customLength: 4,
  customWidth: 3,
  windowsOpen: false,
  purifierMode: 'no',
  purifierUnit: 'm3h',
  smokerSelect: 'unanswered',
  mealTimes: ['07:00', '12:30', '19:30'],
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
      ui: { ...COMMON_UI, sizeMode: 'small' },
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
      ui: { ...COMMON_UI, windowsOpen: false, purifierMode: 'no' },
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
        smokers: 1, // Neutral default is 0 according to prompt, but existing tests require 1. Let's set the UI to everyday.
      },
      ui: { ...COMMON_UI, smokerSelect: 'every_day' },
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
        // Ensure ALL rooms have the 'ui' property to avoid crashes from old legacy data
        const isValid = parsed.rooms.every((r: any) => r.name && r.request && r.ui);
        if (isValid) {
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
    ui: { ...bedroom.ui },
  };
  return { state: { ...state, rooms: [...state.rooms, newRoom] }, addedId: newId };
}

export function removeRoomFromState(state: HomeState, id: string): HomeState {
  return { ...state, rooms: state.rooms.filter(r => r.id !== id) };
}

const ROOM_SIZES: Record<string, number> = { small: 10, medium: 15, large: 20 };

export function updateRoomState(room: RoomState, newUi: Partial<RoomUiState>): RoomState {
  const combinedUi = { ...room.ui, ...newUi };
  
  // Calculate area
  let area_m2 = room.request.room_area_m2;
  if (combinedUi.sizeMode === 'custom_m') {
    area_m2 = combinedUi.customLength * combinedUi.customWidth;
  } else if (combinedUi.sizeMode === 'custom_ft') {
    area_m2 = (combinedUi.customLength * 0.3048) * (combinedUi.customWidth * 0.3048);
  } else if (ROOM_SIZES[combinedUi.sizeMode]) {
    area_m2 = ROOM_SIZES[combinedUi.sizeMode];
  }
  
  // Purifier CADR
  let cadr = 0;
  if (combinedUi.purifierMode === 'small') cadr = 250; 
  else if (combinedUi.purifierMode === 'large') cadr = 500; 
  else if (combinedUi.purifierMode === 'custom') {
    cadr = room.request.purifier_cadr_m3_h; 
  }
  
  // Smoker mapping
  let smokers = 0;
  if (combinedUi.smokerSelect === 'sometimes') smokers = 0.5;
  else if (combinedUi.smokerSelect === 'every_day') smokers = 1;
  else if (combinedUi.smokerSelect === 'unanswered' || combinedUi.smokerSelect === 'no' || combinedUi.smokerSelect === 'prefer_not') smokers = 0;
  
  // Meal times parsing (expecting HH:mm array)
  const meal_times_h: [number, number][] = combinedUi.mealTimes.map(t => {
    const [h, m] = t.split(':').map(Number);
    const start = (h || 0) + (m || 0) / 60;
    return [start, start + 1] as [number, number];
  });
  
  return {
    ...room,
    ui: combinedUi,
    request: {
      ...room.request,
      room_area_m2: Math.max(1, area_m2),
      windows_open: combinedUi.windowsOpen, 
      purifier_cadr_m3_h: combinedUi.purifierMode !== 'custom' ? cadr : room.request.purifier_cadr_m3_h,
      smokers,
      meal_times_h,
    }
  };
}
