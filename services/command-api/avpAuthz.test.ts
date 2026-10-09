// The case API's rules on AWS: our verbs in #26's Verified Permissions vocabulary, the officer's own token,
// and the district from the database, lowercased as #26's CasesPolicy spells it.
import { describe, expect, it } from "vitest";

import { AVP_ACTION, avpCaseAuthz } from "./avpAuthz";
import type { CaseFacts, Officer } from "./caseAuthz";

const sangrurCase: CaseFacts = { id: "case-1", district: "Sangrur", status: "OPEN", type: "farm_fire", hasHelpRequest: true, reporterConsent: true };
const officer: Officer = { id: "sub-1", name: "sub-1", role: "district_officer", district: "Sangrur", token: "tok" };

function fakeStore(allowedDistrict: string) {
  const calls: [string, string, string, string][] = [];
  const check = async (token: string, action: string, id: string, district: string) => {
    calls.push([token, action, id, district]);
    return district === allowedDistrict;
  };
  return { calls, rules: avpCaseAuthz(check) };
}

describe("avpCaseAuthz", () => {
  it("asks with the officer's token, #26's action name and the lowercased district", async () => {
    const { calls, rules } = fakeStore("sangrur");
    expect(await rules.may(officer, "Approve", sangrurCase)).toBe(true);
    expect(await rules.may(officer, "MarkInField", sangrurCase)).toBe(true);
    expect(calls).toEqual([["tok", "assign", "case-1", "sangrur"], ["tok", "mark_in_field", "case-1", "sangrur"]]);
  });

  it("refuses another district's case", async () => {
    const { rules } = fakeStore("patiala");
    expect(await rules.may(officer, "ViewCase", sangrurCase)).toBe(false);
  });

  it("never shows who reported, and asks nothing without a token", async () => {
    const { calls, rules } = fakeStore("sangrur");
    expect(await rules.may(officer, "ViewReporter", sangrurCase)).toBe(false);
    expect(await rules.may({ ...officer, token: undefined }, "ViewCase", sangrurCase)).toBe(false);
    expect(calls).toEqual([]);
  });

  it("lists only the queues the store allows", async () => {
    const { calls, rules } = fakeStore("patiala");
    expect(await rules.listable(officer)).toEqual(["Patiala"]);
    expect(calls.map((c) => [c[1], c[3]])).toEqual([["list", "sangrur"], ["list", "patiala"], ["list", "unassigned"]]);
  });

  it("maps every verb to an action #26's schema has, or to none", () => {
    const schemaActions = ["list", "counts", "map", "detail", "evidence", "assign", "mark_in_field", "record_action", "close"];
    for (const [verb, action] of Object.entries(AVP_ACTION)) if (action) expect(schemaActions, verb).toContain(action);
  });
});
