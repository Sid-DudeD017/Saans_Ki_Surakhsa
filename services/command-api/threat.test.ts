import { describe, expect, it } from "vitest";
import { assessThreat } from "./threat";

describe("threat assessment", () => {
  it("defaults to low when no inputs are provided", () => {
    const result = assessThreat({});
    expect(result.level).toBe("low");
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
    expect(result.automated_label).toBe("automated recommendation only");
  });

  it("adds +40 for violence and +40 for weapons", () => {
    const result = assessThreat({ violence: true, weapons: true });
    expect(result.score).toBe(80);
    expect(result.level).toBe("critical");
    expect(result.reasons).toContain("Violence reported");
    expect(result.reasons).toContain("Weapons present");
  });

  it("never defaults to low if urgency is true", () => {
    const result = assessThreat({ urgency: true });
    expect(result.score).toBe(10); // urgency alone is 10, but level should be high
    expect(result.level).toBe("high");
  });

  it("calculates medium threat for vulnerable people and sensitive location", () => {
    const result = assessThreat({ vulnerablePeople: true, locationSensitive: true });
    expect(result.score).toBe(35); // 20 + 15
    expect(result.level).toBe("medium");
  });

  it("adds points for immediacy correctly", () => {
    expect(assessThreat({ immediacy: "ongoing" }).score).toBe(20);
    expect(assessThreat({ immediacy: "imminent" }).score).toBe(10);
    expect(assessThreat({ immediacy: "past" }).score).toBe(0);
  });

  it("factors in high quality evidence", () => {
    const result = assessThreat({ evidenceQuality: "high", locationSensitive: true });
    expect(result.score).toBe(20); // 15 + 5
    expect(result.level).toBe("medium");
  });

  it("boundary: just below medium (15)", () => {
    const result = assessThreat({ locationSensitive: true });
    expect(result.score).toBe(15);
    expect(result.level).toBe("low");
  });

  it("boundary: exactly medium (20)", () => {
    const result = assessThreat({ vulnerablePeople: true });
    expect(result.score).toBe(20);
    expect(result.level).toBe("medium");
  });

  it("boundary: exactly high (50)", () => {
    const result = assessThreat({ violence: true, urgency: true });
    expect(result.score).toBe(50);
    expect(result.level).toBe("high");
  });

  it("boundary: just below critical (75)", () => {
    const result = assessThreat({ violence: true, vulnerablePeople: true, locationSensitive: true });
    expect(result.score).toBe(75);
    expect(result.level).toBe("high");
  });

  it("boundary: exactly critical (80)", () => {
    const result = assessThreat({ violence: true, weapons: true });
    expect(result.score).toBe(80);
    expect(result.level).toBe("critical");
  });

  it("evaluates a complex critical scenario", () => {
    const result = assessThreat({
      urgency: true,
      violence: true,
      vulnerablePeople: true,
      locationSensitive: true,
      immediacy: "ongoing"
    });
    expect(result.score).toBe(10 + 40 + 20 + 15 + 20); // 105
    expect(result.level).toBe("critical");
  });

  it("evaluates a complex high scenario", () => {
    const result = assessThreat({
      weapons: true,
      immediacy: "imminent",
      evidenceQuality: "high"
    });
    expect(result.score).toBe(40 + 10 + 5); // 55
    expect(result.level).toBe("high");
  });

  it("guarantees no automatic action is recommended", () => {
    const result = assessThreat({ urgency: true, violence: true, weapons: true });
    expect(result.automated_label).toBe("automated recommendation only");
    
    // Explicitly check for absence of action triggers in the output
    expect("action" in result).toBe(false);
    expect("trigger" in result).toBe(false);
    expect("dispatch" in result).toBe(false);
  });
});
