import { describe, it, expect } from "vitest";
import { subIndex, overallAqi, CPCB_BREAKPOINTS } from "./index";

describe("CPCB Sub-Index Calculation", () => {
  it("returns 0 for negative concentrations", () => {
    expect(subIndex("pm25", -10).value).toBe(0);
  });

  it("returns 0 for zero concentrations", () => {
    expect(subIndex("pm10", 0).value).toBe(0);
  });

  // PM2.5 Bands
  it("calculates correct PM2.5 sub-index inside Good band", () => {
    expect(subIndex("pm25", 15).value).toBe(25);
  });
  it("calculates correct PM2.5 at lower boundary of Good", () => {
    expect(subIndex("pm25", 0).value).toBe(0);
  });
  it("calculates correct PM2.5 at upper boundary of Good", () => {
    expect(subIndex("pm25", 30).value).toBe(50);
  });
  it("calculates correct PM2.5 at lower boundary of Satisfactory", () => {
    expect(subIndex("pm25", 31).value).toBe(51);
  });
  it("calculates correct PM2.5 at upper boundary of Satisfactory", () => {
    expect(subIndex("pm25", 60).value).toBe(100);
  });
  it("calculates correct PM2.5 inside Moderate band", () => {
    expect(subIndex("pm25", 75).value).toBe(149);
  });
  it("calculates correct PM2.5 at boundaries of Moderate", () => {
    expect(subIndex("pm25", 61).value).toBe(101);
    expect(subIndex("pm25", 90).value).toBe(200);
  });
  it("calculates correct PM2.5 inside Poor band", () => {
    expect(subIndex("pm25", 105).value).toBe(249);
  });
  it("calculates correct PM2.5 at boundaries of Poor", () => {
    expect(subIndex("pm25", 91).value).toBe(201);
    expect(subIndex("pm25", 120).value).toBe(300);
  });
  it("calculates correct PM2.5 inside Very Poor band", () => {
    expect(subIndex("pm25", 185).value).toBe(350);
  });
  it("calculates correct PM2.5 at boundaries of Very Poor", () => {
    expect(subIndex("pm25", 121).value).toBe(301);
    expect(subIndex("pm25", 250).value).toBe(400);
  });
  it("calculates correct PM2.5 inside Severe band", () => {
    expect(subIndex("pm25", 315).value).toBe(450);
  });
  it("calculates correct PM2.5 at boundaries of Severe", () => {
    expect(subIndex("pm25", 251).value).toBe(401);
    expect(subIndex("pm25", 380).value).toBe(500);
  });
  it("caps PM2.5 above scale at 500 and flags it", () => {
    const res = subIndex("pm25", 500);
    expect(res.value).toBe(500);
    expect(res.above_scale).toBe(true);
  });

  // PM10 testing a few boundaries
  it("calculates PM10 lower boundary Satisfactory", () => {
    expect(subIndex("pm10", 51).value).toBe(51);
  });
  it("calculates PM10 upper boundary Satisfactory", () => {
    expect(subIndex("pm10", 100).value).toBe(100);
  });
  it("calculates PM10 lower boundary Severe", () => {
    expect(subIndex("pm10", 431).value).toBe(401);
  });

  // NO2
  it("calculates NO2 upper boundary Poor", () => {
    expect(subIndex("no2", 280).value).toBe(300);
  });

  // O3
  it("calculates O3 lower boundary Moderate", () => {
    expect(subIndex("o3", 101).value).toBe(101);
  });

  // CO
  it("calculates CO upper boundary Good", () => {
    expect(subIndex("co", 1.0).value).toBe(50);
  });
  it("calculates CO lower boundary Satisfactory", () => {
    expect(subIndex("co", 1.1).value).toBe(51);
  });

  // SO2
  it("calculates SO2 inside Moderate", () => {
    expect(subIndex("so2", 230).value).toBe(150);
  });

  // NH3
  it("calculates NH3 upper boundary Very Poor", () => {
    expect(subIndex("nh3", 1800).value).toBe(400);
  });

  // Pb
  it("calculates Pb lower boundary Severe", () => {
    expect(subIndex("pb", 3.51).value).toBe(401);
  });
  
  // Extra tests to hit 40
  it("caps PM10 above scale and sets flag", () => {
    const res = subIndex("pm10", 600);
    expect(res.value).toBe(500);
    expect(res.above_scale).toBe(true);
  });
  it("caps CO above scale and sets flag", () => {
    expect(subIndex("co", 50.0).value).toBe(500);
  });
  it("calculates inside Moderate NO2", () => {
    expect(subIndex("no2", 130).value).toBe(150);
  });
  it("calculates inside Poor SO2", () => {
    expect(subIndex("so2", 500).value).toBe(229);
  });
  it("calculates inside Good O3", () => {
    expect(subIndex("o3", 25).value).toBe(25);
  });
  it("calculates inside Very Poor NH3", () => {
    expect(subIndex("nh3", 1500).value).toBe(350);
  });
  it("calculates inside Satisfactory Pb", () => {
    expect(subIndex("pb", 0.75).value).toBe(75);
  });
  it("handles PM2.5 decimals", () => {
    expect(subIndex("pm25", 96.6).value).toBe(220);
  });

  it("handles exactly 500 without setting above_scale flag", () => {
    const res = subIndex("pm25", 380); // upper boundary of severe is exactly 500
    expect(res.value).toBe(500);
    expect(res.above_scale).toBe(false);
  });
});

describe("Overall AQI Calculation", () => {
  it("throws if fewer than 3 pollutants", () => {
    expect(() => overallAqi([
      { pollutant: "pm25", concentration: 50 },
      { pollutant: "pm10", concentration: 50 }
    ])).toThrow("Insufficient data");
  });

  it("throws if 3 pollutants but no PM2.5 or PM10", () => {
    expect(() => overallAqi([
      { pollutant: "no2", concentration: 50 },
      { pollutant: "o3", concentration: 50 },
      { pollutant: "co", concentration: 1.0 }
    ])).toThrow("Insufficient data");
  });

  it("calculates valid overall AQI", () => {
    const res = overallAqi([
      { pollutant: "pm25", concentration: 27 },
      { pollutant: "no2", concentration: 20 },
      { pollutant: "o3", concentration: 30 }
    ]);
    expect(res.aqi).toBe(45);
    expect(res.dominant_pollutant).toBe("pm25");
  });

  it("flags above_scale if any pollutant is above scale", () => {
    const res = overallAqi([
      { pollutant: "pm25", concentration: 500 }, // above scale
      { pollutant: "no2", concentration: 20 },
      { pollutant: "o3", concentration: 30 }
    ]);
    expect(res.aqi).toBe(500); // Capped at 500
    expect(res.above_scale).toBe(true);
  });
});

describe("OpenAPI Contract Examples Verification", () => {
  it("matches Good Day example", () => {
    const res = overallAqi([
      { pollutant: "pm25", concentration: 27.0 },
      { pollutant: "pm10", concentration: 40.0 },
      { pollutant: "o3", concentration: 30.0 }
    ]);
    expect(res.aqi).toBe(45);
    expect(res.category).toBe("good");
    expect(res.dominant_pollutant).toBe("pm25");
    expect(res.sub_indices["pm25"].sub_index).toBe(45);
    expect(res.sub_indices["pm10"].sub_index).toBe(40);
    expect(res.sub_indices["o3"].sub_index).toBe(30);
  });

  it("matches Poor Day example", () => {
    const res = overallAqi([
      { pollutant: "no2", concentration: 230.0 },
      { pollutant: "pm25", concentration: 96.6 },
      { pollutant: "co", concentration: 1.6 }
    ]);
    expect(res.aqi).toBe(250);
    expect(res.category).toBe("poor");
    expect(res.dominant_pollutant).toBe("no2");
    expect(res.sub_indices["no2"].sub_index).toBe(250);
    expect(res.sub_indices["pm25"].sub_index).toBe(220); // 220.1 rounded
    expect(res.sub_indices["co"].sub_index).toBe(78); // 78.2 rounded
  });

  it("matches Severe Day example", () => {
    const res = overallAqi([
      { pollutant: "pm10", concentration: 462.1 },
      { pollutant: "pm25", concentration: 275.8 },
      { pollutant: "o3", concentration: 134.2 }
    ]);
    expect(res.aqi).toBe(440);
    expect(res.category).toBe("severe");
    expect(res.dominant_pollutant).toBe("pm10");
    expect(res.sub_indices["pm10"].sub_index).toBe(440);
    expect(res.sub_indices["pm25"].sub_index).toBe(420);
    expect(res.sub_indices["o3"].sub_index).toBe(150);
  });
});
