// The Cedar policy tests (P4, Stage 4): infra/policies/saans.cedar against saans.cedarschema, with the
// local demo officers. Every officer action has an allow and a deny case; other-district officers are refused.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as cedar from "@cedar-policy/cedar-wasm/nodejs";
import { describe, expect, it } from "vitest";

import { ACTIONS } from "./caseRules";
import { LOCAL_OFFICERS, VERB_FOR, listable, mayList, mayOnCase, officerFrom, type CaseFacts, type Officer } from "./authz";

const officer = (id: string) => LOCAL_OFFICERS.find((o) => o.id === id)!;
const sdmSangrur = officer("officer-sangrur");
const fieldSangrur = officer("field-sangrur");
const sdmPatiala = officer("officer-patiala");
const state = officer("state-command");

const sangrurFire: CaseFacts = { id: "case-1", district: "Sangrur", status: "OPEN", type: "farm_fire", hasHelpRequest: true, reporterConsent: false, reporterId: "other-citizen" };
const patialaGarbage: CaseFacts = { id: "case-2", district: "Patiala", status: "OPEN", type: "garbage", hasHelpRequest: false, reporterConsent: false, reporterId: "other-citizen" };
const supervisorQueue: CaseFacts = { id: "case-3", district: "supervisor_queue", status: "OPEN", type: "farm_fire", hasHelpRequest: false, reporterConsent: false, reporterId: "" };
const citizenOwnCase: CaseFacts = { id: "case-4", district: "Sangrur", status: "OPEN", type: "garbage", hasHelpRequest: false, reporterConsent: false, reporterId: "citizen-1" };

describe("Cedar policies (infra/policies/saans.cedar)", () => {
  it("00 the policies validate against the schema", () => {
    const answer = cedar.validate({
      schema: readFileSync(join(process.cwd(), "infra/policies/saans.cedarschema"), "utf8"),
      policies: { staticPolicies: readFileSync(join(process.cwd(), "infra/policies/saans.cedar"), "utf8") },
      validationSettings: { mode: "strict" },
    });
    expect(answer.type).toBe("success");
    if (answer.type === "success") expect(answer.validationErrors).toEqual([]);
  });

  it("01 a Sangrur officer views a Sangrur case", () => expect(mayOnCase(sdmSangrur, "ViewCase", sangrurFire)).toBe(true));
  it("02 a Patiala officer can't view a Sangrur case", () => expect(mayOnCase(sdmPatiala, "ViewCase", sangrurFire)).toBe(false));
  it("03 a Sangrur officer can't view a Patiala case", () => expect(mayOnCase(sdmSangrur, "ViewCase", patialaGarbage)).toBe(false));
  it("04 a Sangrur officer sends the machine for a Sangrur fire", () => expect(mayOnCase(sdmSangrur, "Approve", sangrurFire)).toBe(true));
  it("05 a Patiala officer can't send a machine in Sangrur", () => expect(mayOnCase(sdmPatiala, "Approve", sangrurFire)).toBe(false));
  it("06 a Sangrur officer sends a different machine", () => expect(mayOnCase(sdmSangrur, "Change", sangrurFire)).toBe(true));
  it("07 a Sangrur officer rejects the recommendation", () => expect(mayOnCase(sdmSangrur, "Reject", sangrurFire)).toBe(true));
  it("08 a Patiala officer can't reject in Sangrur", () => expect(mayOnCase(sdmPatiala, "Reject", sangrurFire)).toBe(false));
  it("09 no machine can be sent where no farmer asked for one", () => {
    const own = { ...patialaGarbage };
    expect(mayOnCase(sdmPatiala, "Approve", own)).toBe(false);
    expect(mayOnCase(sdmPatiala, "Change", own)).toBe(false);
    expect(mayOnCase(sdmPatiala, "Reject", own)).toBe(false);
  });
  it("10 a field officer marks themselves in the field in their district", () => expect(mayOnCase(fieldSangrur, "MarkInField", sangrurFire)).toBe(true));
  it("11 a field officer records the action taken", () => expect(mayOnCase(fieldSangrur, "RecordActionTaken", sangrurFire)).toBe(true));
  it("12 a field officer can't send a machine", () => expect(mayOnCase(fieldSangrur, "Approve", sangrurFire)).toBe(false));
  it("13 a field officer can't close a case", () => expect(mayOnCase(fieldSangrur, "Close", sangrurFire)).toBe(false));
  it("14 a field officer can't act in another district", () => expect(mayOnCase(fieldSangrur, "MarkInField", patialaGarbage)).toBe(false));
  it("15 a Sangrur officer closes a Sangrur case", () => expect(mayOnCase(sdmSangrur, "Close", sangrurFire)).toBe(true));
  it("16 a Patiala officer can't close a Sangrur case", () => expect(mayOnCase(sdmPatiala, "Close", sangrurFire)).toBe(false));
  it("17 a closed case can be read but not changed, by anyone", () => {
    const closed = { ...sangrurFire, status: "CLOSED" };
    expect(mayOnCase(sdmSangrur, "ViewCase", closed)).toBe(true);
    for (const a of ACTIONS) expect(mayOnCase(sdmSangrur, VERB_FOR[a], closed), a).toBe(false);
    expect(mayOnCase(state, "Close", { ...supervisorQueue, status: "CLOSED" })).toBe(false);
  });
  it("18 the supervisor views every district and internal notes", () => {
    expect(mayOnCase(state, "ViewCase", sangrurFire)).toBe(true);
    expect(mayOnCase(state, "ViewEvidence", patialaGarbage)).toBe(true);
    expect(mayOnCase(state, "ViewInternalNotes", sangrurFire)).toBe(true);
  });
  it("19 the supervisor can't decide a district's case", () => {
    expect(mayOnCase(state, "Approve", sangrurFire)).toBe(false);
    expect(mayOnCase(state, "Close", patialaGarbage)).toBe(false);
  });
  it("20 the supervisor decides reports in the supervisor queue", () => {
    expect(mayOnCase(state, "MarkInField", supervisorQueue)).toBe(true);
    expect(mayOnCase(state, "Close", supervisorQueue)).toBe(true);
  });
  it("21 district officers can't see reports in the supervisor queue", () => {
    expect(mayOnCase(sdmSangrur, "ViewCase", supervisorQueue)).toBe(false);
    expect(mayOnCase(sdmPatiala, "ViewCase", supervisorQueue)).toBe(false);
  });
  it("22 a Patiala officer can't see a Sangrur case's evidence", () => expect(mayOnCase(sdmPatiala, "ViewEvidence", sangrurFire)).toBe(false));
  it("23 who reported is hidden unless the reporter agreed", () => {
    expect(mayOnCase(sdmSangrur, "ViewReporter", sangrurFire)).toBe(false);
    expect(mayOnCase(sdmSangrur, "ViewReporter", { ...sangrurFire, reporterConsent: true })).toBe(true);
  });
  it("24 even with consent, only the district officer sees who reported", () => {
    const consented = { ...sangrurFire, reporterConsent: true };
    expect(mayOnCase(fieldSangrur, "ViewReporter", consented)).toBe(false);
    expect(mayOnCase(sdmPatiala, "ViewReporter", consented)).toBe(false);
    expect(mayOnCase(state, "ViewReporter", consented)).toBe(false);
  });
  it("25 officers list only their own district's queue; the supervisor lists all", () => {
    expect(listable(sdmSangrur)).toEqual(["Sangrur"]);
    expect(listable(fieldSangrur)).toEqual(["Sangrur"]);
    expect(listable(sdmPatiala)).toEqual(["Patiala"]);
    expect(listable(state)).toEqual(["Sangrur", "Patiala", "supervisor_queue"]);
    expect(mayList(sdmPatiala, "Sangrur")).toBe(false);
  });
  it("26 an unknown role is refused everything", () => {
    const visitor: Officer = { id: "visitor", name: "Visitor", role: "public", district: "Sangrur" };
    expect(mayOnCase(visitor, "ViewCase", sangrurFire)).toBe(false);
    expect(mayList(visitor, "Sangrur")).toBe(false);
  });
  it("27 every officer action has an allow and a deny", () => {
    for (const a of ACTIONS) {
      expect(mayOnCase(sdmSangrur, VERB_FOR[a], sangrurFire), `${a} allowed`).toBe(true);
      expect(mayOnCase(sdmPatiala, VERB_FOR[a], sangrurFire), `${a} denied`).toBe(false);
    }
  });
  it("28 (a) a citizen sees only their own tickets, without internal notes", () => {
    const citizen = officer("citizen-1");
    // Can view own case
    expect(mayOnCase(citizen, "ViewCase", citizenOwnCase)).toBe(true);
    // Can view own evidence
    expect(mayOnCase(citizen, "ViewEvidence", citizenOwnCase)).toBe(true);
    // Can't view internal notes on own case
    expect(mayOnCase(citizen, "ViewInternalNotes", citizenOwnCase)).toBe(false);
    // Can't view another citizen's case
    expect(mayOnCase(citizen, "ViewCase", sangrurFire)).toBe(false);
  });
  it("29 admins manage configuration, not complaint content", () => {
    const admin = officer("admin-demo");
    expect(mayOnCase(admin, "ViewCase", sangrurFire)).toBe(false);
    expect(mayOnCase(admin, "Approve", sangrurFire)).toBe(false);
    expect(mayList(admin, "Sangrur")).toBe(false);
  });
});

describe("who is asking (local identities)", () => {
  const req = (auth?: string) => new Request("http://saans.test/v1/cases", { headers: auth ? { authorization: auth } : {} });
  it("a demo token names a demo officer", () => expect(officerFrom(req("Bearer local-officer-sangrur"))).toMatchObject({ id: "officer-sangrur", district: "Sangrur" }));
  it("no token, or one the local stack doesn't know, is nobody", () => {
    expect(officerFrom(req())).toBeNull();
    expect(officerFrom(req("Bearer not-a-token"))).toBeNull();
    expect(officerFrom(req("officer-sangrur"))).toBeNull();
  });
  it("local tokens stop working once Cognito is on", () => expect(officerFrom(req("Bearer local-officer-sangrur"), { SAANS_AUTH: "cognito" })).toBeNull());
});
