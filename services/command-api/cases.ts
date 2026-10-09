import { commandConfig } from "./config";
import { pool, type Db } from "./deps";
import { authorizeResource } from "./avp";
import { resolveTransition } from "./case-transitions";
import { InMemoryIdempotencyStore, SmsSender } from "./sms";

interface Event {
  rawPath: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string;
  pathParameters?: { id?: string };
  requestContext: {
    http: { method: string };
    authorizer?: { lambda?: { district?: string; subject?: string } };
  };
}

const db: Db = pool(commandConfig());
const sender = new SmsSender({
  backend: process.env.SAANS_SMS_BACKEND === "aws" ? "aws" : "outbox",
  region: process.env.SAANS_SMS_REGION || process.env.AWS_REGION,
  originationIdentity: process.env.SAANS_SMS_SENDER_ID,
  entityId: process.env.SAANS_SMS_ENTITY_ID,
  templateIdAssignment: process.env.SAANS_SMS_TEMPLATE_ASSIGNMENT,
  templateIdActionTaken: process.env.SAANS_SMS_TEMPLATE_ACTION_TAKEN,
  dlqUrl: process.env.SAANS_DLQ_URL,
}, new InMemoryIdempotencyStore());

const response = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function bearer(event: Event) {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : "";
}

function district(event: Event) {
  return event.requestContext.authorizer?.lambda?.district ?? "";
}

async function allowed(event: Event, action: string, caseId: string, trustedDistrict: string) {
  const token = bearer(event);
  return !!token && authorizeResource(token, action, caseId, trustedDistrict);
}

export async function list(event: Event) {
  const scopedDistrict = district(event);
  if (!scopedDistrict || !(await allowed(event, "list", "district-scope", scopedDistrict))) return response(403, { error: { code: "forbidden" } });
  const params = new URLSearchParams(event.rawQueryString ?? "");
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 25) || 25));
  const status = params.get("status");
  const { rows } = await db.query(
    `SELECT id, complaint_id, type, district, ST_Y(location::geometry) AS lat,
            ST_X(location::geometry) AS lon, deadline, verification_status, status,
            help_request_id, evidence_summary, version, created_at, updated_at
       FROM cases
      WHERE district = $1 AND ($2::text IS NULL OR status = $2)
      ORDER BY deadline, id LIMIT $3`,
    [scopedDistrict, status, limit],
  );
  return response(200, { cases: rows, next_cursor: null });
}

async function loadCase(id: string) {
  const { rows } = await db.query<any>(
    `SELECT c.*, ST_Y(c.location::geometry) AS lat, ST_X(c.location::geometry) AS lon,
            h.body AS help_request, complaint.body AS complaint_body
       FROM cases c
       JOIN complaints complaint ON complaint.id = c.complaint_id
       LEFT JOIN help_requests h ON h.id = c.help_request_id WHERE c.id = $1`,
    [id],
  );
  return rows[0];
}

export async function detail(event: Event) {
  const id = event.pathParameters?.id ?? "";
  const row = await loadCase(id);
  if (!row) return response(404, { error: { code: "not_found" } });
  if (!(await allowed(event, "detail", id, row.district))) return response(403, { error: { code: "forbidden" } });
  return response(200, row);
}

export async function actions(event: Event) {
  const id = event.pathParameters?.id ?? "";
  const row = await loadCase(id);
  if (!row) return response(404, { error: { code: "not_found" } });
  let input: any;
  try { input = JSON.parse(event.body ?? "{}"); } catch { return response(400, { error: { code: "invalid_request" } }); }
  const resolved = resolveTransition(row.status, input.action);
  if (!resolved.ok) {
    const status = resolved.code === "case_closed" ? 409 : 400;
    return response(status, { error: { code: resolved.code } });
  }
  const mapping = resolved.transition;
  if (!(await allowed(event, mapping.cedar, id, row.district))) return response(403, { error: { code: "forbidden" } });
  const version = Number(input.previousCaseVersion);
  const updated = await db.query<any>(
    `UPDATE cases SET status = $1, version = version + 1, updated_at = now()
      WHERE id = $2 AND version = $3 RETURNING *`,
    [mapping.status, id, version],
  );
  if (!updated.rows[0]) return response(409, { error: { code: "version_conflict" } });

  const phone = String(row.complaint_body?.support_request?.farmer_phone ?? row.help_request?.farmer_phone ?? "");
  if (phone && (mapping.cedar === "assign" || mapping.cedar === "record_action")) {
    if (mapping.cedar === "assign") await sender.sendAssignment(phone, id, `case-assigned:${id}:v${version + 1}`);
    else await sender.sendActionTaken(phone, id, String(input.reason ?? input.action), `case-action:${id}:v${version + 1}`);
  }
  return response(200, updated.rows[0]);
}

export async function handler(event: Event) {
  if (event.requestContext.http.method === "GET" && event.rawPath === "/v1/cases") return list(event);
  if (event.requestContext.http.method === "GET") return detail(event);
  if (event.requestContext.http.method === "POST") return actions(event);
  return response(405, { error: { code: "method_not_allowed" } });
}
