import { describe, it, expect } from "vitest";
import {
  IncidentReportSchema,
  SatelliteObservationSchema,
  HelpRequestSchema,
} from "../domain/schemas";

describe("Domain Schemas", () => {
  it("validates a correct IncidentReport", () => {
    const data = {
      id: "rep-1",
      reportedAt: "2023-10-08T10:00:00Z",
      reporterId: "usr-1",
      location: { lat: 30.0, lng: 75.0 },
      description: "Smoke spotted",
      district: "Patiala",
      status: "OPEN",
    };
    const result = IncidentReportSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid SatelliteObservation", () => {
    const data = {
      id: "obs-1",
      source: "UNKNOWN_SOURCE", // invalid source
      observedAt: "2023-10-08T10:00:00Z",
      location: { lat: 30.0, lng: 75.0 },
      confidence: 80,
      brightness: 300,
    };
    const result = SatelliteObservationSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
