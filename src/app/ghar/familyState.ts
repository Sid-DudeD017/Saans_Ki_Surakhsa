export interface TimeBlock {
  id: string;
  start: string; // HH:mm
  end: string; // HH:mm
  locationId: string; // room id, or 'out'
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  blocks: TimeBlock[];
}

export interface SavedResult {
  id: string;
  timestamp: string;
  memberName: string;
  role: string;
  baselineAvg: number;
  improvedAvg: number | null;
  blocks?: TimeBlock[];
}

export interface FamilyState {
  members: FamilyMember[];
  savedResults: SavedResult[];
}

export const DEFAULT_FAMILY: FamilyState = { members: [], savedResults: [] };

const STORAGE_KEY = 'saans_family_state';

export function loadFamilyState(): FamilyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.members)) {
        if (!Array.isArray(parsed.savedResults)) {
          parsed.savedResults = [];
        }
        return parsed as FamilyState;
      }
    }
  } catch {
    // Ignore
  }
  return DEFAULT_FAMILY;
}

export function saveFamilyState(state: FamilyState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore
  }
}
