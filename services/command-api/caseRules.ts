// What an officer can do to a case, and what each action does to its status (P4). Shared by the API
// (cases.ts) and the console's mock mode, so both follow the same rules.
export const CASE_STATUSES = ["OPEN", "ACTION_APPROVED", "ACTION_CHANGED", "CLOSED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export const ACTIONS = ["APPROVE", "CHANGE", "REJECT", "MARK_IN_FIELD", "RECORD_ACTION_TAKEN", "CLOSE"] as const;
export type CaseAction = (typeof ACTIONS)[number];

/**
 * What each action does to the case's status. APPROVE and CHANGE settle the recommendation; REJECT sends it
 * back to OPEN; field visits and action notes leave the status alone; CLOSE ends it.
 */
export function nextStatus(action: CaseAction, current: CaseStatus): CaseStatus {
  switch (action) {
    case "APPROVE":
      return "ACTION_APPROVED";
    case "CHANGE":
      return "ACTION_CHANGED";
    case "REJECT":
      return "OPEN";
    case "CLOSE":
      return "CLOSED";
    default:
      return current;
  }
}
