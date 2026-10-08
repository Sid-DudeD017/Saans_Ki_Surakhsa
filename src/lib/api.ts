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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false'; // Defaults to true if unset

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
  latitude: number;
  longitude: number;
  photo?: string;
  school_id?: string;
  reported_by_role?: string;
}

export interface ComplaintResponse {
  ticket_id: string;
  status: 'received' | 'investigating' | 'resolved';
  created_at: string;
  message: string;
}

// In-memory mock notification store
let notificationsStore: MockNotification[] = [...INITIAL_MOCK_NOTIFICATIONS];

/**
 * GET /v1/aqi?lat={lat}&lon={lon}
 */
export async function getAqi(lat: number, lon: number): Promise<AqiData> {
  if (USE_MOCKS || !API_BASE_URL) {
    return { ...DETERMINISTIC_EVENT.aqiReading };
  }

  const res = await fetch(`${API_BASE_URL}/v1/aqi?lat=${lat}&lon=${lon}`);
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
  if (USE_MOCKS || !API_BASE_URL) {
    return {
      fires: [{ ...DETERMINISTIC_EVENT.upwindFire }],
    };
  }

  const res = await fetch(
    `${API_BASE_URL}/v1/fires?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`
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
  _role?: string
): Promise<SchoolAdvisoryData> {
  if (USE_MOCKS || !API_BASE_URL) {
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

  const res = await fetch(`${API_BASE_URL}/v1/schools/${schoolId}/advisory`);
  if (!res.ok) {
    throw new Error(`Failed to fetch school advisory: ${res.statusText}`);
  }
  return res.json();
}

/**
 * GET /v1/notifications
 */
export async function getNotifications(): Promise<MockNotification[]> {
  if (USE_MOCKS || !API_BASE_URL) {
    return [...notificationsStore];
  }

  const res = await fetch(`${API_BASE_URL}/v1/notifications`);
  if (!res.ok) {
    throw new Error(`Failed to fetch notifications: ${res.statusText}`);
  }
  return res.json();
}

/**
 * POST /v1/complaints
 */
export async function submitComplaint(
  payload: ComplaintPayload
): Promise<ComplaintResponse> {
  if (USE_MOCKS || !API_BASE_URL) {
    const ticketId = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
    const newNotif: MockNotification = {
      id: `notif_${Date.now()}`,
      title: 'New Complaint Logged',
      message: `Report filed for ${payload.category}: "${payload.description.slice(0, 40)}..."`,
      severity: 'info',
      timestamp: 'Just now',
      read: false,
      sourceModule: 'shala',
    };
    notificationsStore = [newNotif, ...notificationsStore];

    return {
      ticket_id: ticketId,
      status: 'received',
      created_at: new Date().toISOString(),
      message: 'Report submitted successfully. Dispatched to response desk.',
    };
  }

  const res = await fetch(`${API_BASE_URL}/v1/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to submit complaint: ${res.statusText}`);
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
