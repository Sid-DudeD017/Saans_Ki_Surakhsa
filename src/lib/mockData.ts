/**
 * Deterministic Mock Fixture for Saans Platform (G0/G1)
 * Used when NEXT_PUBLIC_USE_MOCKS === 'true'
 */

export interface MockPollutionEvent {
  school: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    district: string;
    city: string;
    isDemoEntity: true;
  };
  aqiReading: {
    aqi: number;
    category: 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe';
    dominant_pollutant: string;
    pm25: number;
    pm10: number;
    timestamp: string;
    station_name: string;
    distance_km: number;
  };
  upwindFire: {
    id: string;
    latitude: number;
    longitude: number;
    distance_km: number;
    bearing_deg: number;
    is_upwind: boolean;
    confidence: 'high';
    detected_at: string;
  };
  wind: {
    speed_kmh: number;
    direction_deg: number;
    cardinal: string;
  };
  advisory: {
    grap_stage: string;
    outdoor_activities_permitted: boolean;
    mask_recommended: boolean;
    summary: string;
  };
}

export const DETERMINISTIC_EVENT: MockPollutionEvent = {
  school: {
    id: 'school_demo_001',
    name: 'Government Senior Secondary School — Sangrur Campus',
    latitude: 30.245,
    longitude: 75.842,
    district: 'Sangrur',
    city: 'Sangrur',
    isDemoEntity: true,
  },
  aqiReading: {
    aqi: 287,
    category: 'Poor',
    dominant_pollutant: 'PM2.5',
    pm25: 168,
    pm10: 221,
    timestamp: '2026-10-08T09:30:00Z',
    station_name: 'Sangrur Regional CAAQMS',
    distance_km: 1.4,
  },
  upwindFire: {
    id: 'fire_hotspot_088',
    latitude: 28.6545,
    longitude: 77.2982,
    distance_km: 1.1,
    bearing_deg: 315,
    is_upwind: true,
    confidence: 'high',
    detected_at: '2026-10-08T09:10:00Z',
  },
  wind: {
    speed_kmh: 12.0,
    direction_deg: 305,
    cardinal: 'NW',
  },
  advisory: {
    grap_stage: 'Stage II',
    outdoor_activities_permitted: false,
    mask_recommended: true,
    summary: 'Biomass smoke transported by NW winds has pushed school AQI to 287. All outdoor physical activities suspended.',
  },
};

export interface MockNotification {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'urgent';
  timestamp: string;
  read: boolean;
  sourceModule: string;
}

export const INITIAL_MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'notif_001',
    title: 'Air Quality Deteriorated',
    message: 'Air quality has deteriorated near Government Senior Secondary School — Sangrur Campus. AQI has reached 287 (Poor).',
    severity: 'urgent',
    timestamp: '10 mins ago',
    read: false,
    sourceModule: 'shala',
  },
  {
    id: 'notif_002',
    title: 'Upwind Smoke Detected',
    message: 'Thermal anomaly detected 1.1 km NW. North-west winds carrying smoke towards campus.',
    severity: 'warning',
    timestamp: '25 mins ago',
    read: false,
    sourceModule: 'kisan',
  },
  {
    id: 'notif_003',
    title: 'Principal Advisory Broadcast',
    message: 'Recess and morning assemblies moved indoors. Extra water breaks advised.',
    severity: 'info',
    timestamp: '40 mins ago',
    read: true,
    sourceModule: 'command',
  },
];
