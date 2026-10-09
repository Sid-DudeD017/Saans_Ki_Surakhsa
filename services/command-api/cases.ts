// The officer's side of Saans Command (P4): the case queue, one case with its report and the farmer's open
// help request (shown before any penalty), and the actions an officer takes. Shapes are
// p4-command.openapi.yaml's CaseList, CaseDetail, CommandCase and CaseActionInput. Every call is for a
// signed-in officer, and deps.authz decides what they may see and do: their own district only (Cedar
// in-process locally, Verified Permissions on AWS; see caseAuthz.ts).
import { z } from "zod";

import chcSeed from "../../data/seed/chc_demo.json";
import { VERB_FOR, type CaseAuthz, type CaseFacts, type Officer } from "./caseAuthz";
import type { IntakeDeps } from "./deps";
import { errorResponse, invalid, zodDetails } from "./errors";
import { indiaTime } from "./time";

import { ACTIONS, CASE_STATUSES, nextStatus, type CaseStatus } from "./caseRules";

export { ACTIONS, CASE_STATUSES, nextStatus } from "./caseRules";

interface CaseRow {
  id: string;
  complaint_id: string;
  type: string;
  district: string | null;
  lat: number;
  lon: number;
  authorities: string[];
  penalty: boolean;
  deadline: Date;
  verification_status: string;
  status: CaseStatus;
  help_request_id: string | null;
  help_link: { distance_m: number; ambiguous: boolean; other_help_request_id?: string } | null;
  observation: (Record<string, unknown> & { id: string }) | null;
  escalated_at: Date | null;
  escalated_to: string[] | null;
  reports: number;
  evidence_summary: string;
  version: number;
  created_at: Date;
  updated_at: Date;
  help_body: HelpBody | null;
  help_district: string | null;
  complaint_body: { description?: string; reporter_id?: string; reporter_consent?: boolean } | null;
  received_at: Date;
}

interface HelpBody {
  id: string;
  farmLocation: { lat: number; lon: number };
  machineType: string;
  requiredFrom: string;
  requiredUntil: string;
  uncoveredAcres: number;
  status: string;
  [k: string]: unknown;
}

const CASE_SELECT = `
  SELECT c.id, c.complaint_id, c.type, c.district, ST_Y(c.location::geometry) AS lat, ST_X(c.location::geometry) AS lon,
         c.authorities, c.penalty, c.deadline, c.verification_status, c.status, c.help_request_id, c.help_link,
         c.observation, c.escalated_at, c.escalated_to,
         1 + (SELECT count(*) FROM case_reports r WHERE r.case_id = c.id)::int AS reports,
         c.evidence_summary, c.version, c.created_at, c.updated_at,
         h.body AS help_body, h.district AS help_district, k.body AS complaint_body, k.received_at
    FROM cases c
    JOIN complaints k ON k.id = c.complaint_id
    LEFT JOIN help_requests h ON h.id = c.help_request_id`;

/** The district triage found, else the linked farm's, else unassigned. */
const districtOf = (r: CaseRow) => r.district ?? r.help_district ?? "unassigned";
const DISTRICT_SQL = "COALESCE(c.district, h.district, 'unassigned')";

const factsOf = (r: CaseRow): CaseFacts => ({
  id: r.id,
  district: districtOf(r),
  status: r.status,
  type: r.type,
  hasHelpRequest: !!r.help_request_id,
  reporterConsent: r.complaint_body?.reporter_consent === true,
});

// Not "this case is in Patiala": a refusal says nothing about the case.
const forbidden = (what: string) => errorResponse(403, "forbidden", what);

function rulesOf(deps: IntakeDeps): CaseAuthz {
  if (!deps.authz) throw new Error("the case API has no authorization configured (deps.authz)");
  return deps.authz;
}

// ---- machines: the demo CHC seed Kisan also books from (data/seed/chc_demo.json) ----

interface Chc {
  id: string;
  name: string;
  district: string;
  lat: number;
  lon: number;
  machines: { type: string; units: number; booked: string[] }[];
}
const MACHINE_NAMES: Record<string, string> = { happy_seeder: "Happy Seeder", super_seeder: "Super Seeder", mulcher_rmb: "Mulcher + RMB Plough", baler: "Baler" };
// Imported, not read from disk, so a Lambda bundle carries it.
const loadChcs = (): Chc[] => (chcSeed as { chcs: Chc[] }).chcs;

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The first run of days in [from, until] when a unit of the machine is not booked, or null. */
export function freeWindow(booked: string[], units: number, from: string, until: string): { from: string; until: string } | null {
  const start = Date.parse(from.slice(0, 10));
  const end = Date.parse(until.slice(0, 10));
  const busy = (day: number) => booked.filter((b) => {
    const [a, z] = b.split("/").map((d) => Date.parse(d));
    return day >= a && day <= z;
  }).length >= units;
  let first: number | null = null;
  for (let d = start; d <= end; d += DAY) {
    if (!busy(d)) first ??= d;
    else if (first !== null) return { from: isoDay(first), until: isoDay(d - DAY) };
  }
  return first === null ? null : { from: isoDay(first), until: isoDay(end) };
}

export interface MachineAsset {
  id: string;
  chcId: string;
  chcName: string;
  location: { lat: number; lon: number };
  machineType: string;
  availableFrom: string;
  availableUntil: string;
  status: "AVAILABLE";
}

/**
 * The CHC machine of the type the farmer still needs that can come soonest inside their window (never
 * before today), the nearest of those. A fire is being reported, so the earliest free day beats distance.
 */
export function recommendMachine(help: HelpBody, now = new Date(), seed: Chc[] = loadChcs()): { machine: MachineAsset; km: number } | null {
  const wanted = Object.entries(MACHINE_NAMES).find(([, name]) => name === help.machineType)?.[0];
  const today = indiaTime(now).slice(0, 10);
  const from = help.requiredFrom.slice(0, 10) > today ? help.requiredFrom : today;
  const options = seed.flatMap((chc) =>
    chc.machines
      .filter((m) => !wanted || m.type === wanted)
      .map((m) => ({ chc, m, free: freeWindow(m.booked, m.units, from, help.requiredUntil), km: km(help.farmLocation, chc) })),
  );
  const best = options.filter((o) => o.free).sort((a, b) => a.free!.from.localeCompare(b.free!.from) || a.km - b.km)[0];
  if (!best || !best.free) return null;
  return {
    km: Math.round(best.km * 10) / 10,
    machine: {
      id: `${best.chc.id}:${best.m.type}`,
      chcId: best.chc.id,
      chcName: best.chc.name,
      location: { lat: best.chc.lat, lon: best.chc.lon },
      machineType: MACHINE_NAMES[best.m.type] ?? best.m.type,
      availableFrom: `${best.free.from}T00:00:00+05:30`,
      availableUntil: `${best.free.until}T00:00:00+05:30`,
      status: "AVAILABLE",
    },
  };
}

/** "40 m" under a kilometre, "1.2 km" above. */
export function distanceText(m: number) {
  const tens = Math.max(10, Math.round(m / 10) * 10);
  return tens < 1000 ? `${tens} m` : `${(m / 1000).toFixed(1)} km`;
}

function recommendation(r: CaseRow, now: Date) {
  if (!r.help_body) return null;
  const rec = recommendMachine(r.help_body, now);
  const lead = r.help_body.status === "OPEN" ? "Open help request" : `Help request (${r.help_body.status})`;
  const near = r.type === "farm_fire" && r.help_link ? `${distanceText(r.help_link.distance_m)} from the report. ` : "";
  const ambiguous = r.help_link?.ambiguous ? " Another open request is about as close: check which farm this is." : "";
  const acres = `${r.help_body.uncoveredAcres} acres still need a ${r.help_body.machineType}.`;
  return {
    machine: rec?.machine,
    reason: rec
      ? `${lead} ${near}${acres} ${rec.machine.machineType} free at ${rec.machine.chcName} (${rec.km} km) from ${rec.machine.availableFrom.slice(0, 10)}: send it before any penalty.${ambiguous}`
      : `${lead} ${near}${acres} No machine free in the farmer's window in the demo CHC seed.${ambiguous}`,
  };
}

function commandCase(r: CaseRow, now: Date) {
  const rec = recommendation(r, now);
  return {
    id: r.id,
    incidentReportId: r.complaint_id,
    verificationStatus: r.verification_status,
    ...(r.observation ? { observationId: r.observation.id } : {}),
    ...(r.help_request_id ? { helpRequestId: r.help_request_id } : {}),
    ...(rec?.machine ? { recommendedMachineId: rec.machine.id } : {}),
    evidenceSummary: r.evidence_summary,
    ...(rec ? { recommendationReason: rec.reason } : {}),
    status: r.status,
    version: r.version,
    createdAt: indiaTime(r.created_at),
    updatedAt: indiaTime(r.updated_at),
  };
}

function summary(r: CaseRow, now: Date) {
  return {
    case: commandCase(r, now),
    type: r.type,
    district: districtOf(r),
    location: { lat: Number(r.lat), lon: Number(r.lon) },
    deadline: indiaTime(r.deadline),
    hasHelpRequest: !!r.help_request_id,
    penalty: r.penalty,
    authorities: r.authorities,
    ...triageFields(r),
  };
}

/** Duplicates merged in, and escalation, for both the queue and the case. */
function triageFields(r: CaseRow) {
  return {
    reports: Number(r.reports),
    ...(r.escalated_at ? { escalatedAt: indiaTime(r.escalated_at), escalatedTo: r.escalated_to ?? [] } : {}),
  };
}

// ---- GET /v1/cases ----

const ListQuery = z.object({
  status: z.enum(CASE_STATUSES).optional(),
  district: z.string().min(1).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const encodeCursor = (r: CaseRow) => Buffer.from(JSON.stringify([r.deadline.toISOString(), r.id])).toString("base64url");
function decodeCursor(c: string): [string, string] | null {
  try {
    const v = JSON.parse(Buffer.from(c, "base64url").toString("utf8"));
    return Array.isArray(v) && v.length === 2 && !Number.isNaN(Date.parse(v[0])) && typeof v[1] === "string" ? [v[0], v[1]] : null;
  } catch {
    return null;
  }
}

/** The queue: nearest deadline first, then id, a page at a time; only the districts Cedar lets this officer list. */
export async function listCases(deps: IntakeDeps, url: URL, officer: Officer): Promise<Response> {
  const parsed = ListQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return invalid(zodDetails(parsed.error, "query"));
  const q = parsed.data;
  const after = q.cursor ? decodeCursor(q.cursor) : null;
  if (q.cursor && !after) return invalid([{ field: "query.cursor", problem: "is not a cursor from this queue" }]);
  const allowed = await rulesOf(deps).listable(officer);
  if (q.district && !allowed.includes(q.district)) return forbidden("you can't list that district's cases");

  const where: string[] = [];
  const values: unknown[] = [];
  where.push(`${DISTRICT_SQL} = ANY($${values.push(q.district ? [q.district] : allowed)})`);
  if (q.status) where.push(`c.status = $${values.push(q.status)}`);
  if (after) where.push(`(c.deadline, c.id) > ($${values.push(after[0])}::timestamptz, $${values.push(after[1])})`);
  const { rows } = await deps.db.query<CaseRow>(
    `${CASE_SELECT} WHERE ${where.join(" AND ")} ORDER BY c.deadline, c.id LIMIT $${values.push(q.limit + 1)}`,
    values,
  );
  const page = rows.slice(0, q.limit);
  return Response.json({ cases: page.map((r) => summary(r, deps.now())), next_cursor: rows.length > q.limit ? encodeCursor(page[page.length - 1]) : null });
}

// ---- GET /v1/cases/{id} ----

const notFound = (id: string) => Response.json({ error: { code: "not_found", message: `no case ${id}` } }, { status: 404 });

async function loadCase(deps: IntakeDeps, id: string) {
  const { rows } = await deps.db.query<CaseRow>(`${CASE_SELECT} WHERE c.id = $1`, [id]);
  return rows[0] ?? null;
}

async function decisions(deps: IntakeDeps, id: string) {
  const { rows } = await deps.db.query<{
    id: string; officer_id: string; action: string; selected_machine_id: string | null; reason: string; previous_case_version: number; created_at: Date;
  }>("SELECT * FROM case_decisions WHERE case_id = $1 ORDER BY created_at, id", [id]);
  return rows.map((d) => ({
    id: d.id,
    caseId: id,
    officerId: d.officer_id,
    action: d.action,
    ...(d.selected_machine_id ? { selectedMachineId: d.selected_machine_id } : {}),
    reason: d.reason,
    createdAt: indiaTime(d.created_at),
    previousCaseVersion: d.previous_case_version,
  }));
}

export async function getCase(deps: IntakeDeps, id: string, officer: Officer): Promise<Response> {
  const r = await loadCase(deps, id);
  if (!r) return notFound(id);
  const facts = factsOf(r);
  const rules = rulesOf(deps);
  if (!(await rules.may(officer, "ViewCase", facts))) return forbidden("you can't open this case");
  const showReporter = await rules.may(officer, "ViewReporter", facts);
  const rec = recommendation(r, deps.now());
  const help = r.help_body;
  const channel = r.type === "farmer_support" ? "kisan_saathi" : "anonymous";
  return Response.json({
    case: commandCase(r, deps.now()),
    type: r.type,
    penalty: r.penalty,
    authorities: r.authorities,
    deadline: indiaTime(r.deadline),
    ...triageFields(r),
    report: {
      id: r.complaint_id,
      reportedAt: indiaTime(r.received_at),
      reporterId: showReporter ? r.complaint_body?.reporter_id ?? channel : channel,
      location: { lat: Number(r.lat), lon: Number(r.lon) },
      description: r.complaint_body?.description ?? "",
      district: districtOf(r),
      status: r.status === "CLOSED" ? "CLOSED" : "OPEN",
    },
    ...(r.observation ? { observation: r.observation } : {}),
    ...(help ? { helpRequest: help } : {}),
    ...(r.help_link ? { helpLink: { distanceMeters: r.help_link.distance_m, ambiguous: r.help_link.ambiguous, ...(r.help_link.other_help_request_id ? { otherHelpRequestId: r.help_link.other_help_request_id } : {}) } } : {}),
    ...(rec?.machine ? { recommendedMachine: rec.machine } : {}),
    decisions: await decisions(deps, id),
  });
}

// ---- POST /v1/cases/{id}/actions ----

export const ActionInput = z.object({
  action: z.enum(ACTIONS),
  selectedMachineId: z.string().min(1).optional(),
  reason: z.string().trim().min(1),
  previousCaseVersion: z.number().int().min(1),
});

export async function actOnCase(deps: IntakeDeps, id: string, body: unknown, officer: Officer): Promise<Response> {
  const parsed = ActionInput.safeParse(body);
  if (!parsed.success) return invalid(zodDetails(parsed.error));
  const a = parsed.data;
  const current = await loadCase(deps, id);
  if (!current) return notFound(id);
  const facts = factsOf(current);
  const rules = rulesOf(deps);
  if (!(await rules.may(officer, "ViewCase", facts))) return forbidden("you can't open this case");
  if (current.status === "CLOSED") {
    return Response.json({ error: { code: "conflict", message: `case ${id} is closed` } }, { status: 409 });
  }
  if (!(await rules.may(officer, VERB_FOR[a.action], facts))) return forbidden("you can't take that action on this case");
  const status = nextStatus(a.action, current.status);
  const now = deps.now();
  // Only the officer who saw the latest version wins; the other gets 409 and reloads.
  const { rowCount } = await deps.db.query(
    "UPDATE cases SET status = $3, version = version + 1, updated_at = $4 WHERE id = $1 AND version = $2",
    [id, a.previousCaseVersion, status, now],
  );
  if (!rowCount) {
    const fresh = await loadCase(deps, id);
    return Response.json(
      { error: { code: "version_conflict", message: `the case is at version ${fresh?.version}; reload it and decide again` } },
      { status: 409 },
    );
  }
  const decisionId = deps.newId("decision");
  await deps.db.query(
    `INSERT INTO case_decisions (id, case_id, officer_id, action, selected_machine_id, reason, previous_case_version, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [decisionId, id, officer.id, a.action, a.selectedMachineId ?? null, a.reason, a.previousCaseVersion, now],
  );
  await deps.notify?.actionTaken({ caseId: id, district: facts.district, action: a.action, decisionId });
  // Sending a machine answers the farmer's help request.
  if ((a.action === "APPROVE" || a.action === "CHANGE") && current.help_request_id && current.help_body?.status === "OPEN") {
    await deps.db.query(
      `UPDATE help_requests SET status = 'MATCHED', body = jsonb_set(body, '{status}', '"MATCHED"') WHERE id = $1 AND status = 'OPEN'`,
      [current.help_request_id],
    );
  }
  const after = await loadCase(deps, id);
  return Response.json(commandCase(after!, deps.now()));
}
