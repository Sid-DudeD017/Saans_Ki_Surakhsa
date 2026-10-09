import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getAqi } from "../../src/app/v1/aqi/route";
import { GET as getFires } from "../../src/app/v1/fires/route";
import { GET as getForecast } from "../../src/app/v1/aqi/forecast/route";
import { POST as postIndoor } from "../../src/app/v1/indoor/estimate/route";
import { liveForecast } from "./forecast/live";
import { NextRequest } from "next/server";

vi.mock("./forecast/live", () => ({
  liveForecast: {
    current: vi.fn()
  }
}));

describe("Contract Tests - API Handlers", () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("validates /v1/aqi output matches AqiResponse schema", async () => {
    process.env.OPENAQ_API_KEY = "dummy";
    process.env.CPCB_API_KEY = "dummy";

    // Mock open-meteo AQI & weather responses
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("air-quality-api.open-meteo.com")) {
        return {
          ok: true,
          json: async () => ({
            current: {
              pm10: 45,
              pm2_5: 25,
              carbon_monoxide: 1200,
              nitrogen_dioxide: 40,
              sulphur_dioxide: 20,
              ozone: 60,
              ammonia: 10
            }
          })
        };
      }
      if (url.includes("api.open-meteo.com/v1/forecast")) {
        return {
          ok: true,
          json: async () => ({
            current: {
              temperature_2m: 30,
              relative_humidity_2m: 50,
              wind_speed_10m: 10,
              wind_direction_10m: 180
            }
          })
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const req = new Request("http://localhost:3000/v1/aqi?lat=28.6&lon=77.2");
    const res = await getAqi(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    
    // Validate schema
    expect(typeof data.aqi).toBe("number");
    expect(typeof data.category).toBe("string");
    expect(typeof data.dominant_pollutant).toBe("string");
    expect(typeof data.grap_stage).toBe("string");
    expect(typeof data.station_count).toBe("number");
    expect(typeof data.data_timestamp).toBe("string");
    expect(data.data_timestamp).toMatch(/\+05:30$/);
    expect(typeof data.stale).toBe("boolean");
    expect(typeof data.wind.speed_kmh).toBe("number");
    expect(typeof data.wind.direction_deg).toBe("number");
    expect(typeof data.weather.temperature_c).toBe("number");
    expect(typeof data.weather.humidity_pct).toBe("number");
    expect(typeof data.weather.heat_index_c).toBe("number");
    
    // Sub-indices
    expect(typeof data.sub_indices).toBe("object");
    const pm25 = data.sub_indices["pm25"];
    expect(typeof pm25.sub_index).toBe("number");
    expect(typeof pm25.concentration).toBe("number");
    expect(pm25.unit).toBe("ug/m3");
  });

  it("validates /v1/fires output matches FiresResponse schema", async () => {
    process.env.NASA_FIRMS_MAP_KEY = "dummy";
    
    const csvData = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n28.6,77.2,310.5,1.0,1.0,2026-10-08,0800,VIIRS,VIIRS,nominal,2.0,290.0,15.5,D\n28.7,77.3,312.5,1.0,1.0,2026-10-08,0815,VIIRS,VIIRS,high,2.0,295.0,20.0,D\n";
    
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => csvData
    });

    const req = new Request("http://localhost:3000/v1/fires?bbox=77.0,28.0,78.0,29.0");
    const res = await getFires(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(typeof data.count).toBe("number");
    expect(data.count).toBe(2);
    expect(typeof data.as_of).toBe("string");
    expect(Array.isArray(data.fires)).toBe(true);
    expect(data.fires.length).toBe(2);

    if (data.fires.length > 0) {
      const fire = data.fires[0];
      expect(typeof fire.lat).toBe("number");
      expect(typeof fire.lon).toBe("number");
      expect(typeof fire.acquisition_time).toBe("string");
      expect(fire.acquisition_time).toMatch(/\+05:30$/); // should be +05:30
      expect(typeof fire.satellite).toBe("string");
      expect(typeof fire.confidence).toBe("string");
      expect(typeof fire.frp).toBe("number");
      
      // Ensure no extra fields
      expect((fire as any).brightness_c).toBeUndefined();
      expect((fire as any).confidence_pct).toBeUndefined();
    }
  });

  it("validates /v1/aqi/forecast output matches ForecastResponse schema", async () => {
    const mockSnapshot = {
      version: 1,
      generated_at: "2026-10-09T08:00:00.000Z",
      start: "2026-10-09T00:00:00.000Z",
      hours: 24,
      step_deg: 0.25,
      anchors: [[114, 308], [114, 309], [115, 308], [115, 309]],
      pm25: Array(4).fill(Array(24).fill(50)),
      wind_u: Array(4).fill(Array(24).fill(0)),
      wind_v: Array(4).fill(Array(24).fill(0)),
      mixing_m: Array(4).fill(Array(24).fill(500)),
      fires: [],
      stations: [],
      sources: { open_meteo: 'ok', cpcb: 'ok', openaq: 'ok', firms: 'ok' }
    };
    (liveForecast.current as any).mockResolvedValue(mockSnapshot);

    const req = new Request("http://localhost:3000/v1/aqi/forecast?lat=28.6&lon=77.2");
    const res = await getForecast(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    
    expect(typeof data.lat).toBe("number");
    expect(typeof data.lon).toBe("number");
    expect(typeof data.generated_at).toBe("string");
    expect(data.generated_at).toMatch(/\+05:30$/);
    expect(Array.isArray(data.hours)).toBe(true);
    expect(typeof data.model).toBe("string");
    expect(typeof data.model_version).toBe("string");
    
    if (data.hours.length > 0) {
      const h = data.hours[0];
      expect(typeof h.time).toBe("string");
      expect(h.time).toMatch(/\+05:30$/);
      expect(typeof h.pm25_ug_m3).toBe("number");
      expect(typeof h.aqi).toBe("number");
      expect(typeof h.category).toBe("string");
      expect(h.category).toMatch(/^[a-z_]+$/);
    }
  });

  it("validates /v1/indoor/estimate output matches IndoorEstimateResponse schema", async () => {
    const mockSnapshot = {
      version: 1,
      generated_at: "2026-10-09T08:00:00.000Z",
      start: "2026-10-09T00:00:00.000Z",
      hours: 72,
      step_deg: 0.25,
      anchors: [[114, 308], [114, 309], [115, 308], [115, 309]],
      pm25: Array(4).fill(Array(72).fill(50)),
      wind_u: Array(4).fill(Array(72).fill(0)),
      wind_v: Array(4).fill(Array(72).fill(0)),
      mixing_m: Array(4).fill(Array(72).fill(500)),
      fires: [],
      stations: [],
      sources: { open_meteo: 'ok', cpcb: 'ok', openaq: 'ok', firms: 'ok' }
    };
    (liveForecast.current as any).mockResolvedValue(mockSnapshot);

    const req = new Request("http://localhost:3000/v1/indoor/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: 28.6,
        lon: 77.2,
        room_area_m2: 20,
        windows: 1,
        windows_open: true
      })
    });
    const res = await postIndoor(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    
    expect(typeof data.indoor_pm25_now_ug_m3).toBe("number");
    expect(typeof data.outdoor_pm25_now_ug_m3).toBe("number");
    expect(typeof data.today_plan).toBe("string");
    expect(typeof data.assumptions).toBe("object");
    expect(Array.isArray(data.hourly_series)).toBe(true);
    expect(Array.isArray(data.plan)).toBe(true);
    
    if (data.hourly_series.length > 0) {
      const h = data.hourly_series[0];
      expect(typeof h.time).toBe("string");
      expect(h.time).toMatch(/\+05:30$/);
      expect(typeof h.indoor_pm25_ug_m3).toBe("number");
      expect(typeof h.outdoor_pm25_ug_m3).toBe("number");
    }

    if (data.plan.length > 0) {
      const p = data.plan[0];
      expect(typeof p.kind).toBe("string");
      expect(p.kind).toMatch(/^[a-z_]+$/);
      expect(typeof p.text).toBe("string");
    }
  });

  describe("Fires endpoint parameters validation", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n28.6,77.2,310.5,1.0,1.0,2026-10-08,0800,VIIRS,VIIRS,nominal,2.0,290.0,15.5,D"
      });
      process.env.NASA_FIRMS_MAP_KEY = "dummy";
    });

    it("1. bbox request succeeds", async () => {
      const req = new Request("http://localhost:3000/v1/fires?bbox=77.0,28.0,78.0,29.0");
      const res = await getFires(req);
      expect(res.status).toBe(200);
    });

    it("2. lat + lon + radius_km request succeeds", async () => {
      const req = new Request("http://localhost:3000/v1/fires?lat=28.6139&lon=77.2090&radius_km=25");
      const res = await getFires(req);
      expect(res.status).toBe(200);
    });

    it("3. missing lon fails", async () => {
      const req = new Request("http://localhost:3000/v1/fires?lat=28.6139&radius_km=25");
      const res = await getFires(req);
      expect(res.status).toBe(422);
    });

    it("4. missing lat fails", async () => {
      const req = new Request("http://localhost:3000/v1/fires?lon=77.2090&radius_km=25");
      const res = await getFires(req);
      expect(res.status).toBe(422);
    });

    it("5. missing radius_km fails", async () => {
      const req = new Request("http://localhost:3000/v1/fires?lat=28.6139&lon=77.2090");
      const res = await getFires(req);
      expect(res.status).toBe(422);
    });

    it("6. radius_km <= 0 fails", async () => {
      const req = new Request("http://localhost:3000/v1/fires?lat=28.6139&lon=77.2090&radius_km=0");
      const res = await getFires(req);
      expect(res.status).toBe(422);
      
      const req2 = new Request("http://localhost:3000/v1/fires?lat=28.6139&lon=77.2090&radius_km=-5");
      const res2 = await getFires(req2);
      expect(res2.status).toBe(422);
    });

    it("7. invalid latitude fails", async () => {
      const req = new Request("http://localhost:3000/v1/fires?lat=95&lon=77.2090&radius_km=25");
      const res = await getFires(req);
      expect(res.status).toBe(422);
    });

    it("8. invalid longitude fails", async () => {
      const req = new Request("http://localhost:3000/v1/fires?lat=28.6139&lon=200&radius_km=25");
      const res = await getFires(req);
      expect(res.status).toBe(422);
    });
  });
});
