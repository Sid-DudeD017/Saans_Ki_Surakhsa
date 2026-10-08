import { describe, it, expect } from "vitest";
import { initialSeedData } from "../seed/data";

describe("Seed Data Invariants", () => {
  it("contains exactly one canonical smoke report", () => {
    expect(initialSeedData.reports.length).toBe(1);
    expect(initialSeedData.reports[0].id).toBe("report-1");
  });

  it("contains one valid NASA FIRMS observation and one negative test", () => {
    const valid = initialSeedData.observations.find((o) => o.id === "obs-1");
    const invalid = initialSeedData.observations.find((o) => o.id === "obs-2");

    expect(valid).toBeDefined();
    expect(valid?.source).toBe("NASA_FIRMS");

    expect(invalid).toBeDefined();
    expect(invalid?.source).toBe("SEED");
  });

  it("contains an open farmer help request", () => {
    const req = initialSeedData.helpRequests.find((r) => r.id === "req-1");
    expect(req).toBeDefined();
    expect(req?.status).toBe("OPEN");
  });

  it("contains a compatible CHC machine", () => {
    const machine = initialSeedData.machineAssets.find(
      (m) => m.id === "machine-1",
    );
    expect(machine).toBeDefined();
    expect(machine?.machineType).toBe("Happy Seeder");
    expect(machine?.status).toBe("AVAILABLE");
  });
});
