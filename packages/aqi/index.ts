export type PollutantCode = "pm25" | "pm10" | "no2" | "so2" | "co" | "o3" | "nh3" | "pb";
export type AqiCategoryCode = "good" | "satisfactory" | "moderate" | "poor" | "very_poor" | "severe";

export interface Breakpoint {
  bpLo: number;
  bpHi: number;
  iLo: number;
  iHi: number;
}

// Source: CPCB National AQI Document (VERIFY all values marked)
export const CPCB_BREAKPOINTS: Record<PollutantCode, Breakpoint[]> = {
  pm25: [ // 24-hr avg, ug/m3
    { bpLo: 0, bpHi: 30, iLo: 0, iHi: 50 },
    { bpLo: 31, bpHi: 60, iLo: 51, iHi: 100 },
    { bpLo: 61, bpHi: 90, iLo: 101, iHi: 200 },
    { bpLo: 91, bpHi: 120, iLo: 201, iHi: 300 },
    { bpLo: 121, bpHi: 250, iLo: 301, iHi: 400 },
    { bpLo: 251, bpHi: 380, iLo: 401, iHi: 500 }, // VERIFY upper bound
  ],
  pm10: [ // 24-hr avg, ug/m3
    { bpLo: 0, bpHi: 50, iLo: 0, iHi: 50 },
    { bpLo: 51, bpHi: 100, iLo: 51, iHi: 100 },
    { bpLo: 101, bpHi: 250, iLo: 101, iHi: 200 },
    { bpLo: 251, bpHi: 350, iLo: 201, iHi: 300 },
    { bpLo: 351, bpHi: 430, iLo: 301, iHi: 400 },
    { bpLo: 431, bpHi: 510, iLo: 401, iHi: 500 }, // VERIFY upper bound
  ],
  no2: [ // 24-hr avg, ug/m3
    { bpLo: 0, bpHi: 40, iLo: 0, iHi: 50 },
    { bpLo: 41, bpHi: 80, iLo: 51, iHi: 100 },
    { bpLo: 81, bpHi: 180, iLo: 101, iHi: 200 },
    { bpLo: 181, bpHi: 280, iLo: 201, iHi: 300 },
    { bpLo: 281, bpHi: 400, iLo: 301, iHi: 400 },
    { bpLo: 401, bpHi: 500, iLo: 401, iHi: 500 }, // VERIFY upper bound
  ],
  o3: [ // 8-hr avg, ug/m3
    { bpLo: 0, bpHi: 50, iLo: 0, iHi: 50 },
    { bpLo: 51, bpHi: 100, iLo: 51, iHi: 100 },
    { bpLo: 101, bpHi: 168, iLo: 101, iHi: 200 },
    { bpLo: 169, bpHi: 208, iLo: 201, iHi: 300 },
    { bpLo: 209, bpHi: 748, iLo: 301, iHi: 400 }, // VERIFY
    { bpLo: 749, bpHi: 1000, iLo: 401, iHi: 500 }, // VERIFY upper bound
  ],
  co: [ // 8-hr avg, mg/m3
    { bpLo: 0.0, bpHi: 1.0, iLo: 0, iHi: 50 },
    { bpLo: 1.1, bpHi: 2.0, iLo: 51, iHi: 100 },
    { bpLo: 2.1, bpHi: 10.0, iLo: 101, iHi: 200 },
    { bpLo: 10.1, bpHi: 17.0, iLo: 201, iHi: 300 },
    { bpLo: 17.1, bpHi: 34.0, iLo: 301, iHi: 400 },
    { bpLo: 34.1, bpHi: 46.0, iLo: 401, iHi: 500 }, // VERIFY upper bound
  ],
  so2: [ // 24-hr avg, ug/m3
    { bpLo: 0, bpHi: 40, iLo: 0, iHi: 50 },
    { bpLo: 41, bpHi: 80, iLo: 51, iHi: 100 },
    { bpLo: 81, bpHi: 380, iLo: 101, iHi: 200 },
    { bpLo: 381, bpHi: 800, iLo: 201, iHi: 300 },
    { bpLo: 801, bpHi: 1600, iLo: 301, iHi: 400 },
    { bpLo: 1601, bpHi: 2100, iLo: 401, iHi: 500 }, // VERIFY upper bound
  ],
  nh3: [ // 24-hr avg, ug/m3
    { bpLo: 0, bpHi: 200, iLo: 0, iHi: 50 },
    { bpLo: 201, bpHi: 400, iLo: 51, iHi: 100 },
    { bpLo: 401, bpHi: 800, iLo: 101, iHi: 200 },
    { bpLo: 801, bpHi: 1200, iLo: 201, iHi: 300 },
    { bpLo: 1201, bpHi: 1800, iLo: 301, iHi: 400 },
    { bpLo: 1801, bpHi: 2400, iLo: 401, iHi: 500 }, // VERIFY upper bound
  ],
  pb: [ // 24-hr avg, ug/m3
    { bpLo: 0.0, bpHi: 0.5, iLo: 0, iHi: 50 },
    { bpLo: 0.51, bpHi: 1.0, iLo: 51, iHi: 100 },
    { bpLo: 1.1, bpHi: 2.0, iLo: 101, iHi: 200 },
    { bpLo: 2.1, bpHi: 3.0, iLo: 201, iHi: 300 },
    { bpLo: 3.1, bpHi: 3.5, iLo: 301, iHi: 400 },
    { bpLo: 3.51, bpHi: 4.0, iLo: 401, iHi: 500 }, // VERIFY upper bound
  ],
};

export function getCategoryCode(aqi: number): AqiCategoryCode {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "satisfactory";
  if (aqi <= 200) return "moderate";
  if (aqi <= 300) return "poor";
  if (aqi <= 400) return "very_poor";
  return "severe";
}

export interface SubIndexResult {
  value: number;
  above_scale: boolean;
}

export function subIndex(pollutant: PollutantCode, concentration: number): SubIndexResult {
  if (concentration <= 0) return { value: 0, above_scale: false };
  
  const bands = CPCB_BREAKPOINTS[pollutant];
  let band = bands.find(b => concentration >= b.bpLo && concentration <= b.bpHi);
  let above_scale = false;
  
  if (!band) {
    band = bands[bands.length - 1];
    if (concentration > band.bpHi) {
        above_scale = true;
    } else if (concentration < bands[0].bpLo) {
        band = bands[0]; 
    }
  }

  const rawIdx = ((band.iHi - band.iLo) / (band.bpHi - band.bpLo)) * (concentration - band.bpLo) + band.iLo;
  let finalIdx = Math.round(rawIdx);
  if (finalIdx > 500) {
    finalIdx = 500;
  }
  return { value: finalIdx, above_scale };
}

export interface AqiReading {
  pollutant: PollutantCode;
  concentration: number;
}

export interface AqiResult {
  aqi: number;
  category: AqiCategoryCode;
  dominant_pollutant: PollutantCode;
  sub_indices: Record<string, { sub_index: number; concentration: number; unit: string }>;
  above_scale?: boolean;
}

export function overallAqi(readings: AqiReading[]): AqiResult {
  // CPCB Rule: Minimum 3 pollutants required, at least one of which must be PM2.5 or PM10 (VERIFY)
  const hasMinPollutants = readings.length >= 3;
  const hasCoreParticulate = readings.some(r => r.pollutant === "pm25" || r.pollutant === "pm10");
  
  if (!hasMinPollutants || !hasCoreParticulate) {
    throw new Error("Insufficient data: AQI requires >= 3 pollutants including PM2.5 or PM10");
  }

  const subIndices: Record<string, { sub_index: number; concentration: number; unit: string }> = {};
  let maxIdx = -1;
  let dominant: PollutantCode | null = null;
  let anyAboveScale = false;

  for (const r of readings) {
    const res = subIndex(r.pollutant, r.concentration);
    subIndices[r.pollutant] = {
      sub_index: res.value,
      concentration: r.concentration,
      unit: r.pollutant === "co" ? "mg/m3" : "ug/m3"
    };
    if (res.above_scale) anyAboveScale = true;
    
    if (res.value > maxIdx) {
      maxIdx = res.value;
      dominant = r.pollutant;
    }
  }

  const result: AqiResult = {
    aqi: maxIdx,
    category: getCategoryCode(maxIdx),
    dominant_pollutant: dominant as PollutantCode,
    sub_indices: subIndices,
  };
  
  if (anyAboveScale) result.above_scale = true;
  return result;
}
