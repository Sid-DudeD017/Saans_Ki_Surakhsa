// The four steps of complaint-intake.asl.json, plus RecordFailure. Each takes the workflow's state and
// returns it with its own result added, and each is safe to run twice: a retry never adds a second row.
import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import { GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";

import { routeFor } from "../command-api/config";
import type { IntakeDeps } from "../command-api/deps";
import { parseComplaint, type Complaint, type EvidenceMetadata } from "../command-api/inputs";

/** An error Step Functions (and the local runner) retries: the database or S3 didn't answer. */
export class Transient extends Error {
  name = "Transient";
}

/** The stored complaint can't become a case; not retried. */
export class ComplaintInvalid extends Error {
  name = "ComplaintInvalid";
}

const TRANSIENT_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "57P01", "57P03", "40001", "40P01", "53300"]);

function isTransient(e: unknown) {
  const err = e as { code?: string; name?: string; $retryable?: unknown; $metadata?: { httpStatusCode?: number } };
  return (
    (err?.code !== undefined && TRANSIENT_CODES.has(err.code)) ||
    !!err?.$retryable ||
    (err?.$metadata?.httpStatusCode ?? 0) >= 500 ||
    /Connection terminated|timeout/i.test(String((e as Error)?.message))
  );
}

/** Runs a step, turning a database or S3 hiccup into Transient so it is retried. */
async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    if (e instanceof Transient || e instanceof ComplaintInvalid) throw e;
    if (isTransient(e)) throw new Transient((e as Error).message);
    throw e;
  }
}

export interface IntakeState extends Record<string, unknown> {
  complaintId: string;
  type?: string;
  evidence?: { files: number; matched: number; mismatched: number; missing: number };
  triage?: { authorities: string[]; deadlineHours: number; penalty: boolean; district: string | null };
  caseId?: string;
  error?: { Error: string; Cause: string };
}

async function load(deps: IntakeDeps, complaintId: string) {
  const { rows } = await deps.db.query<{ id: string; type: string; body: unknown; received_at: Date }>(
    "SELECT id, type, body, received_at FROM complaints WHERE id = $1",
    [complaintId],
  );
  if (!rows[0]) throw new ComplaintInvalid(`no complaint ${complaintId}`);
  const parsed = parseComplaint(rows[0].body);
  if (!parsed.success) throw new ComplaintInvalid(`complaint ${complaintId} no longer matches the contract: ${parsed.error.issues[0]?.message}`);
  return { ...rows[0], complaint: parsed.data as Complaint };
}

export async function validate(deps: IntakeDeps, input: IntakeState): Promise<IntakeState> {
  return guarded(async () => {
    const { type } = await load(deps, input.complaintId);
    await deps.db.query("UPDATE complaints SET status = 'validated', updated_at = $2 WHERE id = $1 AND status = 'received'", [
      input.complaintId,
      deps.now(),
    ]);
    return { ...input, type };
  });
}

async function sha256Of(body: Readable) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of body) {
    hash.update(chunk as Buffer);
    size += (chunk as Buffer).length;
  }
  return { hex: hash.digest("hex"), size };
}

type CheckResult = "match" | "mismatch" | "missing";

async function check(deps: IntakeDeps, e: EvidenceMetadata): Promise<{ result: CheckResult; hex: string | null; size: number | null }> {
  try {
    const object = await deps.s3.send(new GetObjectCommand({ Bucket: deps.config.evidenceBucket, Key: e.object_key }));
    const { hex, size } = await sha256Of(object.Body as Readable);
    return { result: hex === e.hash ? "match" : "mismatch", hex, size };
  } catch (err) {
    if (err instanceof NoSuchKey || (err as { name?: string }).name === "NoSuchKey") return { result: "missing", hex: null, size: null };
    throw err;
  }
}

export async function hashEvidence(deps: IntakeDeps, input: IntakeState): Promise<IntakeState> {
  return guarded(async () => {
    const { complaint } = await load(deps, input.complaintId);
    const counts = { files: complaint.evidence.length, matched: 0, mismatched: 0, missing: 0 };
    for (const e of complaint.evidence) {
      const { result, hex, size } = await check(deps, e);
      counts[result === "match" ? "matched" : result === "mismatch" ? "mismatched" : "missing"]++;
      await deps.db.query(
        `INSERT INTO evidence (complaint_id, object_key, media_type, claimed_hash, actual_hash, byte_size, check_result, captured_at, location, checked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                 CASE WHEN $9::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography END, $11)
         ON CONFLICT (complaint_id, object_key) DO UPDATE
           SET actual_hash = EXCLUDED.actual_hash, byte_size = EXCLUDED.byte_size,
               check_result = EXCLUDED.check_result, checked_at = EXCLUDED.checked_at`,
        [input.complaintId, e.object_key, e.media_type, e.hash, hex, size, result, e.captured_timestamp,
         e.location?.lon ?? null, e.location?.lat ?? null, deps.now()],
      );
    }
    return { ...input, evidence: counts };
  });
}

export async function triage(deps: IntakeDeps, input: IntakeState): Promise<IntakeState> {
  return guarded(async () => {
    const { type, complaint } = await load(deps, input.complaintId);
    const route = routeFor(type);
    // Kisan knows the farm's district. A citizen report gets its district from the PostGIS boundary
    // lookup (Stage 3); until then it has none and the officer queue shows it unscoped.
    const district = complaint.type === "farmer_support" ? complaint.help_request.district : null;
    return { ...input, triage: { ...route, district } };
  });
}

function summary(e: NonNullable<IntakeState["evidence"]>) {
  if (!e.files) return "No files attached";
  const parts = [
    e.matched && `${e.matched} match${e.matched === 1 ? "es" : ""} its upload hash`,
    e.mismatched && `${e.mismatched} doesn't match its hash`,
    e.missing && `${e.missing} never uploaded`,
  ].filter(Boolean);
  return `${e.files} file${e.files === 1 ? "" : "s"}: ${parts.join(", ")}`;
}

export async function assign(deps: IntakeDeps, input: IntakeState): Promise<IntakeState> {
  return guarded(async () => {
    const { complaint, received_at } = await load(deps, input.complaintId);
    const t = input.triage ?? (await triage(deps, input)).triage!;
    const evidence = input.evidence ?? { files: 0, matched: 0, mismatched: 0, missing: 0 };
    const needsReview = evidence.mismatched > 0 || evidence.missing > 0;

    let helpRequestId: string | null = null;
    if (complaint.type === "farmer_support") {
      const help = complaint.help_request;
      helpRequestId = help.id;
      await deps.db.query(
        `INSERT INTO help_requests (id, complaint_id, district, location, status, body, created_at)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [help.id, input.complaintId, help.district, help.farmLocation.lon, help.farmLocation.lat, help.status, JSON.stringify(help), deps.now()],
      );
    }

    const deadline = new Date(received_at.getTime() + t.deadlineHours * 3600_000);
    await deps.db.query(
      `INSERT INTO cases (id, complaint_id, type, district, location, authorities, penalty, deadline,
                          verification_status, help_request_id, evidence_summary, created_at, updated_at)
       SELECT $1, c.id, c.type, $3, c.location, $4, $5, $6, $7, $8, $9, $10, $10
         FROM complaints c WHERE c.id = $2
       ON CONFLICT (complaint_id) DO NOTHING`,
      [deps.newId("case"), input.complaintId, t.district, t.authorities, t.penalty, deadline,
       needsReview ? "NEEDS_REVIEW" : "UNVERIFIED", helpRequestId, summary(evidence), deps.now()],
    );
    const { rows } = await deps.db.query<{ id: string }>("SELECT id FROM cases WHERE complaint_id = $1", [input.complaintId]);
    await deps.db.query("UPDATE complaints SET status = 'assigned', updated_at = $2 WHERE id = $1", [input.complaintId, deps.now()]);
    const phone = complaint.type === "farmer_support"
      ? String((complaint.support_request as { farmer_phone?: unknown }).farmer_phone ?? "")
      : "";
    if (phone && deps.notifications) {
      await deps.notifications.sendAssignment(phone, rows[0].id, `case-assigned:${rows[0].id}`);
    }
    return { ...input, caseId: rows[0].id };
  });
}

export async function recordFailure(deps: IntakeDeps, input: IntakeState): Promise<IntakeState> {
  await deps.db.query("UPDATE complaints SET status = 'failed', failure = $2, updated_at = $3 WHERE id = $1", [
    input.complaintId,
    JSON.stringify(input.error ?? { Error: "Unknown", Cause: "" }),
    deps.now(),
  ]);
  return input;
}

export const STEPS = { Validate: validate, HashEvidence: hashEvidence, Triage: triage, Assign: assign, RecordFailure: recordFailure };
