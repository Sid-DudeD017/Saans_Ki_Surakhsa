// The case API's rules on AWS: #26's Verified Permissions policy store (CasesPolicy in infra/template.yaml),
// asked through avp.ts's authorizeResource with the officer's own Cognito token and the district read from
// the database, never from the request. The store's vocabulary is #26's: lowercase districts and actions
// like "detail" and "assign". The local rules (saans.cedar) are finer; until P4 settles on one set, these
// are what the deployed API enforces, and the API itself still refuses changes to closed cases (409).
import { authorizeResource } from "./avp";
import { QUEUES, type CaseAuthz, type CaseVerb, type Officer } from "./caseAuthz";

/** Our verbs in #26's action names. ViewReporter has none: on AWS no one sees who reported. */
export const AVP_ACTION: Record<CaseVerb, string | null> = {
  ViewCase: "detail",
  ViewEvidence: "evidence",
  ViewReporter: null,
  Approve: "assign",
  Change: "assign",
  Reject: "assign",
  MarkInField: "mark_in_field",
  RecordActionTaken: "record_action",
  Close: "close",
};

type Check = typeof authorizeResource;

export function avpCaseAuthz(check: Check = authorizeResource): CaseAuthz {
  const ask = (officer: Officer, action: string, resourceId: string, district: string) =>
    officer.token ? check(officer.token, action, resourceId, district.toLowerCase()) : Promise.resolve(false);
  return {
    async may(officer, verb, c) {
      const action = AVP_ACTION[verb];
      return action ? ask(officer, action, c.id, c.district) : false;
    },
    async listable(officer) {
      const allowed = await Promise.all(QUEUES.map((d) => ask(officer, "list", `queue:${d}`, d)));
      return QUEUES.filter((_, i) => allowed[i]);
    },
  };
}
