// The local stack's case rules (P4, Stage 4): infra/policies/saans.cedar, checked against
// saans.cedarschema, run in-process; this file only turns officers and cases into Cedar entities.
// Identity: `Authorization: Bearer <token>` from infra/config/officers.local.json (non-production names,
// not secrets). On AWS, Cognito and the Lambda authorizer sign officers in and avpAuthz.ts decides.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as cedar from "@cedar-policy/cedar-wasm/nodejs";

import officers from "../../infra/config/officers.local.json";
import { QUEUES, type CaseAuthz, type CaseFacts, type CaseVerb, type Officer } from "./caseAuthz";

export { QUEUES, VERB_FOR, type CaseFacts, type CaseVerb, type Officer } from "./caseAuthz";

const read = (name: string) => readFileSync(join(process.cwd(), "infra/policies", name), "utf8");
let rules: { schema: string; policies: string } | null = null;
function loadRules() {
  rules ??= { schema: read("saans.cedarschema"), policies: read("saans.cedar") };
  return rules;
}

const officerEntity = (o: Officer): cedar.EntityJson => ({
  uid: { type: "Saans::Officer", id: o.id },
  attrs: { role: o.role, district: o.district },
  parents: [],
});

function decide(officer: Officer, action: string, resource: cedar.EntityJson): boolean {
  const { schema, policies } = loadRules();
  const answer = cedar.isAuthorized({
    principal: officerEntity(officer).uid,
    action: { type: "Saans::Action", id: action },
    resource: resource.uid,
    context: {},
    schema,
    validateRequest: true,
    policies: { staticPolicies: policies },
    entities: [officerEntity(officer), resource],
  });
  if (answer.type === "failure") throw new Error(`Cedar couldn't decide ${action}: ${answer.errors.map((e) => e.message).join("; ")}`);
  return answer.response.decision === "allow";
}

/** May this officer do `verb` to this case? */
export function mayOnCase(officer: Officer, verb: CaseVerb, c: CaseFacts): boolean {
  return decide(officer, verb, {
    uid: { type: "Saans::Case", id: c.id },
    attrs: { district: c.district, status: c.status, type: c.type, hasHelpRequest: c.hasHelpRequest, reporterConsent: c.reporterConsent },
    parents: [],
  });
}

/** May this officer list this district's queue? */
export function mayList(officer: Officer, district: string): boolean {
  return decide(officer, "ListCases", { uid: { type: "Saans::District", id: district }, attrs: { name: district }, parents: [] });
}

/** The queues this officer may list, so counts and maps never include anyone else's cases. */
export const listable = (officer: Officer) => QUEUES.filter((d) => mayList(officer, d));

/** The case API's rules on the local stack. */
export const localCedar: CaseAuthz = {
  may: async (officer, verb, c) => mayOnCase(officer, verb, c),
  listable: async (officer) => listable(officer),
};

// ---- identity ----

const LOCAL = new Map(officers.officers.map((o) => [o.token, { id: o.id, name: o.name, role: o.role, district: o.district }]));

export const LOCAL_OFFICERS: Officer[] = [...LOCAL.values()];

/** The officer a request is from, or null (no sign-in, or a token the local stack doesn't know). */
export function officerFrom(request: Request, env: Record<string, string | undefined> = process.env): Officer | null {
  if ((env.SAANS_AUTH ?? "local") !== "local") return null; // G7: Cognito claims from the Lambda authorizer
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  return (token && LOCAL.get(token)) || null;
}
