// AQI fixtures for Saans Shala until it reads P3's live GET /v1/aqi, one day per CPCB category.
// Good, poor and severe are the contract's own examples (p3-aqi.openapi.json), copied as they are. The
// other three are computed from their concentrations with P3's CPCB code (packages/aqi) and heat index
// (services/aqi); src/__tests__/shala-air-buddy.test.ts checks both.
import type { AqiResponse, Category } from './airQuality';

/** The contract's examples, by their names there. */
export const CONTRACT_DAYS = {
  good_day: {
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
  poor_day: {
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
  severe_day: {
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
  },
} satisfies Record<string, AqiResponse>;

/** Days the contract has no example for, worked out from these concentrations and weather. */
export const COMPUTED_DAYS = {
  satisfactory: {
    "aqi": 88,
    "category": "satisfactory",
    "dominant_pollutant": "pm10",
    "sub_indices": {
      "pm25": {
        "sub_index": 70,
        "concentration": 42,
        "unit": "ug/m3"
      },
      "pm10": {
        "sub_index": 88,
        "concentration": 88,
        "unit": "ug/m3"
      },
      "no2": {
        "sub_index": 65,
        "concentration": 52,
        "unit": "ug/m3"
      },
      "co": {
        "sub_index": 51,
        "concentration": 1.1,
        "unit": "mg/m3"
      }
    },
    "grap_stage": "none",
    "station_count": 4,
    "data_timestamp": "2026-10-08T08:00:00+05:30",
    "stale": false,
    "wind": {
      "speed_kmh": 9.0,
      "direction_deg": 300.0
    },
    "weather": {
      "temperature_c": 30.0,
      "humidity_pct": 58,
      "heat_index_c": 32.4
    }
  },
  moderate: {
    "aqi": 145,
    "category": "moderate",
    "dominant_pollutant": "pm25",
    "sub_indices": {
      "pm25": {
        "sub_index": 145,
        "concentration": 74,
        "unit": "ug/m3"
      },
      "pm10": {
        "sub_index": 144,
        "concentration": 165,
        "unit": "ug/m3"
      },
      "no2": {
        "sub_index": 116,
        "concentration": 96,
        "unit": "ug/m3"
      },
      "so2": {
        "sub_index": 23,
        "concentration": 18,
        "unit": "ug/m3"
      }
    },
    "grap_stage": "none",
    "station_count": 5,
    "data_timestamp": "2026-10-08T08:00:00+05:30",
    "stale": false,
    "wind": {
      "speed_kmh": 6.0,
      "direction_deg": 315.0
    },
    "weather": {
      "temperature_c": 26.0,
      "humidity_pct": 65,
      "heat_index_c": 26.4
    }
  },
  very_poor: {
    "aqi": 348,
    "category": "very_poor",
    "dominant_pollutant": "pm25",
    "sub_indices": {
      "pm25": {
        "sub_index": 348,
        "concentration": 182,
        "unit": "ug/m3"
      },
      "pm10": {
        "sub_index": 280,
        "concentration": 330,
        "unit": "ug/m3"
      },
      "no2": {
        "sub_index": 160,
        "concentration": 140,
        "unit": "ug/m3"
      },
      "co": {
        "sub_index": 105,
        "concentration": 2.4,
        "unit": "mg/m3"
      }
    },
    "grap_stage": "stage_2",
    "station_count": 5,
    "data_timestamp": "2026-10-08T08:00:00+05:30",
    "stale": false,
    "wind": {
      "speed_kmh": 3.0,
      "direction_deg": 310.0
    },
    "weather": {
      "temperature_c": 22.0,
      "humidity_pct": 72,
      "heat_index_c": 22.1
    }
  },
} satisfies Record<string, AqiResponse>;

export const AQI_FIXTURES: Record<Category, AqiResponse> = {
  good: CONTRACT_DAYS.good_day,
  satisfactory: COMPUTED_DAYS.satisfactory,
  moderate: COMPUTED_DAYS.moderate,
  poor: CONTRACT_DAYS.poor_day,
  very_poor: COMPUTED_DAYS.very_poor,
  severe: CONTRACT_DAYS.severe_day,
};
