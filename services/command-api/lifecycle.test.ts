import { describe, it, expect } from "vitest";
import { canTransition, type Status, type Role } from "./lifecycle";

const ALL_STATUSES: Status[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "AWAITING_INFORMATION",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
];

const ROLES: Role[] = ["citizen", "officer", "supervisor", "admin"];

describe("Lifecycle State Machine", () => {
  describe("Citizen Transitions", () => {
    it("allows RESOLVED -> CLOSED (confirm)", () => {
      expect(canTransition("RESOLVED", "CLOSED", { role: "citizen" })).toBe(true);
    });

    it("allows RESOLVED -> REOPENED (reopen)", () => {
      expect(canTransition("RESOLVED", "REOPENED", { role: "citizen" })).toBe(true);
    });

    it("forbids any other transition for citizen", () => {
      for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
          if (from === "RESOLVED" && (to === "CLOSED" || to === "REOPENED")) continue;
          expect(canTransition(from, to, { role: "citizen" })).toBe(false);
        }
      }
    });
  });

  describe("Officer Transitions", () => {
    const officerCtx = { role: "officer" as const };

    const allowed = [
      ["SUBMITTED", "UNDER_REVIEW"],
      ["UNDER_REVIEW", "ASSIGNED"],
      ["ASSIGNED", "IN_PROGRESS"],
      ["IN_PROGRESS", "AWAITING_INFORMATION"],
      ["AWAITING_INFORMATION", "IN_PROGRESS"],
      ["REOPENED", "UNDER_REVIEW"],
    ];

    it("allows standard progression", () => {
      for (const [from, to] of allowed) {
        expect(canTransition(from as Status, to as Status, officerCtx)).toBe(true);
      }
    });

    it("allows IN_PROGRESS -> RESOLVED only with resolution summary", () => {
      expect(canTransition("IN_PROGRESS", "RESOLVED", { role: "officer", hasResolutionSummary: true })).toBe(true);
      expect(canTransition("IN_PROGRESS", "RESOLVED", { role: "officer", hasResolutionSummary: false })).toBe(false);
      expect(canTransition("IN_PROGRESS", "RESOLVED", { role: "officer" })).toBe(false);
    });

    it("forbids officer from closing or reopening directly", () => {
      expect(canTransition("RESOLVED", "CLOSED", officerCtx)).toBe(false);
      expect(canTransition("RESOLVED", "REOPENED", officerCtx)).toBe(false);
    });
    
    it("forbids all other transitions", () => {
      for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
          if (from === "IN_PROGRESS" && to === "RESOLVED") continue;
          if (allowed.some(([f, t]) => f === from && t === to)) continue;
          expect(canTransition(from, to, officerCtx)).toBe(false);
        }
      }
    });
  });
});
