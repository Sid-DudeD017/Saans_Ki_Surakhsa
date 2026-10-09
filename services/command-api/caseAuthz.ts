// What the case API asks before showing or changing a case (P4), without saying how it's decided. Locally,
// authz.ts runs infra/policies/saans.cedar in-process (Cedar's wasm build); on AWS, avpAuthz.ts asks
// Amazon Verified Permissions (#26's policy store), since Lambda bundles can't carry the wasm file. Kept
// free of both so either can be bundled without the other.
import type { CaseAction } from "./caseRules";
import { DISTRICTS } from "./config";

export interface Officer {
  id: string;
  name: string;
  role: "district_officer" | "field_officer" | "state_admin" | string;
  district: string;
  /** The Cognito access token the officer signed in with (AWS only), for Verified Permissions. */
  token?: string;
}

/** What the rules know about a case. district is "unassigned" outside both demo districts. */
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

export interface CaseAuthz {
  /** May this officer do `verb` to this case? */
  may(officer: Officer, verb: CaseVerb, c: CaseFacts): Promise<boolean>;
  /** The queues (QUEUES) this officer may list, so counts and maps never include anyone else's cases. */
  listable(officer: Officer): Promise<string[]>;
}
