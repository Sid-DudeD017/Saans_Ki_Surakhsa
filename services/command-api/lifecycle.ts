export type Role = "citizen" | "officer" | "supervisor" | "admin";
export type Status = 
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "AWAITING_INFORMATION"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED";

export interface TransitionContext {
  role: Role;
  hasResolutionSummary?: boolean;
}

export function canTransition(current: Status, next: Status, ctx: TransitionContext): boolean {
  // Citizen actions
  if (ctx.role === "citizen") {
    if (current === "RESOLVED" && next === "CLOSED") return true; // confirm
    if (current === "RESOLVED" && next === "REOPENED") return true; // reopen
    return false;
  }

  // Officer / Supervisor / Admin actions
  if (current === "SUBMITTED" && next === "UNDER_REVIEW") return true;
  if (current === "UNDER_REVIEW" && next === "ASSIGNED") return true;
  if (current === "ASSIGNED" && next === "IN_PROGRESS") return true;
  if (current === "IN_PROGRESS" && next === "AWAITING_INFORMATION") return true;
  if (current === "AWAITING_INFORMATION" && next === "IN_PROGRESS") return true;
  
  if (current === "IN_PROGRESS" && next === "RESOLVED") {
    // only an authorised officer may resolve (which includes supervisor/admin acting as officer)
    // must have a summary
    if (!ctx.hasResolutionSummary) return false;
    return true;
  }

  if (current === "REOPENED" && next === "UNDER_REVIEW") return true;

  return false;
}
