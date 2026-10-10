export interface ThreatInput {
  urgency?: boolean;
  violence?: boolean;
  weapons?: boolean;
  vulnerablePeople?: boolean;
  immediacy?: "past" | "imminent" | "ongoing";
  locationSensitive?: boolean;
  evidenceQuality?: "none" | "low" | "medium" | "high";
}

export type ThreatLevel = "low" | "medium" | "high" | "critical";

export interface ThreatAssessment {
  level: ThreatLevel;
  score: number;
  reasons: string[];
  automated_label: "automated recommendation only";
}

export function assessThreat(input: ThreatInput): ThreatAssessment {
  let score = 0;
  const reasons: string[] = [];

  if (input.violence) {
    score += 40;
    reasons.push("Violence reported");
  }
  if (input.weapons) {
    score += 40;
    reasons.push("Weapons present");
  }
  if (input.vulnerablePeople) {
    score += 20;
    reasons.push("Vulnerable people (children/elderly/disabled) present");
  }
  if (input.locationSensitive) {
    score += 15;
    reasons.push("Sensitive location (near school, hospital, or crowded place)");
  }
  if (input.urgency) {
    score += 10;
    reasons.push("Immediate intervention requested");
  }

  if (input.immediacy === "ongoing") {
    score += 20;
    reasons.push("Threat is ongoing");
  } else if (input.immediacy === "imminent") {
    score += 10;
    reasons.push("Threat is imminent");
  }

  if (input.evidenceQuality === "high") {
    score += 5;
    reasons.push("High quality evidence corroborates report");
  }

  let level: ThreatLevel = "low";

  if (score >= 80 || (input.violence && input.weapons)) {
    level = "critical";
  } else if (score >= 50 || input.urgency) {
    level = "high";
  } else if (score >= 20) {
    level = "medium";
  }

  return {
    level,
    score,
    reasons,
    automated_label: "automated recommendation only",
  };
}
