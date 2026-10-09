// The four steps of complaint-intake.asl.json, plus RecordFailure. Each takes the workflow's state and
// returns it with its own result added, and each is safe to run twice: a retry never adds a second row.
import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import { GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";

import { routeFor } from "../command-api/config";
import type { FireObservation, IntakeDeps } from "../command-api/deps";
import { metres } from "../command-api/firms";
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
  triage?: { authorities: string[]; deadlineHours: number; penalty: boolean; district: string | null; firms?: FirmsCheck };
  caseId?: string;
  /** Set when the report merged into an existing case instead of opening one. */
  duplicateOf?: string;
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

/** SatelliteObservation in p4-command.openapi.yaml, as stored on the case. */
export interface Observation {
  id: string;
  source: "NASA_FIRMS";
  observedAt: string;
  location: { lat: number; lon: number };
  confidence: number;
  frp: number;
  distanceFromReportMeters: number;
}

/** match: a FIRMS fire close by, shortly before; none: FIRMS answered with nothing; unavailable: couldn't ask. */
export interface FirmsCheck {
  result: "match" | "none" | "unavailable";
  observation?: Observation;
}

// VIIRS writes confidence as low / nominal / high; the contract's is a number.
const VIIRS_CONFIDENCE: Record<string, number> = { l: 30, low: 30, n: 60, nominal: 60, h: 90, high: 90 };

function observationOf(f: FireObservation, at: { lat: number; lon: number }): Observation {
  return {
    id: `firms-${f.satellite}-${f.acquisition_time.slice(0, 16)}-${f.lat.toFixed(4)},${f.lon.toFixed(4)}`,
    source: "NASA_FIRMS",
    observedAt: f.acquisition_time,
    location: { lat: f.lat, lon: f.lon },
    confidence: VIIRS_CONFIDENCE[f.confidence.trim().toLowerCase()] ?? (Number(f.confidence) || 0),
    frp: f.frp,
    distanceFromReportMeters: Math.round(metres(at, f)),
  };
}

/** A farm-fire report is corroborated by a FIRMS fire within firmsDistanceM, seen in the firmsHours before it. */
async function checkFirms(deps: IntakeDeps, at: { lat: number; lon: number }, reportedAt: Date): Promise<FirmsCheck> {
  if (!deps.fires) return { result: "unavailable" };
  const since = new Date(reportedAt.getTime() - deps.config.firmsHours * 3600_000);
  const until = new Date(reportedAt.getTime() + 3600_000); // a pass shortly after the report still counts
  const fires = await deps.fires(at, deps.config.firmsDistanceM, since, until);
  if (fires === null) return { result: "unavailable" };
  const near = fires.filter((f) => metres(at, f) <= deps.config.firmsDistanceM).sort((a, b) => metres(at, a) - metres(at, b))[0];
  return near ? { result: "match", observation: observationOf(near, at) } : { result: "none" };
}

/** The district whose outline (infra/config/districts.json, loaded by migrate) covers the report, or null. */
async function districtOf(deps: IntakeDeps, complaintId: string): Promise<string | null> {
  const { rows } = await deps.db.query<{ name: string }>(
    `SELECT d.name FROM complaints c JOIN districts d ON ST_Covers(d.boundary, c.location)
      WHERE c.id = $1 ORDER BY d.name LIMIT 1`,
    [complaintId],
  );
  return rows[0]?.name ?? null;
}

export async function triage(deps: IntakeDeps, input: IntakeState): Promise<IntakeState> {
  return guarded(async () => {
    const { type, complaint, received_at } = await load(deps, input.complaintId);
    const route = routeFor(type);
    // Kisan knows the farm's district; a citizen report gets the district whose outline covers it.
    const district = complaint.type === "farmer_support" ? complaint.help_request.district : await districtOf(deps, input.complaintId);
    const firms = complaint.type === "farm_fire" ? await checkFirms(deps, complaint.location, received_at) : undefined;
    return { ...input, triage: { ...route, district, ...(firms ? { firms } : {}) } };
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

export interface HelpLink {
  help_request_id: string;
  distance_m: number;
  /** Another open request within the tie tolerance of this distance: the officer should check which farm. */
  ambiguous: boolean;
  other_help_request_id?: string;
  district: string | null;
}

/**
 * Help before penalty: the open help request nearest a fire report, within helpRequestMaxDistanceM. Only
 * OPEN requests count; Kisan files MATCHED when the farmer's own plan covers every acre.
 */
export async function nearestOpenHelpRequest(deps: IntakeDeps, complaintId: string): Promise<HelpLink | null> {
  const { rows } = await deps.db.query<{ id: string; district: string | null; distance_m: number }>(
    `SELECT h.id, h.district, ST_Distance(h.location, c.location) AS distance_m
       FROM complaints c JOIN help_requests h ON ST_DWithin(h.location, c.location, $2)
      WHERE c.id = $1 AND h.status = 'OPEN'
      ORDER BY distance_m, h.created_at
      LIMIT 2`,
    [complaintId, deps.config.helpRequestMaxDistanceM],
  );
  const [near, next] = rows;
  if (!near) return null;
  const ambiguous = !!next && Number(next.distance_m) - Number(near.distance_m) <= deps.config.helpRequestTieToleranceM;
  return {
    help_request_id: near.id,
    distance_m: Math.round(Number(near.distance_m)),
    ambiguous,
    ...(ambiguous ? { other_help_request_id: next.id } : {}),
    district: near.district,
  };
}

/**
 * The open case this report repeats: same type, within dedupeDistanceM of the case's own report, and
 * received within dedupeHours of it. Farmer help requests never merge.
 */
async function sameIncident(deps: IntakeDeps, complaintId: string): Promise<{ case_id: string; distance_m: number } | null> {
  const { rows } = await deps.db.query<{ case_id: string; distance_m: number }>(
    `SELECT c.id AS case_id, ST_Distance(c.location, me.location) AS distance_m
       FROM complaints me
       JOIN cases c ON c.type = me.type AND c.status <> 'CLOSED' AND ST_DWithin(c.location, me.location, $2)
       JOIN complaints first ON first.id = c.complaint_id
      WHERE me.id = $1 AND first.id <> me.id
        AND first.received_at BETWEEN me.received_at - make_interval(secs => $3) AND me.received_at + make_interval(secs => $3)
      ORDER BY distance_m, first.received_at
      LIMIT 1`,
    [complaintId, deps.config.dedupeDistanceM, deps.config.dedupeHours * 3600],
  );
  return rows[0] ? { case_id: rows[0].case_id, distance_m: Number(rows[0].distance_m) } : null;
}

export async function assign(deps: IntakeDeps, input: IntakeState): Promise<IntakeState> {
  return guarded(async () => {
    const { complaint, received_at } = await load(deps, input.complaintId);
    const t = input.triage ?? (await triage(deps, input)).triage!;
    const evidence = input.evidence ?? { files: 0, matched: 0, mismatched: 0, missing: 0 };
    const needsReview = evidence.mismatched > 0 || evidence.missing > 0;
    const observation = t.firms?.result === "match" ? t.firms.observation! : null;

    // A retry finds what the first run did: this report's own case, or the case it merged into.
    const own = await deps.db.query<{ id: string }>("SELECT id FROM cases WHERE complaint_id = $1", [input.complaintId]);
    if (own.rows[0]) {
      await deps.db.query("UPDATE complaints SET status = 'assigned', updated_at = $2 WHERE id = $1", [input.complaintId, deps.now()]);
      return { ...input, caseId: own.rows[0].id };
    }
    const merged = await deps.db.query<{ case_id: string }>("SELECT case_id FROM case_reports WHERE complaint_id = $1", [input.complaintId]);
    if (merged.rows[0]) {
      await deps.db.query("UPDATE complaints SET status = 'duplicate', updated_at = $2 WHERE id = $1", [input.complaintId, deps.now()]);
      return { ...input, caseId: merged.rows[0].case_id, duplicateOf: merged.rows[0].case_id };
    }

    if (complaint.type !== "farmer_support") {
      const dup = await sameIncident(deps, input.complaintId);
      if (dup) {
        await deps.db.query(
          `INSERT INTO case_reports (complaint_id, case_id, distance_m, merged_at) VALUES ($1, $2, $3, $4) ON CONFLICT (complaint_id) DO NOTHING`,
          [input.complaintId, dup.case_id, dup.distance_m, deps.now()],
        );
        // A second report the satellite backs up corroborates the case it joins.
        await deps.db.query(
          `UPDATE cases SET updated_at = $2,
                  observation = CASE WHEN $3::jsonb IS NOT NULL AND verification_status IN ('UNVERIFIED', 'NO_MATCH') THEN $3::jsonb ELSE observation END,
                  verification_status = CASE WHEN $3::jsonb IS NOT NULL AND verification_status IN ('UNVERIFIED', 'NO_MATCH') THEN 'SATELLITE_CORROBORATED' ELSE verification_status END
            WHERE id = $1`,
          [dup.case_id, deps.now(), observation && JSON.stringify(observation)],
        );
        await deps.db.query("UPDATE complaints SET status = 'duplicate', updated_at = $2 WHERE id = $1", [input.complaintId, deps.now()]);
        return { ...input, caseId: dup.case_id, duplicateOf: dup.case_id };
      }
    }

    let helpRequestId: string | null = null;
    let helpLink: HelpLink | null = null;
    if (complaint.type === "farm_fire") {
      helpLink = await nearestOpenHelpRequest(deps, input.complaintId);
      helpRequestId = helpLink?.help_request_id ?? null;
    }
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

    // Tampered or missing evidence needs a person first; otherwise the satellite's answer, if it gave one.
    const verification = needsReview ? "NEEDS_REVIEW" : observation ? "SATELLITE_CORROBORATED" : t.firms?.result === "none" ? "NO_MATCH" : "UNVERIFIED";
    const deadlineMs = deps.config.deadlineMinutes ? deps.config.deadlineMinutes * 60_000 : t.deadlineHours * 3600_000;
    const deadline = new Date(received_at.getTime() + deadlineMs);
    await deps.db.query(
      `INSERT INTO cases (id, complaint_id, type, district, location, authorities, penalty, deadline,
                          verification_status, help_request_id, help_link, observation, evidence_summary, created_at, updated_at)
       SELECT $1, c.id, c.type, $3, c.location, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12
         FROM complaints c WHERE c.id = $2
       ON CONFLICT (complaint_id) DO NOTHING`,
      [deps.newId("case"), input.complaintId, t.district ?? helpLink?.district ?? null, t.authorities, t.penalty, deadline,
       verification, helpRequestId, helpLink && JSON.stringify(helpLink), observation && JSON.stringify(observation), summary(evidence), deps.now()],
    );
    const { rows } = await deps.db.query<{ id: string; district: string | null }>("SELECT id, district FROM cases WHERE complaint_id = $1", [input.complaintId]);
    await deps.db.query("UPDATE complaints SET status = 'assigned', updated_at = $2 WHERE id = $1", [input.complaintId, deps.now()]);
    // Keyed by case, so a retry of this step texts nobody twice.
    await deps.notify?.caseAssigned({ caseId: rows[0].id, district: rows[0].district });
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
