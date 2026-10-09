// AQI fixtures for Saans Shala until it reads P3's live GET /v1/aqi: the contract's own examples
// (p3-aqi.openapi.json), copied as they are; src/__tests__/shala-air-buddy.test.ts keeps them in step.
import type { AqiResponse } from './airQuality';

export const AQI_FIXTURES = {
  "good_day": {
    "aqi": 45,
    "category": "good",
    "dominant_pollutant": "pm25",
    "sub_indices": {
      "pm25": {
        "sub_index": 45,
        "concentration": 27.0,
        "unit": "ug/m3"
      },
      "pm10": {
        "sub_index": 40,
        "concentration": 40.0,
        "unit": "ug/m3"
      },
      "o3": {
        "sub_index": 30,
        "concentration": 30.0,
        "unit": "ug/m3"
      }
    },
    "grap_stage": "none",
    "station_count": 3,
    "data_timestamp": "2026-10-08T08:00:00+05:30",
    "stale": false,
    "wind": {
      "speed_kmh": 12.5,
      "direction_deg": 270.0
    },
    "weather": {
      "temperature_c": 28.0,
      "humidity_pct": 55,
      "heat_index_c": 28.9
    }
  },
  "poor_day": {
    "aqi": 250,
    "category": "poor",
    "dominant_pollutant": "no2",
    "sub_indices": {
      "no2": {
        "sub_index": 250,
        "concentration": 230.0,
        "unit": "ug/m3"
      },
      "pm25": {
        "sub_index": 220,
        "concentration": 96.6,
        "unit": "ug/m3"
      },
      "co": {
        "sub_index": 78,
        "concentration": 1.6,
        "unit": "mg/m3"
      }
    },
    "grap_stage": "stage_1",
    "station_count": 5,
    "data_timestamp": "2026-10-08T08:00:00+05:30",
    "stale": false,
    "wind": {
      "speed_kmh": 5.0,
      "direction_deg": 90.0
    },
    "weather": {
      "temperature_c": 33.0,
      "humidity_pct": 60,
      "heat_index_c": 39.5
    }
  },
  "severe_day": {
    "aqi": 440,
    "category": "severe",
    "dominant_pollutant": "pm10",
    "sub_indices": {
      "pm10": {
        "sub_index": 440,
        "concentration": 462.1,
        "unit": "ug/m3"
      },
      "pm25": {
        "sub_index": 420,
        "concentration": 275.8,
        "unit": "ug/m3"
      },
      "o3": {
        "sub_index": 150,
        "concentration": 134.2,
        "unit": "ug/m3"
      }
    },
    "grap_stage": "stage_3",
    "station_count": 4,
    "data_timestamp": "2026-10-08T08:00:00+05:30",
    "stale": false,
    "wind": {
      "speed_kmh": 2.0,
      "direction_deg": 180.0
    },
    "weather": {
      "temperature_c": 38.0,
      "humidity_pct": 45,
      "heat_index_c": 45.9
    }
  }
} satisfies Record<string, AqiResponse>;

export type FixtureDay = keyof typeof AQI_FIXTURES;
