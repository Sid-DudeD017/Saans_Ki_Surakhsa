import { z } from "zod";
import type { Db } from "./deps";
import { mapCaseToTicket, mapStatusToDb, mapStatusToWire } from "./ticketMapper";
import { newId } from "./deps";
import { createHash } from "crypto";

export class TicketError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "TicketError";
  }
}

export const CreateTicketSchema = z.object({
  type: z.enum(["farm_fire", "garbage", "vehicle", "firecrackers", "farmer_support"]),
  district: z.string(),
  reporter_identity: z.string().optional(),
  reporter_consent: z.boolean().default(false),
  idempotency_key: z.string().min(1),
});

export const TicketActionSchema = z.object({
  action: z.enum([
    "accept", "note", "request_info", "upload_evidence", 
    "reassign", "update_status", "resolve", 
    "citizen_confirm", "citizen_reopen", "override_threat"
  ]),
  reason: z.string().optional(),
  summary: z.string().optional(), // Required for resolve
  status: z.string().optional(), // For update_status
  assignee: z.string().optional(), // For reassign
  overrideThreatLevel: z.enum(["low", "medium", "high", "critical"]).optional()
});

export async function createTicket(db: Db, body: any) {
  const parsed = CreateTicketSchema.parse(body);
  const ticketId = newId("SAANS"); // Will format as SAANS-YYYYMMDD-XXXXXX

  // Idempotency check
  const existing = await db.query(
    `SELECT * FROM cases WHERE duplicate_of = $1 LIMIT 1`, 
    [parsed.idempotency_key]
  );
  if (existing.rows.length > 0) {
    return { ticket: mapCaseToTicket(existing.rows[0], false), status: 200 };
  }

  const res = await db.query(`
    INSERT INTO cases (id, type, district, status, reporter_identity, reporter_consent, duplicate_of, version)
    VALUES ($1, $2, $3, 'OPEN', $4, $5, $6, 1)
    RETURNING *
  `, [
    ticketId, parsed.type, parsed.district, parsed.reporter_identity || null, 
    parsed.reporter_consent, parsed.idempotency_key
  ]);

  await db.query(`
    INSERT INTO status_history (case_id, status, changed_by, reason)
    VALUES ($1, 'submitted', $2, 'ticket_created')
  `, [ticketId, parsed.reporter_identity || 'anonymous']);

  return { ticket: mapCaseToTicket(res.rows[0], false), status: 201 };
}

export async function getTicket(db: Db, id: string, isOfficer: boolean, user?: string) {
  const res = await db.query(`SELECT * FROM cases WHERE id = $1`, [id]);
  if (res.rows.length === 0) throw new TicketError("not_found", "Ticket not found");
  return mapCaseToTicket(res.rows[0], isOfficer, user);
}

export async function listTickets(db: Db, isOfficer: boolean, filters: { district?: string, status?: string, category?: string, cursor?: string, limit?: number }) {
  let query = `SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon FROM cases WHERE 1=1`;
  const params: any[] = [];
  
  if (filters.district) {
    params.push(filters.district);
    query += ` AND district = $${params.length}`;
  }
  if (filters.status) {
    params.push(mapStatusToDb(filters.status as any));
    query += ` AND status = $${params.length}`;
  }
  if (filters.category) {
    params.push(filters.category);
    query += ` AND type = $${params.length}`;
  }
  
  // Cursor pagination assumes [threat_score, created_at_iso, id]
  if (filters.cursor) {
    try {
      const v = JSON.parse(Buffer.from(filters.cursor, "base64url").toString("utf8"));
      if (Array.isArray(v) && v.length === 3) {
         params.push(v[0]);
         const scoreParam = params.length;
         params.push(v[1]);
         const tparam = params.length;
         params.push(v[2]);
         const idparam = params.length;
         query += ` AND (
           CASE threat_level WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END,
           created_at, 
           id
         ) < ($${scoreParam}, $${tparam}::timestamptz, $${idparam})`;
      }
    } catch (e) {
      // invalid cursor
    }
  }

  // Threat level mapping for ordering: critical=4, high=3, medium=2, low=1, null=0
  query += ` ORDER BY 
    CASE threat_level WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC, 
    created_at DESC, 
    id DESC 
  LIMIT $${params.push((filters.limit || 50) + 1)}`;

  const res = await db.query(query, params);
  const rows = res.rows;
  
  const limit = filters.limit || 50;
  const hasNext = rows.length > limit;
  const page = rows.slice(0, limit);
  
  let next_cursor = null;
  if (hasNext && page.length > 0) {
    const last = page[page.length - 1];
    const lastDate = last.created_at instanceof Date ? last.created_at : new Date(last.created_at as any);
    const score = last.threat_level === 'critical' ? 4 : last.threat_level === 'high' ? 3 : last.threat_level === 'medium' ? 2 : last.threat_level === 'low' ? 1 : 0;
    next_cursor = Buffer.from(JSON.stringify([score, lastDate.toISOString(), last.id])).toString("base64url");
  }

  // Calculate total count (ignoring pagination, but with the same filters)
  let countQuery = "SELECT COUNT(*) FROM cases WHERE 1=1";
  const countParams: any[] = [];
  if (filters.district) countQuery += ` AND district = $${countParams.push(filters.district)}`;
  if (filters.category) countQuery += ` AND type = $${countParams.push(filters.category)}`;
  if (filters.status) {
    countQuery += ` AND status = $${countParams.push(mapStatusToDb(filters.status as any))}`;
  }
  const countRes = await db.query(countQuery, countParams);
  const total = parseInt(String(countRes.rows[0].count), 10);

  return { tickets: page.map(r => mapCaseToTicket(r, isOfficer)), next_cursor, total };
}

export async function applyTicketAction(db: Db, id: string, body: any, user: string, isOfficer: boolean) {
  const parsed = TicketActionSchema.parse(body);
  
  if (parsed.action === "resolve" && !parsed.summary) {
    throw new TicketError("invalid_request", "Resolution summary is required");
  }
  if (parsed.action === "note" && !parsed.reason) {
    throw new TicketError("invalid_request", "Note text is required in reason field");
  }
  if (parsed.action === "override_threat" && (!parsed.overrideThreatLevel || !parsed.reason)) {
    throw new TicketError("invalid_request", "Override requires level and reason");
  }  
  // Authorization rules
  const officerOnly = ["accept", "reassign", "update_status", "resolve", "note", "request_info", "override_threat"];
  const citizenOnly = ["citizen_confirm", "citizen_reopen"];
  
  if (!isOfficer && officerOnly.includes(parsed.action)) {
    throw new TicketError("forbidden", `Action ${parsed.action} is restricted to officers`);
  }
  if (isOfficer && citizenOnly.includes(parsed.action)) {
    throw new TicketError("forbidden", `Action ${parsed.action} is restricted to citizens`);
  }

  const current = await db.query(`SELECT * FROM cases WHERE id = $1`, [id]);
  if (current.rows.length === 0) throw new TicketError("not_found", "Ticket not found");

  const row = current.rows[0];
  
  // Check state transitions (409)
  if (parsed.action === "citizen_confirm" && row.status !== "RESOLVED") {
     throw new TicketError("conflict", "Cannot confirm a ticket that is not resolved");
  }
  if (parsed.action === "citizen_reopen" && row.status !== "RESOLVED") {
     throw new TicketError("conflict", "Cannot reopen a ticket that is not resolved");
  }
  if (row.status === "OPEN" && parsed.action === "resolve") {
     throw new TicketError("conflict", "Cannot transition from submitted directly to resolved");
  }

  let nextStatus = row.status;
  
  // Mapping actions to status
  if (parsed.action === "accept") nextStatus = "IN_PROGRESS";
  else if (parsed.action === "request_info") nextStatus = "AWAITING_INFO";
  else if (parsed.action === "resolve") nextStatus = "RESOLVED";
  else if (parsed.action === "citizen_confirm") nextStatus = "CLOSED";
  else if (parsed.action === "citizen_reopen") nextStatus = "REOPENED";
  else if (parsed.action === "update_status" && parsed.status) {
    nextStatus = mapStatusToDb(parsed.status as any);
  }

  // Audit entry using wire codes
  const before = JSON.stringify({ status: mapStatusToWire(row.status as string) });
  const after = JSON.stringify({ status: mapStatusToWire(nextStatus as string) });
  
  const prevRes = await db.query(`SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1`);
  const previous_hash = prevRes.rows.length > 0 ? prevRes.rows[0].entry_hash : 'genesis';
  const timestamp = new Date().toISOString();

  const rawString = `${previous_hash}${user}${parsed.action}${id}${before}${after}${timestamp}`;
  const entryHash = createHash('sha256').update(rawString).digest('hex');

  await db.query(`
    INSERT INTO audit_log (ticket_id, actor, role, action, before_state, after_state, previous_hash, entry_hash, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    id, user, isOfficer ? "officer" : "citizen", parsed.action, 
    before, after, previous_hash, entryHash, timestamp
  ]);

  // Public vs internal notes & evidence
  let extraSql = "";
  let extraParams: any[] = [];
  if (parsed.action === "resolve") {
    extraSql = `, resolution_summary = $2`;
    extraParams = [parsed.summary];
  } else if (parsed.action === "override_threat") {
    if (!parsed.overrideThreatLevel || !parsed.reason) {
       throw new TicketError("invalid_request", "overrideThreatLevel and reason are required");
    }
    const overrideValue = { level: parsed.overrideThreatLevel, reason: parsed.reason, by: user, at: timestamp };
    extraSql = `, override = $2::jsonb, threat_level = $3`;
    extraParams = [JSON.stringify(overrideValue), parsed.overrideThreatLevel];
  } else if (parsed.reason || parsed.summary) {
    const text = parsed.summary || parsed.reason;
    if (isOfficer && !["request_info"].includes(parsed.action)) {
       extraSql = `, internal_notes = coalesce(internal_notes, '[]'::jsonb) || $2::jsonb`;
       extraParams = [JSON.stringify([{ at: timestamp, by: user, text }])];
    } else {
       extraSql = `, public_notes = coalesce(public_notes, '[]'::jsonb) || $2::jsonb`;
       extraParams = [JSON.stringify([{ at: timestamp, by: user, text }])];
    }
  } else if (parsed.action === "upload_evidence" && body.evidence) {
    extraSql = `, evidence = coalesce(evidence, '[]'::jsonb) || $2::jsonb`;
    extraParams = [JSON.stringify([body.evidence])];
  }

  const res = await db.query(`
    UPDATE cases 
    SET status = $1, version = version + 1, updated_at = now() ${extraSql}
    WHERE id = $${extraParams.length + 2}
    RETURNING *
  `, [nextStatus, ...extraParams, id]);

  if (row.status !== nextStatus) {
    await db.query(`
      INSERT INTO status_history (case_id, status, changed_by, reason)
      VALUES ($1, $2, $3, $4)
    `, [id, mapStatusToWire(String(nextStatus)), user, parsed.reason || parsed.summary || null]);
  }

  return mapCaseToTicket(res.rows[0], isOfficer, user);
}

export async function getTicketHistory(db: Db, id: string) {
  const res = await db.query(`SELECT created_at, status, changed_by, reason FROM status_history WHERE case_id = $1 ORDER BY created_at ASC`, [id]);
  return res.rows.map(r => ({
    ...r,
    status: mapStatusToWire(String(r.status))
  }));
}
