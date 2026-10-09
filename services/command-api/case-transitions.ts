export interface CaseTransition {
  cedar: string;
  status: string;
}

const ACTIONS: Record<string, CaseTransition> = {
  APPROVE: { cedar: "assign", status: "ACTION_APPROVED" },
  CHANGE: { cedar: "assign", status: "ACTION_CHANGED" },
  REJECT: { cedar: "assign", status: "OPEN" },
  MARK_IN_FIELD: { cedar: "mark_in_field", status: "IN_FIELD" },
  RECORD_ACTION_TAKEN: { cedar: "record_action", status: "ACTION_TAKEN" },
  CLOSE: { cedar: "close", status: "CLOSED" },
};

export type TransitionResult =
  | { ok: true; transition: CaseTransition }
  | { ok: false; code: "invalid_action" | "case_closed" };

/** Resolve a requested transition while making CLOSED a terminal state. */
export function resolveTransition(currentStatus: string, requestedAction: unknown): TransitionResult {
  const transition = typeof requestedAction === "string" ? ACTIONS[requestedAction] : undefined;
  if (!transition) return { ok: false, code: "invalid_action" };
  if (currentStatus === "CLOSED") return { ok: false, code: "case_closed" };
  return { ok: true, transition };
}
