// Deadline escalation (P4, Stage 3): a case whose deadline passes before any officer has acted on it goes
// up to the district's Deputy Commissioner (infra/config/districts.json). On AWS a one-minute schedule
// runs this (template.yaml, EscalationFunction); on the local stack, a timer in http.ts. Running it twice
// escalates nothing twice: escalated_at is set once, in the same UPDATE that checks it is unset.
import { escalationFor } from "./config";
import type { IntakeDeps } from "./deps";

export const ESCALATION_OFFICER = "saans-escalation";

/** Escalates every overdue, untouched, open case; returns the ids it escalated. */
export async function escalateOverdue(deps: IntakeDeps): Promise<string[]> {
  const now = deps.now();
  const { rows } = await deps.db.query<{ id: string; district: string | null; version: number }>(
    `SELECT c.id, COALESCE(c.district, h.district) AS district, c.version
       FROM cases c LEFT JOIN help_requests h ON h.id = c.help_request_id
      WHERE c.deadline <= $1 AND c.escalated_at IS NULL AND c.status <> 'CLOSED'
        AND NOT EXISTS (SELECT 1 FROM case_decisions d WHERE d.case_id = c.id)
      ORDER BY c.deadline, c.id
      LIMIT 200`,
    [now],
  );
  const escalated: string[] = [];
  for (const r of rows) {
    const to = escalationFor(r.district);
    const { rowCount } = await deps.db.query(
      `UPDATE cases SET escalated_at = $2, escalated_to = $3, version = version + 1, updated_at = $2
        WHERE id = $1 AND version = $4 AND escalated_at IS NULL`,
      [r.id, now, to, r.version], // an officer who acted since the SELECT changed the version: leave it
    );
    if (!rowCount) continue;
    await deps.db.query(
      `INSERT INTO case_decisions (id, case_id, officer_id, action, reason, previous_case_version, created_at)
       VALUES ($1, $2, $3, 'ESCALATE', $4, $5, $6)`,
      [deps.newId("decision"), r.id, ESCALATION_OFFICER, `The deadline passed with no action; sent to ${to.join(", ")}.`, r.version, now],
    );
    escalated.push(r.id);
  }
  return escalated;
}
