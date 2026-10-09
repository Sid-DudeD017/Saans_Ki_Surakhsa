// The case console's rules (P4): what each action does, when a CHC machine is free, and which one to send.
import { describe, expect, it } from "vitest";

import { ACTIONS, distanceText, freeWindow, nextStatus, recommendMachine } from "./cases";

describe("distances", () => {
  it("in metres under a kilometre, kilometres above", () => {
    expect([distanceText(3), distanceText(466), distanceText(999), distanceText(1000), distanceText(4321)]).toEqual(["10 m", "470 m", "1.0 km", "1.0 km", "4.3 km"]);
  });
});

describe("actions", () => {
  it("APPROVE and CHANGE settle the recommendation, REJECT reopens it, notes keep the status, CLOSE ends it", () => {
    expect(ACTIONS.map((a) => nextStatus(a, "ACTION_APPROVED"))).toEqual(["ACTION_APPROVED", "ACTION_CHANGED", "OPEN", "ACTION_APPROVED", "ACTION_APPROVED", "CLOSED"]);
    expect(nextStatus("MARK_IN_FIELD", "OPEN")).toBe("OPEN");
  });
});

describe("when a machine is free", () => {
  it("finds the first run of free days inside the window", () => {
    expect(freeWindow(["2026-10-20/2026-11-08"], 1, "2026-10-20", "2026-11-09")).toEqual({ from: "2026-11-09", until: "2026-11-09" });
    expect(freeWindow(["2026-10-20/2026-11-01", "2026-11-03/2026-11-08"], 1, "2026-10-20", "2026-11-09")).toEqual({ from: "2026-11-02", until: "2026-11-02" });
    expect(freeWindow(["2026-10-20/2026-11-09"], 1, "2026-10-20", "2026-11-09")).toBeNull();
    expect(freeWindow([], 2, "2026-10-20", "2026-11-09")).toEqual({ from: "2026-10-20", until: "2026-11-09" });
  });

  it("a second unit is free while the first is booked", () => {
    expect(freeWindow(["2026-10-20/2026-11-08"], 2, "2026-10-20", "2026-10-25")).toEqual({ from: "2026-10-20", until: "2026-10-25" });
  });
});

describe("which machine to send", () => {
  const help = {
    id: "kisan-3f9c2a",
    farmLocation: { lat: 30.266, lon: 76.04 },
    machineType: "Happy Seeder",
    requiredFrom: "2026-10-20T00:00:00+05:30",
    requiredUntil: "2026-11-09T00:00:00+05:30",
    uncoveredAcres: 1.5,
    status: "OPEN",
  };

  it("the one that can come soonest, from the demo CHC seed: CHC C's two Happy Seeders, 25 km away, from 20 October", () => {
    // CHC A (2 km) and CHC B (6 km) have their one Happy Seeder booked until 8 November.
    const rec = recommendMachine(help, new Date("2026-10-09T09:00:00+05:30"))!;
    expect(rec.machine).toMatchObject({ id: "demo-chc-c:happy_seeder", chcName: "Demo CHC C (25 km away)", machineType: "Happy Seeder", availableFrom: "2026-10-20T00:00:00+05:30", status: "AVAILABLE" });
    expect(rec.km).toBeCloseTo(25, 0);
  });

  it("never before today, and nothing when no machine of that type is free", () => {
    const late = recommendMachine(help, new Date("2026-11-09T09:00:00+05:30"))!;
    expect(late.machine.availableFrom).toBe("2026-11-09T00:00:00+05:30");
    expect(late.machine.chcId).toBe("demo-chc-a");
    expect(recommendMachine({ ...help, machineType: "Baler" }, new Date("2026-10-09T09:00:00+05:30"))).toBeNull();
  });
});
