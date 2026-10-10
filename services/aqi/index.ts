import { overallAqi, PollutantCode, AqiCategoryCode } from "../../packages/aqi/index";

export interface NormalizedReading {
  station_id: string;
  lat: number;
  lon: number;
  pollutant: PollutantCode;
  concentration: number;
  unit: string;
  timestamp: string;
  source: "cpcb" | "openaq" | "open-meteo";
}

export interface WeatherData {
  temperature_c: number;
  humidity_pct: number;
  heat_index_c: number;
  speed_kmh: number;
  direction_deg: number;
}

// Calculate distance in km between two lat/lon points using Haversine formula
export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

// Compute heat index
export function calculateHeatIndex(tc: number, rh: number): number {
  const tf = tc * 9/5 + 32;
  let hi = 0.5 * (tf + 61 + (tf-68)*1.2 + rh*0.094);
  if (hi >= 80) {
    hi = -42.379 + 2.04901523*tf + 10.14333127*rh - 0.22475541*tf*rh
         - 6.83783e-3*tf*tf - 5.481717e-2*rh*rh + 1.22874e-3*tf*tf*rh
         + 8.5282e-4*tf*rh*rh - 1.99e-6*tf*tf*rh*rh;
    if (rh < 13 && tf > 80 && tf < 112) {
      hi -= ((13-rh)/4) * Math.sqrt((17 - Math.abs(tf-95))/17);
    }
    if (rh > 85 && tf > 80 && tf < 87) {
      hi += ((rh-85)/10) * ((87-tf)/5);
    }
  }
  return (hi - 32) * 5/9;
}

export const IST_OFFSET_MS = 330 * 60 * 1000;

export function toIstIsoString(dateOrMs: Date | number = Date.now()): string {
  const ms = typeof dateOrMs === 'number' ? dateOrMs : dateOrMs.getTime();
  const istDate = new Date(ms + IST_OFFSET_MS);
  const yyyy = istDate.getUTCFullYear();
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getUTCDate()).padStart(2, '0');
  const hh = String(istDate.getUTCHours()).padStart(2, '0');
  const min = String(istDate.getUTCMinutes()).padStart(2, '0');
  const sec = String(istDate.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}+05:30`;
}

export interface StorageLayer {
  getLatestReadings(lat: number, lon: number, radiusKm: number): Promise<NormalizedReading[]>;
  saveReadings(readings: NormalizedReading[]): Promise<void>;
  getWeather(lat: number, lon: number): Promise<WeatherData | null>;
  saveWeather(lat: number, lon: number, weather: WeatherData): Promise<void>;
}

export class InMemoryStorage implements StorageLayer {
  private readings: NormalizedReading[] = [];
  private weather: Record<string, WeatherData> = {};

  async getLatestReadings(lat: number, lon: number, radiusKm: number): Promise<NormalizedReading[]> {
    return this.readings.filter(r => getDistanceFromLatLonInKm(lat, lon, r.lat, r.lon) <= radiusKm);
  }

  async saveReadings(newReadings: NormalizedReading[]): Promise<void> {
    const map = new Map<string, NormalizedReading>();
    for (const r of this.readings) {
      map.set(`${r.station_id}:${r.pollutant}`, r);
    }
    for (const r of newReadings) {
      map.set(`${r.station_id}:${r.pollutant}`, r);
    }
    this.readings = Array.from(map.values());
  }

  async getWeather(lat: number, lon: number): Promise<WeatherData | null> {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    return this.weather[key] || null;
  }

  async saveWeather(lat: number, lon: number, w: WeatherData): Promise<void> {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    this.weather[key] = w;
  }
}

const storage = new InMemoryStorage();

// Fetchers
async function fetchOpenMeteo(lat: number, lon: number): Promise<{ readings: NormalizedReading[], weather: WeatherData }> {
  // Open-Meteo Air Quality & Weather API
  // Free, no key required
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,ammonia`;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
  
  const [aqRes, wRes] = await Promise.all([fetch(url), fetch(weatherUrl)]);
  if (!aqRes.ok || !wRes.ok) throw new Error("Open-Meteo fetch failed");

  const aqData = await aqRes.json();
  const wData = await wRes.json();

  const timestamp = new Date().toISOString(); // Open-Meteo provides current hourly
  const readings: NormalizedReading[] = [];
  const current = aqData.current;
  
  const map: Record<string, PollutantCode> = {
    pm2_5: "pm25", pm10: "pm10", nitrogen_dioxide: "no2", 
    sulphur_dioxide: "so2", carbon_monoxide: "co", ozone: "o3", ammonia: "nh3"
  };

  for (const [key, val] of Object.entries(current)) {
    if (map[key] && typeof val === "number") {
      let concentration = val;
      let unit = "ug/m3";
      if (map[key] === "co") {
         // Open-Meteo returns CO in ug/m3, we need mg/m3
         concentration = val / 1000;
         unit = "mg/m3";
      }
      readings.push({
        station_id: "open-meteo-model",
        lat, lon,
        pollutant: map[key],
        concentration, unit, timestamp,
        source: "open-meteo"
      });
    }
  }

  const tc = wData.current.temperature_2m;
  const rh = wData.current.relative_humidity_2m;
  const weather: WeatherData = {
    temperature_c: tc,
    humidity_pct: rh,
    heat_index_c: calculateHeatIndex(tc, rh),
    speed_kmh: wData.current.wind_speed_10m,
    direction_deg: wData.current.wind_direction_10m
  };

  return { readings, weather };
}

async function fetchOpenAQ(lat: number, lon: number, radiusKm: number, apiKey: string): Promise<NormalizedReading[]> {
  const readings: NormalizedReading[] = [];

  try {
    // OpenAQ v3 API
    const radiusMeters = Math.min(25000, Math.max(1000, Math.round(radiusKm * 1000)));
    const locUrl = `https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=${radiusMeters}&limit=10`;
    const locRes = await fetch(locUrl, { headers: { "X-API-Key": apiKey } });

    if (locRes.ok) {
      const locData = await locRes.json();
      const locations = (locData.results || []).slice(0, 5);

      for (const loc of locations) {
        try {
          const latestUrl = `https://api.openaq.org/v3/locations/${loc.id}/latest`;
          const lRes = await fetch(latestUrl, { headers: { "X-API-Key": apiKey } });
          if (!lRes.ok) continue;
          const lData = await lRes.json();

          const sensorMap = new Map<number, string>();
          for (const s of loc.sensors || []) {
            if (s.id && s.parameter?.name) {
              sensorMap.set(s.id, s.parameter.name.toLowerCase());
            }
          }

          const paramMap: Record<string, PollutantCode> = {
            pm25: "pm25",
            pm10: "pm10",
            no2: "no2",
            so2: "so2",
            co: "co",
            o3: "o3",
            nh3: "nh3",
          };

          for (const m of lData.results || []) {
            const rawParam = sensorMap.get(m.sensorsId);
            const pollutant = rawParam ? paramMap[rawParam] : undefined;
            if (pollutant && typeof m.value === 'number') {
              const val = pollutant === "co" && m.value > 50 ? m.value / 1000 : m.value;
              readings.push({
                station_id: `openaq-${loc.id}`,
                lat: loc.coordinates?.latitude ?? lat,
                lon: loc.coordinates?.longitude ?? lon,
                pollutant,
                concentration: val,
                unit: pollutant === "co" ? "mg/m3" : "ug/m3",
                timestamp: m.datetime?.utc || new Date().toISOString(),
                source: "openaq",
              });
            }
          }
        } catch {
          // Continue to next location
        }
      }

      if (readings.length > 0) {
        return readings;
      }
    }
  } catch (err) {
    // OpenAQ v3 failed, proceed to v2 fallback
  }

  // Fallback to OpenAQ v2 for mock tests / legacy endpoints
  try {
    const url = `https://api.openaq.org/v2/latest?coordinates=${lat},${lon}&radius=${radiusKm * 1000}`;
    const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
    if (!res.ok) throw new Error("OpenAQ fetch failed");
    const data = await res.json();

    for (const result of data.results || []) {
      for (const m of result.measurements || []) {
        if (["pm25", "pm10", "no2", "so2", "co", "o3"].includes(m.parameter)) {
          readings.push({
            station_id: `openaq-${result.locationId}`,
            lat: result.coordinates.latitude,
            lon: result.coordinates.longitude,
            pollutant: m.parameter as PollutantCode,
            concentration: m.parameter === "co" && m.unit === "µg/m³" ? m.value / 1000 : m.value,
            unit: m.parameter === "co" ? "mg/m3" : "ug/m3",
            timestamp: m.lastUpdated,
            source: "openaq",
          });
        }
      }
    }
  } catch {
    if (readings.length === 0) {
      throw new Error("OpenAQ fetch failed");
    }
  }

  return readings;
}

async function fetchCPCB(lat: number, lon: number, apiKey: string): Promise<NormalizedReading[]> {
  const url = `https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key=${apiKey}&format=json&offset=0&limit=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("CPCB fetch failed");
  const data = await res.json();

  const readings: NormalizedReading[] = [];
  const map: Record<string, PollutantCode> = {
    "PM2.5": "pm25", "PM10": "pm10", "NO2": "no2",
    "SO2": "so2", "CO": "co", "OZONE": "o3", "NH3": "nh3"
  };

  for (const record of (data.records || [])) {
    if (map[record.pollutant_id]) {
      const pLat = parseFloat(record.latitude);
      const pLon = parseFloat(record.longitude);
      // Rough bounding box optimization before full Haversine, or just grab all since data.gov.in returns all for India.
      // To keep it simple, we normalize everything and let the IDW filter it later, or filter here to save memory.
      if (!isNaN(pLat) && !isNaN(pLon)) {
        if (getDistanceFromLatLonInKm(lat, lon, pLat, pLon) <= 100) {
          const val = parseFloat(record.pollutant_avg);
          if (!isNaN(val)) {
             readings.push({
               station_id: `cpcb-${record.station}`,
               lat: pLat,
               lon: pLon,
               pollutant: map[record.pollutant_id],
               concentration: val,
               unit: record.pollutant_id === "CO" ? "mg/m3" : "ug/m3",
               timestamp: new Date().toISOString(), // Or from record.last_update
               source: "cpcb"
             });
          }
        }
      }
    }
  }
  return readings;
}

export async function updateDataForLocation(lat: number, lon: number, keys: { openaq?: string, cpcb?: string }): Promise<{ missingKeys: string[], allFailed: boolean }> {
  const missingKeys: string[] = [];
  if (!keys.openaq) missingKeys.push("OPENAQ_API_KEY");
  if (!keys.cpcb) missingKeys.push("CPCB_API_KEY");

  // Prevent rate limits: Check if we have recent readings (e.g. < 15 mins old)
  const existingReadings = await storage.getLatestReadings(lat, lon, 50);
  if (existingReadings.length > 0) {
    const newest = Math.max(...existingReadings.map(r => new Date(r.timestamp).getTime()));
    if (Date.now() - newest < 15 * 60 * 1000) {
      return { missingKeys, allFailed: false }; // Skip fetch, we have fresh data
    }
  }

  let cpcbData: NormalizedReading[] = [];
  let openaqData: NormalizedReading[] = [];
  let omData: { readings: NormalizedReading[], weather: WeatherData } | null = null;
  let successCount = 0;

  try {
    if (keys.cpcb) {
      cpcbData = await fetchCPCB(lat, lon, keys.cpcb);
      successCount++;
    }
  } catch (e) { console.error("CPCB error:", e); }

  try {
    if (keys.openaq) {
      openaqData = await fetchOpenAQ(lat, lon, 50, keys.openaq);
      successCount++;
    }
  } catch (e) { console.error("OpenAQ error:", e); }

  try {
    omData = await fetchOpenMeteo(lat, lon);
    successCount++;
  } catch (e) { console.error("Open-Meteo error:", e); }

  if (successCount === 0) {
    return { missingKeys, allFailed: true };
  }

  const allReadings = [...cpcbData, ...openaqData, ...(omData?.readings || [])];
  if (allReadings.length > 0) {
    // Add a synthetic timestamp to track when we fetched, as some APIs return older timestamps
    const fetchTime = new Date().toISOString();
    await storage.saveReadings(allReadings.map(r => ({ ...r, timestamp: fetchTime })));
  }
  if (omData?.weather) {
    await storage.saveWeather(lat, lon, omData.weather);
  }

  return { missingKeys, allFailed: false };
}

export function getGrapStage(aqi: number): string {
  if (aqi <= 200) return "none";
  if (aqi <= 300) return "stage_1";
  if (aqi <= 400) return "stage_2";
  if (aqi <= 450) return "stage_3";
  return "stage_4";
}

export async function getAqiForLocation(lat: number, lon: number) {
  const radiusKm = 50;
  let readings = await storage.getLatestReadings(lat, lon, radiusKm);
  
  if (readings.length === 0) {
    return null; // 404
  }

  // Group by pollutant
  const byPollutant: Record<string, NormalizedReading[]> = {};
  for (const r of readings) {
    if (!byPollutant[r.pollutant]) byPollutant[r.pollutant] = [];
    byPollutant[r.pollutant].push(r);
  }

  // Fallback + IDW
  const finalReadings: { pollutant: PollutantCode, concentration: number }[] = [];
  const activeStations = new Set<string>();
  let newestTime = 0;

  for (const [pol, arr] of Object.entries(byPollutant)) {
    // Filter by fallback: CPCB > OpenAQ > Open-Meteo
    let sourceToUse = "open-meteo";
    if (arr.some(r => r.source === "cpcb")) sourceToUse = "cpcb";
    else if (arr.some(r => r.source === "openaq")) sourceToUse = "openaq";

    const filtered = arr.filter(r => r.source === sourceToUse);
    
    // Inverse Distance Weighting
    let num = 0;
    let den = 0;
    for (const r of filtered) {
      activeStations.add(r.station_id);
      const t = new Date(r.timestamp).getTime();
      if (t > newestTime) newestTime = t;

      const d = getDistanceFromLatLonInKm(lat, lon, r.lat, r.lon);
      if (d < 0.1) {
        num = r.concentration;
        den = 1;
        break; // extremely close, just use this
      }
      const w = 1 / Math.pow(d, 2);
      num += r.concentration * w;
      den += w;
    }
    
    if (den > 0) {
      finalReadings.push({ pollutant: pol as PollutantCode, concentration: num / den });
    }
  }

  try {
    const aqiResult = overallAqi(finalReadings);
    const weather = await storage.getWeather(lat, lon);
    const stale = newestTime > 0 ? (Date.now() - newestTime) > 3 * 60 * 60 * 1000 : false;
    const iso = toIstIsoString(newestTime || Date.now());

    return {
      aqi: aqiResult.aqi,
      category: aqiResult.category,
      dominant_pollutant: aqiResult.dominant_pollutant,
      sub_indices: aqiResult.sub_indices,
      grap_stage: getGrapStage(aqiResult.aqi),
      station_count: activeStations.size,
      data_timestamp: iso,
      stale,
      wind: {
        speed_kmh: weather?.speed_kmh || 0,
        direction_deg: weather?.direction_deg || 0
      },
      weather: weather ? {
        temperature_c: weather.temperature_c,
        humidity_pct: weather.humidity_pct,
        heat_index_c: weather.heat_index_c
      } : { temperature_c: 0, humidity_pct: 0, heat_index_c: 0 }
    };
  } catch (e) {
    return null;
  }
}
