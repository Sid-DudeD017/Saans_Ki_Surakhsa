// Command's errors use the shared ErrorEnvelope (p4-command.openapi.yaml, CONVENTIONS.md):
//   { "error": { "code": "invalid_request", "message": "...", "details": [{ "field", "problem" }] } }
import type { ZodError } from "zod";

export type ErrorCode = "invalid_request" | "idempotency_conflict" | "unavailable";

export interface ErrorDetail {
  field: string;
  problem: string;
}

export function errorResponse(status: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
  return Response.json({ error: { code, message, ...(details?.length ? { details } : {}) } }, { status });
}

/** A zod failure as ErrorEnvelope details, fields named like `body.location.lat`. */
export function zodDetails(error: ZodError, prefix = "body"): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: [prefix, ...issue.path.map(String)].join("."),
    problem: issue.message,
  }));
}

export function invalid(details: ErrorDetail[]) {
  const first = details[0];
  return errorResponse(400, "invalid_request", first ? `${first.field}: ${first.problem}` : "invalid request", details);
}
