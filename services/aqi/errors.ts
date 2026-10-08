// Every Saans error has one body, P4's ErrorEnvelope (packages/contracts/CONVENTIONS.md):
//   { "error": { "code": "invalid_request", "message": "...", "details": [{ "field", "problem" }] } }
import { NextResponse } from 'next/server';

export type ErrorCode = 'invalid_request' | 'no_coverage' | 'sources_unavailable';

export interface ErrorDetail {
  field: string;
  problem: string;
}

export function errorResponse(status: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}
