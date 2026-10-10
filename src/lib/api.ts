import {
  DETERMINISTIC_EVENT,
  INITIAL_MOCK_NOTIFICATIONS,
  MockNotification,
} from './mockData';

/**
 * Saans Platform Unified API Client (P2-owned)
 *
 * Configuration:
 * - NEXT_PUBLIC_COMMAND_API_BASE_URL: Saans Command API on AWS (API Gateway) for uploads, complaints and cases
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

export interface ComplaintEvidence {
  object_key: string;
  media_type: string;
  hash: string;
  captured_timestamp: string;
  location?: { lat: number; lon: number };
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
  evidence?: ComplaintEvidence[];
}

export interface ComplaintStatusData {
  id: string;
  status: 'received' | 'sent_to_officer' | 'case_opened' | 'merged' | 'acted_on' | 'closed';
  stage_label: string;
  explanation: string;
  type?: string;
  received_at: string;
  updated_at?: string;
  description?: string;
  evidence?: ComplaintEvidence[];
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

// Two places serve /v1/*: this Next.js site (Shala, Ghar, fires, the Kisan agent forwarder) and Saans
// Command's API on AWS (uploads, complaints, cases), at NEXT_PUBLIC_COMMAND_API_BASE_URL.
function getSiteBaseUrl(): string {
  return '';
}

function getCommandBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_COMMAND_API_BASE_URL || ''
  ).replace(/\/+$/, '');
}

/**
 * GET /v1/aqi?lat={lat}&lon={lon}
 */
export async function getAqi(lat: number, lon: number): Promise<AqiData> {
  if (typeof window !== 'undefined') {
    try {
      const base = getBaseUrl();
      const res = await fetch(`${base}/v1/aqi?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const d = await res.json();
        if (d && typeof d.aqi === 'number') {
          const rawCat = (d.category || 'moderate').toLowerCase();
          const categoryMap: Record<string, AqiData['category']> = {
            good: 'Good',
            satisfactory: 'Satisfactory',
            moderate: 'Moderate',
            poor: 'Poor',
            very_poor: 'Very Poor',
            severe: 'Severe',
          };
          const category = categoryMap[rawCat] || 'Moderate';
          return {
            aqi: d.aqi,
            category,
            dominant_pollutant: (d.dominant_pollutant || 'PM2.5').toUpperCase(),
            pm25: d.sub_indices?.pm25?.concentration ?? d.aqi,
            pm10: d.sub_indices?.pm10?.concentration ?? Math.round(d.aqi * 0.8),
            timestamp: d.data_timestamp,
            station_name: d.station_name || 'Ground Monitoring Station',
            distance_km: d.distance_km ?? 0,
          };
        }
      }
    } catch {
      // Fallback to mock or direct call
    }
  }

  if (isMockMode()) {
    return { ...DETERMINISTIC_EVENT.aqiReading };
  }

  const base = getCommandBaseUrl();
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

  const base = getSiteBaseUrl();
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

  const base = getSiteBaseUrl();
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
    const base = getSiteBaseUrl();
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
 * - 'dust': Construction dust, road dust, fugitive dust ('Dust', 'dust')
 * - 'industrial': Factory emissions, brick kiln smoke ('Industrial', 'industrial')
 */
export type SupportedCitizenType =
  | 'farm_fire'
  | 'garbage'
  | 'vehicle'
  | 'firecrackers'
  | 'dust'
  | 'industrial';

export const SUPPORTED_COMPLAINT_CATEGORIES = {
  'Smoke': 'farm_fire',
  'Stubble burning': 'farm_fire',
  'Crop or field fire': 'farm_fire',
  'farm_fire': 'farm_fire',
  'Burning waste': 'garbage',
  'Rubbish burning': 'garbage',
  'garbage': 'garbage',
  'Vehicle idling': 'vehicle',
  'Smoky vehicle': 'vehicle',
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
  if (lower === 'smoke' || lower === 'stubble burning' || lower === 'farm fire' || lower === 'farm_fire' || lower.includes('crop') || lower.includes('field fire')) {
    return 'farm_fire';
  }
  if (lower === 'burning waste' || lower === 'waste burning' || lower === 'garbage' || lower.includes('rubbish')) {
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
  const citizenType =
    payload.category === 'dust' || payload.category === 'industrial'
      ? (payload.category as SupportedCitizenType)
      : mapCategoryToCitizenType(payload.category);

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

  const base = getCommandBaseUrl();
  const lat = Number(payload.lat ?? payload.latitude ?? 30.245);
  const lon = Number(payload.lon ?? payload.longitude ?? 75.842);
  const idempotencyKey = generateIdempotencyKey(payload);

  const body = {
    type: citizenType,
    location: { lat, lon },
    description: payload.description ? payload.description.trim() : undefined,
    evidence: payload.evidence ?? [],
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
 * Resizes an image to ~1600 px longest side as JPEG and strips EXIF metadata.
 * Computes SHA-256 digest via crypto.subtle.
 */
export async function prepareReportPhoto(file: File): Promise<{ blob: Blob; hash: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = async () => {
        try {
          const maxDim = 1600;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas context unavailable');
          }
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            async (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image to JPEG'));
                return;
              }
              try {
                const buffer = await blob.arrayBuffer();
                const digest = await crypto.subtle.digest('SHA-256', buffer);
                const hash = Array.from(new Uint8Array(digest))
                  .map((b) => b.toString(16).padStart(2, '0'))
                  .join('');
                resolve({ blob, hash });
              } catch (e) {
                reject(e);
              }
            },
            'image/jpeg',
            0.85
          );
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a photo following the order in scripts/smoke-intake.sh:
 * 1. POST /v1/uploads with { media_type: "image/jpeg", byte_size, sha256 }
 * 2. PUT to upload_url with returned headers
 * Returns { object_key, media_type, hash }
 */
export async function uploadEvidencePhoto(
  blob: Blob,
  sha256: string
): Promise<{ object_key: string; media_type: string; hash: string }> {
  if (isMockMode()) {
    return {
      object_key: `mock-upload-${Date.now()}-${sha256.slice(0, 8)}.jpg`,
      media_type: 'image/jpeg',
      hash: sha256,
    };
  }

  const base = getCommandBaseUrl();
  const initRes = await fetch(`${base}/v1/uploads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'image/jpeg',
      byte_size: blob.size,
      sha256,
    }),
  });

  if (!initRes.ok) {
    const errBody = await initRes.json().catch(() => null);
    throw new Error(errBody?.error?.message || `Failed to initiate upload: ${initRes.statusText}`);
  }

  const initData = await initRes.json();
  const uploadUrl: string = initData.upload_url;
  const objectKey: string = initData.object_key;
  const rawHeaders: Record<string, string> = initData.headers || {};

  const putHeaders = new Headers();
  Object.entries(rawHeaders).forEach(([k, v]) => putHeaders.set(k, v));

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: putHeaders,
    body: blob,
  });

  if (!putRes.ok) {
    throw new Error(`Failed to upload photo to storage: ${putRes.statusText}`);
  }

  return {
    object_key: objectKey,
    media_type: 'image/jpeg',
    hash: sha256,
  };
}

/**
 * GET /v1/complaints/{id}
 * Read-only status tracking.
 */
export async function getComplaintStatus(id: string): Promise<ComplaintStatusData> {
  if (isMockMode()) {
    return {
      id,
      status: 'received',
      stage_label: 'Report received',
      explanation: 'Your report has been received and is queued for verification.',
      received_at: new Date().toISOString(),
    };
  }

  const base = getCommandBaseUrl();
  const res = await fetch(`${base}/v1/complaints/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error?.message || `Failed to fetch complaint status: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(id: string): Promise<void> {
  notificationsStore = notificationsStore.map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
}
