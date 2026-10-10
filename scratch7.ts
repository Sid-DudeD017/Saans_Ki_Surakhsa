import { assessThreat } from "./services/command-api/threat.js";

function main() {
  console.log("=== Threat Assessment Sample Response ===");
  const input = {
    urgency: "high",
    violence: false,
    weapons: false,
    vulnerable_people: true,
    immediacy: true,
    location_flag: false,
    evidence_quality: "medium"
  };
  const threat = assessThreat(input);
  console.log(JSON.stringify(threat, null, 2));
}

main();
