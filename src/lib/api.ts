import {
  DETERMINISTIC_EVENT,
  INITIAL_MOCK_NOTIFICATIONS,
  MockNotification,
} from './mockData';

/**
 * Saans Platform Unified API Client (P2-owned)
 *
 * Configuration:
 * - NEXT_PUBLIC_API_BASE_URL: Backend service root URL (e.g. AWS API Gateway)
 * - NEXT_PUBLIC_USE_MOCKS: 'true' to use local deterministic mocks, 'false' for live HTTP
 */

export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';
}

export const USE_MOCKS = isMockMode();

export interface AqiData {
  aqi: number;
  category: 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe';
  dominant_pollutant: string;
  pm25: number;
  pm10: number;
  timestamp: string;
  station_name: string;
  distance_km: number;
}

export interface FireData {
  id: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  bearing_deg: number;
  is_upwind: boolean;
  confidence: string;
  detected_at: string;
}

export interface SchoolAdvisoryData {
  school_id: string;
  school_name: string;
  aqi: number;
  grap_stage: string;
  outdoor_activities_permitted: boolean;
  mask_recommended: boolean;
  summary: string;
}

export interface ComplaintPayload {
  category: string;
  description: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
  photo?: string;
  school_id?: string;
  reported_by_role?: string;
  idempotency_key?: string;
  idempotencyKey?: string;
}

export interface ComplaintResponse {
  ticket_id: string;
  id?: string;
  status: 'received' | 'investigating' | 'resolved';
  created_at: string;
  message: string;
}

// In-memory mock notification store
let notificationsStore: MockNotification[] = [...INITIAL_MOCK_NOTIFICATIONS];

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
}

/**
 * GET /v1/aqi?lat={lat}&lon={lon}
 */
export async function getAqi(lat: number, lon: number): Promise<AqiData> {
  if (isMockMode()) {
    return { ...DETERMINISTIC_EVENT.aqiReading };
  }

  const base = getBaseUrl();
  const res = await fetch(`${base}/v1/aqi?lat=${lat}&lon=${lon}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch AQI: ${res.statusText}`);
  }
  return res.json();
}

/**
 * GET /v1/fires?lat={lat}&lon={lon}&radius_km={radiusKm}
 */
export async function getFires(
  lat: number,
  lon: number,
  radiusKm = 10
): Promise<{ fires: FireData[] }> {
  if (isMockMode()) {
    return {
      fires: [{ ...DETERMINISTIC_EVENT.upwindFire }],
    };
  }

  const base = getBaseUrl();
  const res = await fetch(
    `${base}/v1/fires?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch fires: ${res.statusText}`);
  }
  return res.json();
}

/**
 * GET /v1/schools/{id}/advisory
 */
export async function getSchoolAdvisory(
  schoolId: string,
  role?: string
): Promise<SchoolAdvisoryData> {
  if (isMockMode()) {
    return {
      school_id: schoolId || DETERMINISTIC_EVENT.school.id,
      school_name: DETERMINISTIC_EVENT.school.name,
      aqi: DETERMINISTIC_EVENT.aqiReading.aqi,
      grap_stage: DETERMINISTIC_EVENT.advisory.grap_stage,
      outdoor_activities_permitted:
        DETERMINISTIC_EVENT.advisory.outdoor_activities_permitted,
      mask_recommended: DETERMINISTIC_EVENT.advisory.mask_recommended,
      summary: DETERMINISTIC_EVENT.advisory.summary,
    };
  }

  const base = getBaseUrl();
  const url = `${base}/v1/schools/${encodeURIComponent(schoolId)}/advisory${role ? `?role=${encodeURIComponent(role)}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch school advisory: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    school_id: data.school_id || schoolId,
    school_name: data.school_name || data.school?.name || DETERMINISTIC_EVENT.school.name,
    aqi: data.aqi ?? DETERMINISTIC_EVENT.aqiReading.aqi,
    grap_stage: data.grap_stage || 'Stage II',
    outdoor_activities_permitted: data.outdoor_activities_permitted ?? (data.guidance?.sports === 'outdoors'),
    mask_recommended: data.mask_recommended ?? (data.guidance?.masks === 'recommended' || data.guidance?.masks === 'required_outdoors'),
    summary: data.summary || data.headline || DETERMINISTIC_EVENT.advisory.summary,
  };
}

/**
 * GET /v1/notifications
 */
export async function getNotifications(): Promise<MockNotification[]> {
  if (isMockMode()) {
    return [...notificationsStore];
  }

  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/v1/notifications`);
    if (!res.ok) {
      return [...notificationsStore];
    }
    return res.json();
  } catch {
    return [...notificationsStore];
  }
}

/**
 * Maps frontend UI incident categories to backend OpenAPI ComplaintInput citizen types.
 *
 * Supported Contract Types (CITIZEN_TYPES in services/command-api/inputs.ts):
 * - 'farm_fire': Agricultural stubble burning, open field fires, smoke plumes ('Smoke', 'Stubble burning', 'farm_fire')
 * - 'garbage': Open waste / trash burning ('Burning waste', 'garbage')
 * - 'vehicle': Excessive vehicle exhaust / idling ('Vehicle idling', 'vehicle')
 * - 'firecrackers': Fireworks / firecrackers emissions ('Firecrackers', 'firecrackers')
 *
 * Unsupported Categories (Explicitly rejected by the live intake contract):
 * - 'Dust': Fugitive dust / construction dust (no intake route exists in CITIZEN_TYPES)
 * - 'Industrial': Industrial stacks / factory pollution (no citizen route exists in CITIZEN_TYPES)
 * - 'Other': Uncategorized reports
 */
export type SupportedCitizenType = 'farm_fire' | 'garbage' | 'vehicle' | 'firecrackers';

export const SUPPORTED_COMPLAINT_CATEGORIES = {
  'Smoke': 'farm_fire',
  'Stubble burning': 'farm_fire',
  'farm_fire': 'farm_fire',
  'Burning waste': 'garbage',
  'garbage': 'garbage',
  'Vehicle idling': 'vehicle',
  'vehicle': 'vehicle',
  'Firecrackers': 'firecrackers',
  'firecrackers': 'firecrackers',
} as const;

export function mapCategoryToCitizenType(category?: string): SupportedCitizenType | null {
  if (!category) return null;
  const trimmed = category.trim();
  if (trimmed in SUPPORTED_COMPLAINT_CATEGORIES) {
    return SUPPORTED_COMPLAINT_CATEGORIES[trimmed as keyof typeof SUPPORTED_COMPLAINT_CATEGORIES];
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'smoke' || lower === 'stubble burning' || lower === 'farm fire' || lower === 'farm_fire') {
    return 'farm_fire';
  }
  if (lower === 'burning waste' || lower === 'waste burning' || lower === 'garbage') {
    return 'garbage';
  }
  if (lower === 'vehicle idling' || lower === 'vehicle' || lower === 'traffic idling') {
    return 'vehicle';
  }
  if (lower === 'firecrackers' || lower === 'firecracker' || lower === 'fireworks') {
    return 'firecrackers';
  }
  // Explicitly return null for unsupported categories (Dust, Industrial, Other, etc.)
  return null;
}

/**
 * Generates or preserves a stable Idempotency-Key (6-128 chars) for complaint submissions.
 * Unchanged retries produce identical keys to avoid duplicate complaint creation.
 */
export function generateIdempotencyKey(payload: ComplaintPayload): string {
  if (payload.idempotency_key && payload.idempotency_key.length >= 6 && payload.idempotency_key.length <= 128) {
    return payload.idempotency_key;
  }
  if (payload.idempotencyKey && payload.idempotencyKey.length >= 6 && payload.idempotencyKey.length <= 128) {
    return payload.idempotencyKey;
  }

  const cat = (payload.category || '').trim();
  const desc = (payload.description || '').trim();
  const lat = (payload.lat ?? payload.latitude ?? 0).toFixed(4);
  const lon = (payload.lon ?? payload.longitude ?? 0).toFixed(4);
  const school = (payload.school_id || '').trim();

  const content = `${cat}:${desc}:${lat}:${lon}:${school}`;
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ code;
    hash2 = ((hash2 << 5) + hash2) ^ code;
  }
  const h1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const h2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return `idem-${h1}${h2}`;
}

/**
 * POST /v1/complaints
 */
export async function submitComplaint(
  payload: ComplaintPayload
): Promise<ComplaintResponse> {
  const citizenType = mapCategoryToCitizenType(payload.category);

  if (isMockMode()) {
    const ticketId = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
    const newNotif: MockNotification = {
      id: `notif_${Date.now()}`,
      title: 'New Complaint Logged',
      message: `Report filed for ${payload.category}: "${(payload.description || '').slice(0, 40)}..."`,
      severity: 'info',
      timestamp: 'Just now',
      read: false,
      sourceModule: 'shala',
    };
    notificationsStore = [newNotif, ...notificationsStore];

    return {
      id: ticketId,
      ticket_id: ticketId,
      status: 'received',
      created_at: new Date().toISOString(),
      message: 'Report submitted successfully. Dispatched to response desk.',
    };
  }

  // Real backend requires an intentional, valid contract mapping
  if (!citizenType) {
    throw new Error(
      `Unsupported complaint category: "${payload.category}". The intake contract only supports: Smoke (farm_fire), Burning waste (garbage), Vehicle idling (vehicle), and Firecrackers (firecrackers).`
    );
  }

  const base = getBaseUrl();
  const lat = Number(payload.lat ?? payload.latitude ?? 30.245);
  const lon = Number(payload.lon ?? payload.longitude ?? 75.842);
  const idempotencyKey = generateIdempotencyKey(payload);

  const body = {
    type: citizenType,
    location: { lat, lon },
    description: payload.description ? payload.description.trim() : undefined,
    evidence: [],
  };

  const res = await fetch(`${base}/v1/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    const detail =
      errBody?.error?.message ||
      errBody?.message ||
      (errBody?.error?.details?.[0] ? `${errBody.error.details[0].field}: ${errBody.error.details[0].problem}` : null) ||
      res.statusText;
    throw new Error(`Failed to submit complaint: ${detail}`);
  }

  const data = await res.json();
  const ticketId = data.ticket_id || data.id || `TKT-${Date.now()}`;
  return {
    id: data.id || ticketId,
    ticket_id: ticketId,
    status: data.status || 'received',
    created_at: data.created_at || new Date().toISOString(),
    message: data.message || 'Report submitted successfully. Dispatched to response desk.',
  };
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(id: string): Promise<void> {
  notificationsStore = notificationsStore.map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
}
