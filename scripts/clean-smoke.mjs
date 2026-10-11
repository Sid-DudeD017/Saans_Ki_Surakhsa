/**
 * scripts/clean-smoke.mjs
 *
 * Deletes rows created by smoke tests (tagged with 'smoke-%' or 'kisan-smoke-%')
 * from the database, preventing test pollution.
 * Respects FK order and never touches audit_log.
 */
import pg from 'pg';

const url = process.env.SAANS_DATABASE_URL || 'postgres://saans:saans@127.0.0.1:5433/saans';

async function main() {
  const pool = new pg.Pool({ connectionString: url });
  try {
    const whereComp = `idempotency_key LIKE 'smoke-%' OR idempotency_key LIKE 'kisan-smoke-%'`;
    const whereCases = `complaint_id IN (SELECT id FROM complaints WHERE ${whereComp}) OR help_request_id IN (SELECT id FROM help_requests WHERE id LIKE 'kisan-smoke-%')`;

    // 1. Decisions, notes, status history, case_reports
    await pool.query(`DELETE FROM case_decisions WHERE case_id IN (SELECT id FROM cases WHERE ${whereCases})`);
    await pool.query(`DELETE FROM ticket_notes WHERE case_id IN (SELECT id FROM cases WHERE ${whereCases})`);
    await pool.query(`DELETE FROM status_history WHERE case_id IN (SELECT id FROM cases WHERE ${whereCases})`);
    await pool.query(`DELETE FROM case_reports WHERE case_id IN (SELECT id FROM cases WHERE ${whereCases}) OR complaint_id IN (SELECT id FROM complaints WHERE ${whereComp})`);

    // 2. Cases
    await pool.query(`DELETE FROM cases WHERE ${whereCases}`);

    // 3. Help requests
    await pool.query(`DELETE FROM help_requests WHERE complaint_id IN (SELECT id FROM complaints WHERE ${whereComp}) OR id LIKE 'kisan-smoke-%'`);

    // 4. Evidence, consent_records, workflow_events
    await pool.query(`DELETE FROM evidence WHERE complaint_id IN (SELECT id FROM complaints WHERE ${whereComp})`);
    await pool.query(`DELETE FROM consent_records WHERE complaint_id IN (SELECT id FROM complaints WHERE ${whereComp})`);
    await pool.query(`DELETE FROM workflow_events WHERE complaint_id IN (SELECT id FROM complaints WHERE ${whereComp})`);

    // 5. Complaints
    await pool.query(`DELETE FROM complaints WHERE ${whereComp}`);

    // 6. Notifications sent
    await pool.query(`DELETE FROM notifications_sent WHERE key LIKE 'smoke-%' OR key LIKE 'kisan-smoke-%'`);

  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('clean-smoke error:', e.message);
});
