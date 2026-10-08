import { describe, it, expect } from "vitest";
import {
  LocationSchema,
  IncidentReportSchema,
  SatelliteObservationSchema,
} from "../domain/schemas";
import { initialSeedData } from "../seed/data";

describe("Domain Schemas & Conventions", () => {
  it("validates a correct IncidentReport using lon and +05:30 offset", () => {
    const data = {
      id: "rep-1",
      reportedAt: "2023-10-08T10:00:00+05:30",
      reporterId: "usr-1",
      location: { lat: 30.0, lon: 75.0 },
      description: "Smoke spotted",
      district: "Sangrur",
      status: "OPEN",
    };
    const result = IncidentReportSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("proves lat/lon is accepted and lng is rejected strictly", () => {
    // LocationSchema itself is now strict
    expect(LocationSchema.safeParse({ lat: 30, lon: 75 }).success).toBe(true);
    expect(LocationSchema.safeParse({ lat: 30, lng: 75 }).success).toBe(false);
    expect(LocationSchema.safeParse({ lat: 30, lon: 75, lng: 75 }).success).toBe(false);
  });

  it("proves IndiaTimestampSchema strictly enforces +05:30", () => {
    // valid +05:30
    expect(IncidentReportSchema.shape.reportedAt.safeParse("2023-10-08T10:00:00+05:30").success).toBe(true);
    // equivalent Z fails
    expect(IncidentReportSchema.shape.reportedAt.safeParse("2023-10-08T04:30:00Z").success).toBe(false);
    // another offset fails
    expect(IncidentReportSchema.shape.reportedAt.safeParse("2023-10-08T10:00:00+00:00").success).toBe(false);
  });

  it("proves P4 seed data is in Sangrur and uses +05:30", () => {
    const report = initialSeedData.reports[0];
    const obs = initialSeedData.observations[0];
    const helpReq = initialSeedData.helpRequests[0];

    // Check district
    expect(report.district).toBe("Sangrur");
    expect(helpReq.district).toBe("Sangrur");

    // Check explicit timezone
    expect(report.reportedAt.endsWith("+05:30")).toBe(true);
    expect(obs.observedAt.endsWith("+05:30")).toBe(true);
    expect(helpReq.requiredFrom.endsWith("+05:30")).toBe(true);

    // Sanity check they parse correctly under the schema
    expect(IncidentReportSchema.safeParse(report).success).toBe(true);
  });

  it("rejects an invalid SatelliteObservation", () => {
    const data = {
      id: "obs-1",
      source: "UNKNOWN_SOURCE", // invalid source
      observedAt: "2023-10-08T10:00:00+05:30",
      location: { lat: 30.0, lon: 75.0 },
      confidence: 80,
      brightness: 300,
    };
    const result = SatelliteObservationSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
