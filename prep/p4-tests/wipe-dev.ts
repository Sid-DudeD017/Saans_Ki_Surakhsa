/**
 * prep/p4-tests/wipe-dev.ts
 *
 * Deletes ALL rows from:
 * tickets, cases, complaints, case_reports, case_decisions, help_requests,
 * status_history, ticket_notes, consent_records, uploads, evidence,
 * workflow_events, notifications_sent.
 *
 * Keeps reference data: districts, routing config, users, spatial_ref_sys.
 * Does NOT touch audit_log (append-only by trigger).
 *
 * Safety: refuses to run unless NODE_ENV=development and DB host is 127.0.0.1.
 * Usage:
 *   npx tsx prep/p4-tests/wipe-dev.ts --dry-run   # counts only
 *   npx tsx prep/p4-tests/wipe-dev.ts              # actually deletes
 */
import pg from "pg";

const CANDIDATE_TABLES_TO_WIPE = [
  // Order respects foreign key dependencies
  "case_decisions",
  "ticket_notes",
  "status_history",
  "case_reports",
  "cases",
  "help_requests",
  "evidence",
  "consent_records",
  "workflow_events",
  "complaints",
  "uploads",
  "notifications_sent",
  "tickets", // Included per specification (checked for existence)
];

const REFERENCE_TABLES = [
  "districts",
  "users",
  "spatial_ref_sys",
  "routing_config",
];

async function main() {
  // ── safety checks ──────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "development") {
    console.error("Error: NODE_ENV must be 'development' to run this script. Refusing.");
    process.exit(1);
  }

  const url = process.env.SAANS_DATABASE_URL || "postgres://saans:saans@127.0.0.1:5433/saans";
  const parsed = new URL(url);
  if (parsed.hostname !== "127.0.0.1") {
    console.error(`Error: DB host is '${parsed.hostname}', must be 127.0.0.1. Refusing.`);
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const pool = new pg.Pool({ connectionString: url });

  // Find all existing tables in public schema
  const existingTablesResult = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  const existingTables = new Set(existingTablesResult.rows.map((r: { tablename: string }) => r.tablename));

  const tablesToWipe = CANDIDATE_TABLES_TO_WIPE.filter((t) => existingTables.has(t));

  console.log("=== ROW COUNTS (BEFORE) ===");
  for (const t of CANDIDATE_TABLES_TO_WIPE) {
    if (existingTables.has(t)) {
      const r = await pool.query(`SELECT count(*) FROM "${t}"`);
      console.log(`  ${t}: ${r.rows[0].count}`);
    } else {
      console.log(`  ${t}: 0 (table does not exist in schema)`);
    }
  }

  console.log("\n=== REFERENCE DATA (PRESERVED) ===");
  for (const t of REFERENCE_TABLES) {
    if (existingTables.has(t)) {
      const r = await pool.query(`SELECT count(*) FROM "${t}"`);
      console.log(`  ${t}: ${r.rows[0].count} (KEPT)`);
    } else {
      console.log(`  ${t}: (not a db table; routing is infra/config/routing.json) (KEPT)`);
    }
  }

  const auditCount = await pool.query(`SELECT count(*) FROM audit_log`);
  console.log(`  audit_log: ${auditCount.rows[0].count} (APPEND-ONLY, NOT TOUCHED)`);

  if (dryRun) {
    console.log("\n[DRY RUN] No rows were deleted. Run without --dry-run to delete rows.");
    await pool.end();
    return;
  }

  // ── delete ─────────────────────────────────────────────────────────
  console.log("\n=== DELETING ROWS ===");
  for (const t of tablesToWipe) {
    const r = await pool.query(`DELETE FROM "${t}"`);
    console.log(`  ${t}: deleted ${r.rowCount} row(s)`);
  }

  // ── after counts ───────────────────────────────────────────────────
  console.log("\n=== ROW COUNTS (AFTER) ===");
  for (const t of CANDIDATE_TABLES_TO_WIPE) {
    if (existingTables.has(t)) {
      const r = await pool.query(`SELECT count(*) FROM "${t}"`);
      console.log(`  ${t}: ${r.rows[0].count}`);
    } else {
      console.log(`  ${t}: 0 (table does not exist in schema)`);
    }
  }

  const auditAfter = await pool.query(`SELECT count(*) FROM audit_log`);
  console.log(`  audit_log: ${auditAfter.rows[0].count} (APPEND-ONLY, NOT TOUCHED)`);

  await pool.end();
}

main().catch((e) => {
  console.error("Execution failed:", e);
  process.exit(1);
});
