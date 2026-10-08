import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAqiForLocation, updateDataForLocation, getDistanceFromLatLonInKm, calculateHeatIndex } from "./index";

describe("Distance & Weather Utilities", () => {
  it("calculates haversine distance correctly", () => {
    const d = getDistanceFromLatLonInKm(28.6139, 77.2090, 28.5355, 77.3910);
    // Delhi to Noida, approx 19-20km
    expect(d).toBeGreaterThan(18);
    expect(d).toBeLessThan(21);
  });

  it("calculates simple heat index correctly", () => {
    // 28C, 55% RH -> ~28.9C
    const hi = calculateHeatIndex(28, 55);
    expect(Math.abs(hi - 28.9)).toBeLessThan(0.2);
  });
});

describe("AQI Service Fallback & IDW", () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("returns 503 equivalent when all sources fail", async () => {
    mockFetch.mockRejectedValue(new Error("Network fail"));
    const { allFailed } = await updateDataForLocation(28.6, 77.2, { openaq: "key" });
    expect(allFailed).toBe(true);
  });

  it("identifies missing keys", async () => {
    mockFetch.mockRejectedValue(new Error("Network fail"));
    const { missingKeys } = await updateDataForLocation(28.6, 77.2, {});
    expect(missingKeys).toContain("OPENAQ_API_KEY");
    expect(missingKeys).toContain("CPCB_API_KEY");
  });
});
