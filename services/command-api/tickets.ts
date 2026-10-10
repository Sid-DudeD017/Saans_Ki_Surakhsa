import { z } from "zod";
import type { Db } from "./deps";
import { mapCaseToTicket, mapStatusToDb, mapStatusToWire } from "./ticketMapper";
import { newId } from "./deps";

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
    "citizen_confirm", "citizen_reopen"
  ]),
  reason: z.string().optional(),
  summary: z.string().optional(), // Required for resolve
  status: z.string().optional(), // For update_status
  assignee: z.string().optional() // For reassign
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

  return { ticket: mapCaseToTicket(res.rows[0], false), status: 201 };
}

export async function getTicket(db: Db, id: string, isOfficer: boolean, user?: string) {
  const res = await db.query(`SELECT * FROM cases WHERE id = $1`, [id]);
  if (res.rows.length === 0) throw new TicketError("not_found", "Ticket not found");
  return mapCaseToTicket(res.rows[0], isOfficer, user);
}

export async function listTickets(db: Db, isOfficer: boolean, filters: { district?: string, status?: string }) {
  let query = `SELECT * FROM cases WHERE 1=1`;
  const params: any[] = [];
  if (filters.district) {
    params.push(filters.district);
    query += ` AND district = $${params.length}`;
  }
  if (filters.status) {
    params.push(mapStatusToDb(filters.status as any));
    query += ` AND status = $${params.length}`;
  }
  query += ` ORDER BY created_at DESC LIMIT 50`;
  const res = await db.query(query, params);
  return res.rows.map(r => mapCaseToTicket(r, isOfficer));
}

export async function applyTicketAction(db: Db, id: string, body: any, user: string, isOfficer: boolean) {
  const parsed = TicketActionSchema.parse(body);
  
  if (parsed.action === "resolve" && !parsed.summary) {
    throw new TicketError("invalid_request", "Resolution summary is required");
  }
  
  // Authorization rules
  const officerOnly = ["accept", "reassign", "update_status", "resolve"];
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
  const entryHash = newId("hash");
  await db.query(`
    INSERT INTO audit_log (ticket_id, actor, role, action, before_state, after_state, previous_hash, entry_hash)
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE((SELECT entry_hash FROM audit_log ORDER BY created_at DESC LIMIT 1), 'genesis'), $7)
  `, [
    id, user, isOfficer ? "officer" : "citizen", parsed.action, 
    before, after, entryHash
  ]);

  // Public vs internal notes & evidence
  let extraSql = "";
  let extraParams: any[] = [];
  if (parsed.action === "resolve") {
    extraSql = `, resolution_summary = $2`;
    extraParams = [parsed.summary];
  } else if (parsed.reason || parsed.summary) {
    const text = parsed.summary || parsed.reason;
    if (isOfficer && !["request_info"].includes(parsed.action)) {
       extraSql = `, internal_notes = coalesce(internal_notes, '[]'::jsonb) || $2::jsonb`;
       extraParams = [JSON.stringify([{ at: new Date().toISOString(), by: user, text }])];
    } else {
       extraSql = `, public_notes = coalesce(public_notes, '[]'::jsonb) || $2::jsonb`;
       extraParams = [JSON.stringify([{ at: new Date().toISOString(), by: user, text }])];
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

  return mapCaseToTicket(res.rows[0], isOfficer, user);
}

export async function getTicketHistory(db: Db, id: string) {
  const res = await db.query(`SELECT * FROM audit_log WHERE ticket_id = $1 ORDER BY created_at ASC`, [id]);
  return res.rows;
}
