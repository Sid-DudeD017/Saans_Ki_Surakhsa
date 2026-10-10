// POST /v1/complaints: store a citizen's report or Kisan's farmer_support request once, then start the
// intake workflow (validate -> hash evidence -> triage -> assign) that turns it into a case.
//
// Idempotency: the Idempotency-Key is unique in the complaints table. The same key with the same body
// returns the first answer and adds nothing; the same key with a different body is a 409. If starting the
// workflow fails, the answer is a 503 and the client retries with the same key, which starts it again.
import { createHash } from "node:crypto";

import type { IntakeDeps } from "./deps";
import { errorResponse, invalid, zodDetails, type ErrorDetail } from "./errors";
import { parseComplaint, type Complaint } from "./inputs";

export interface ComplaintResponse {
  id: string;
  status: "received";
}

/** Same JSON, same hash: keys are sorted at every level, so field order doesn't matter. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function requestHash(body: unknown) {
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}

function checkKey(key: string | null): ErrorDetail[] {
  if (!key) return [{ field: "header.Idempotency-Key", problem: "required" }];
  if (key.length < 6 || key.length > 128) return [{ field: "header.Idempotency-Key", problem: "must be 6 to 128 characters" }];
  return [];
}

/** Every file a complaint cites must be one POST /v1/uploads handed out, with the same type and hash. */
async function checkEvidence(deps: IntakeDeps, complaint: Complaint): Promise<ErrorDetail[]> {
  if (!complaint.evidence.length) return [];
  const keys = complaint.evidence.map((e) => e.object_key);
  const { rows } = await deps.db.query<{ object_key: string; media_type: string; sha256: string }>(
    "SELECT object_key, media_type, sha256 FROM uploads WHERE object_key = ANY($1)",
    [keys],
  );
  const issued = new Map(rows.map((r) => [r.object_key, r]));
  const problems: ErrorDetail[] = [];
  complaint.evidence.forEach((e, i) => {
    const upload = issued.get(e.object_key);
    if (!upload) problems.push({ field: `body.evidence.${i}.object_key`, problem: "was not issued by POST /v1/uploads" });
    else if (upload.media_type !== e.media_type) problems.push({ field: `body.evidence.${i}.media_type`, problem: `must be ${upload.media_type}, as uploaded` });
    else if (upload.sha256 !== e.hash) problems.push({ field: `body.evidence.${i}.hash`, problem: "must be the sha256 given to POST /v1/uploads" });
  });
  if (new Set(keys).size !== keys.length) problems.push({ field: "body.evidence", problem: "cites the same file twice" });
  return problems;
}

async function start(deps: IntakeDeps, id: string) {
  try {
    await deps.startWorkflow(id);
    return null;
  } catch (error) {
    console.error(`complaint ${id}: workflow didn't start`, error);
    return errorResponse(503, "unavailable", "the complaint is saved but its processing didn't start; send it again with the same Idempotency-Key");
  }
}

export async function submitComplaint(deps: IntakeDeps, idempotencyKey: string | null, body: unknown): Promise<Response> {
  const keyProblems = checkKey(idempotencyKey);
  if (keyProblems.length) return invalid(keyProblems);
  const key = idempotencyKey as string;

  const parsed = parseComplaint(body);
  if (!parsed.success) return invalid(zodDetails(parsed.error));
  const complaint = parsed.data;
  const hash = requestHash(body);

  const replay = await replayed(deps, key, hash);
  if (replay) return replay;

  const evidenceProblems = await checkEvidence(deps, complaint);
  if (evidenceProblems.length) return invalid(evidenceProblems);

  const id = deps.newId("complaint");
  const { rows } = await deps.db.query<{ id: string }>(
    `INSERT INTO complaints (id, idempotency_key, request_hash, type, location, body, received_at, updated_at)
     VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8, $8)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [id, key, hash, complaint.type, complaint.location.lon, complaint.location.lat, JSON.stringify(complaint), deps.now()],
  );
  if (!rows.length) return (await replayed(deps, key, hash)) ?? errorResponse(503, "unavailable", "try again");

  const failed = await start(deps, id);
  if (failed) return failed;
  return Response.json({ id, status: "received" } satisfies ComplaintResponse, { status: 201 });
}

/** The answer to a key seen before: the first response, or a 409 if the body differs. */
async function replayed(deps: IntakeDeps, key: string, hash: string): Promise<Response | null> {
  const { rows } = await deps.db.query<{ id: string; request_hash: string; status: string }>(
    "SELECT id, request_hash, status FROM complaints WHERE idempotency_key = $1",
    [key],
  );
  const seen = rows[0];
  if (!seen) return null;
  if (seen.request_hash !== hash) {
    return errorResponse(409, "idempotency_conflict", "this Idempotency-Key was used with a different request");
  }
  if (seen.status === "received") {
    // The first attempt may have stopped before the workflow started; starting it again is safe.
    const failed = await start(deps, seen.id);
    if (failed) return failed;
  }
  return Response.json({ id: seen.id, status: "received" } satisfies ComplaintResponse, {
    status: 201,
    headers: { "Idempotent-Replayed": "true" },
  });
}

/**
 * GET /v1/complaints/{id}: Read-only status tracking.
 * Returns: received -> sent_to_officer -> merged or case_opened -> acted_on -> closed, and whether the case
 * was escalated for passing its deadline. Strips all officer names and reporter identities.
 */
export async function getComplaintStatus(deps: IntakeDeps, id: string): Promise<Response> {
  const { rows: complaints } = await deps.db.query<{
    id: string;
    type: string;
    body: Record<string, unknown>;
    status: string;
    received_at: Date;
    updated_at: Date;
  }>(
    "SELECT id, type, body, status, received_at, updated_at FROM complaints WHERE id = $1",
    [id],
  );
  const complaint = complaints[0];
  if (!complaint) {
    return errorResponse(404, "not_found", `no complaint ${id}`);
  }

  // Check if an associated case exists
  // Its own case, or the case it was merged into.
  const { rows: cases } = await deps.db.query<{
    id: string;
    status: string;
    updated_at: Date;
    escalated_at: Date | null;
  }>(
    `SELECT id, status, updated_at, escalated_at FROM cases WHERE complaint_id = $1
     UNION ALL
     SELECT c.id, 'MERGED', c.updated_at, c.escalated_at FROM case_reports r JOIN cases c ON c.id = r.case_id WHERE r.complaint_id = $1
     LIMIT 1`,
    [id],
  );
  const cCase = cases[0];

  let status: "received" | "sent_to_officer" | "case_opened" | "merged" | "acted_on" | "closed" = "received";
  let stage_label = "Report received";
  let explanation = "Your report has been received and is queued for verification.";

  if (cCase) {
    const caseStatus = (cCase.status || "").toUpperCase();
    if (caseStatus === "MERGED") {
      status = "merged";
      stage_label = "Merged with existing report";
      explanation = "Someone already reported this fire. Your report was added to it, which helps it get attention.";
    } else if (caseStatus === "CLOSED" || caseStatus === "RESOLVED") {
      status = "closed";
      stage_label = "Closed";
      explanation = "The case has been addressed and closed.";
    } else if (caseStatus === "ACTED_ON" || caseStatus === "ACTION_TAKEN") {
      status = "acted_on";
      stage_label = "Action taken";
      explanation = "Authorities have taken action at the site.";
    } else {
      status = "case_opened";
      stage_label = "Case opened";
      explanation = "A case has been opened and authorities have been notified.";
    }
  } else {
    if (complaint.status === "validated") {
      status = "sent_to_officer";
      stage_label = "Sent to officer";
      explanation = "Your report was verified and is being routed to the responsible department.";
    } else if (complaint.status === "assigned") {
      status = "case_opened";
      stage_label = "Case opened";
      explanation = "A case has been opened and authorities have been notified.";
    } else {
      status = "received";
      stage_label = "Report received";
      explanation = "Your report has been received and is queued for verification.";
    }
  }

  const body = (complaint.body ?? {}) as { description?: string; evidence?: unknown[] };

  return Response.json({
    id: complaint.id,
    status,
    stage_label,
    explanation,
    type: complaint.type,
    received_at: complaint.received_at.toISOString(),
    updated_at: (cCase?.updated_at ?? complaint.updated_at).toISOString(),
    // The deadline passed with no officer acting, so the case went up to the Deputy Commissioner
    // (escalation.ts). Only that it happened: who it went to stays inside Command.
    escalated: !!cCase?.escalated_at,
    description: typeof body.description === "string" ? body.description : undefined,
    evidence: Array.isArray(body.evidence) ? body.evidence : undefined,
  });
}

