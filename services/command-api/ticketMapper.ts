// import { type Case } from "./schema";

export type WireTicketStatus = 
  | "submitted"
  | "under_review"
  | "assigned"
  | "in_progress"
  | "awaiting_information"
  | "resolved"
  | "closed"
  | "reopened";

export function mapStatusToWire(dbStatus: string): WireTicketStatus {
  switch (dbStatus) {
    case "OPEN": return "submitted";
    case "UNDER_REVIEW": return "under_review";
    case "ACTION_APPROVED": return "assigned";
    case "IN_PROGRESS": return "in_progress";
    case "AWAITING_INFO": return "awaiting_information";
    case "RESOLVED": return "resolved";
    case "CLOSED": return "closed";
    case "REOPENED": return "reopened";
    default: return "submitted"; // Fallback
  }
}

export function mapStatusToDb(wireStatus: WireTicketStatus): string {
  switch (wireStatus) {
    case "submitted": return "OPEN";
    case "under_review": return "UNDER_REVIEW";
    case "assigned": return "ACTION_APPROVED";
    case "in_progress": return "IN_PROGRESS";
    case "awaiting_information": return "AWAITING_INFO";
    case "resolved": return "RESOLVED";
    case "closed": return "CLOSED";
    case "reopened": return "REOPENED";
    default: return "OPEN";
  }
}

export function mapCaseToTicket(c: any, isOfficer: boolean = false, currentUser?: string) {
  const base: any = {
    id: c.id,
    type: c.type,
    district: c.district,
    status: mapStatusToWire(c.status),
    created_at: c.created_at,
    updated_at: c.updated_at,
    reporter_consent: c.reporter_consent || false,
    public_notes: c.public_notes || [],
    evidence: c.evidence || []
  };

  if (c.resolution_summary) {
    base.resolution_summary = c.resolution_summary;
  }

  let showReporter = c.reporter_consent;
  if (isOfficer || (currentUser && currentUser === c.reporter_identity)) {
    showReporter = true;
  }
  base.reporter_identity = showReporter ? c.reporter_identity : null;

  if (isOfficer) {
    return {
      ...base,
      internal_notes: c.internal_notes || [],
      threat_level: c.threat_level,
      threat_score: c.threat_score,
      threat_reasons: c.threat_reasons,
      automated_label: c.automated_label,
      override: c.override,
      help_request: c.help_request,
      // intentionally omitted duplicate_of to hide idempotency keys
    };
  }

  return base;
}
