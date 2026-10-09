// Who is asking, and whether Cedar lets them (P4, Stage 4). The rules are infra/policies/saans.cedar,
// checked against saans.cedarschema; this file only turns officers and cases into Cedar entities.
// Identity: on the local stack, `Authorization: Bearer <token>` from infra/config/officers.local.json
// (non-production names, not secrets). At G7 the Lambda authorizer verifies Cognito's id token and passes
// the same role and district claims.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as cedar from "@cedar-policy/cedar-wasm/nodejs";

import officers from "../../infra/config/officers.local.json";
import type { CaseAction } from "./caseRules";
import { DISTRICTS } from "./config";

export interface Officer {
  id: string;
  name: string;
  role: "district_officer" | "field_officer" | "state_admin" | string;
  district: string;
}

/** What Cedar knows about a case. district is "unassigned" outside both demo districts. */
export interface CaseFacts {
  id: string;
  district: string;
  status: string;
  type: string;
  hasHelpRequest: boolean;
  reporterConsent: boolean;
}

export type CaseVerb = "ViewCase" | "ViewEvidence" | "ViewReporter" | "Approve" | "Change" | "Reject" | "MarkInField" | "RecordActionTaken" | "Close";

export const VERB_FOR: Record<CaseAction, CaseVerb> = {
  APPROVE: "Approve",
  CHANGE: "Change",
  REJECT: "Reject",
  MARK_IN_FIELD: "MarkInField",
  RECORD_ACTION_TAKEN: "RecordActionTaken",
  CLOSE: "Close",
};

/** Every queue an officer could list: the demo districts and the reports neither covers. */
export const QUEUES = [...DISTRICTS.map((d) => d.name), "unassigned"];

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

// ---- identity ----

const LOCAL = new Map(officers.officers.map((o) => [o.token, { id: o.id, name: o.name, role: o.role, district: o.district }]));

export const LOCAL_OFFICERS: Officer[] = [...LOCAL.values()];

/** The officer a request is from, or null (no sign-in, or a token the local stack doesn't know). */
export function officerFrom(request: Request, env: Record<string, string | undefined> = process.env): Officer | null {
  if ((env.SAANS_AUTH ?? "local") !== "local") return null; // G7: Cognito claims from the Lambda authorizer
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  return (token && LOCAL.get(token)) || null;
}
