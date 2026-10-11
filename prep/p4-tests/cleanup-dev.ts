import { Pool } from 'pg';

async function main() {
  if (process.env.NODE_ENV !== 'development') {
    console.error("Error: NODE_ENV must be 'development' to run this script.");
    process.exit(1);
  }

  const dbUrl = process.env.SAANS_DATABASE_URL;
  if (!dbUrl || !dbUrl.includes('127.0.0.1')) {
    console.error("Error: Database host must be 127.0.0.1 (local).");
    process.exit(1);
  }

  const isDryRun = process.argv.includes('--dry-run');
  const pool = new Pool({ connectionString: dbUrl });

  try {
    const compBefore = await pool.query("SELECT count(*) FROM complaints");
    const casesBefore = await pool.query("SELECT count(*) FROM cases");

    console.log(`Before cleanup: ${compBefore.rows[0].count} complaints, ${casesBefore.rows[0].count} cases.`);

    const prefixCheck = `
      LIKE 'smoke-%' OR LIKE 'kisan-smoke-%' OR LIKE 'cit-%' OR LIKE 'test-%' OR LIKE 'http-test-%'
    `;
    const inCondition = `
      'smoke-%', 'kisan-smoke-%', 'cit-%', 'test-%', 'http-test-%'
    `;

    // We can use a CTE or simply list the LIKE clauses
    const whereLike = `
      idempotency_key LIKE 'smoke-%' OR 
      idempotency_key LIKE 'kisan-smoke-%' OR 
      idempotency_key LIKE 'cit-%' OR 
      idempotency_key LIKE 'test-%' OR 
      idempotency_key LIKE 'http-test-%' OR
      idempotency_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `;
    
    const casesWhereLike = `
      duplicate_of LIKE 'smoke-%' OR 
      duplicate_of LIKE 'kisan-smoke-%' OR 
      duplicate_of LIKE 'cit-%' OR 
      duplicate_of LIKE 'test-%' OR 
      duplicate_of LIKE 'http-test-%' OR
      duplicate_of ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
      complaint_id IN (SELECT id FROM complaints WHERE ${whereLike})
    `;

    if (isDryRun) {
      console.log("DRY RUN: Querying rows to delete...");
      const compDelete = await pool.query(`SELECT count(*) FROM complaints WHERE ${whereLike}`);
      const casesDelete = await pool.query(`SELECT count(*) FROM cases WHERE ${casesWhereLike}`);
      console.log(`Would delete ${compDelete.rows[0].count} complaints and ${casesDelete.rows[0].count} cases, plus their related history/notes.`);
    } else {
      await pool.query("BEGIN");
      
      // Delete dependent tables for cases
      const crRes = await pool.query(`DELETE FROM case_reports WHERE case_id IN (SELECT id FROM cases WHERE ${casesWhereLike})`);
      const cdRes = await pool.query(`DELETE FROM case_decisions WHERE case_id IN (SELECT id FROM cases WHERE ${casesWhereLike})`);
      const tnRes = await pool.query(`DELETE FROM ticket_notes WHERE case_id IN (SELECT id FROM cases WHERE ${casesWhereLike})`);
      const shRes = await pool.query(`DELETE FROM status_history WHERE case_id IN (SELECT id FROM cases WHERE ${casesWhereLike})`);
      // Audit log is append only, but just to note, we leave it.

      // Delete dependent tables for complaints that do not depend on cases
      const crCompRes = await pool.query(`DELETE FROM case_reports WHERE complaint_id IN (SELECT id FROM complaints WHERE ${whereLike})`);
      const evRes = await pool.query(`DELETE FROM evidence WHERE complaint_id IN (SELECT id FROM complaints WHERE ${whereLike})`);
      const consRes = await pool.query(`DELETE FROM consent_records WHERE complaint_id IN (SELECT id FROM complaints WHERE ${whereLike})`);
      const weRes = await pool.query(`DELETE FROM workflow_events WHERE complaint_id IN (SELECT id FROM complaints WHERE ${whereLike})`);

      // Delete cases FIRST because they depend on help_requests
      const resCases = await pool.query(`DELETE FROM cases WHERE ${casesWhereLike}`);
      
      // Now delete help_requests
      const hrRes = await pool.query(`DELETE FROM help_requests WHERE complaint_id IN (SELECT id FROM complaints WHERE ${whereLike})`);

      // Delete complaints
      const resComp = await pool.query(`DELETE FROM complaints WHERE ${whereLike}`);
      
      await pool.query("COMMIT");

      console.log(`Deleted ${resComp.rowCount} test complaints, ${resCases.rowCount} test cases, ${shRes.rowCount} status history rows, and ${tnRes.rowCount} ticket notes.`);

      const compAfter = await pool.query("SELECT count(*) FROM complaints");
      const casesAfter = await pool.query("SELECT count(*) FROM cases");

      console.log(`After cleanup: ${compAfter.rows[0].count} complaints, ${casesAfter.rows[0].count} cases.`);
    }
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Cleanup failed:", err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
