const { Pool } = require('pg');
async function main() {
  const pool = new Pool({ connectionString: process.env.SAANS_DATABASE_URL || "postgres://saans:saans@127.0.0.1:5433/saans" });
  try {
    const q = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.table(q.rows);
  } finally {
    await pool.end();
  }
}
main().catch(console.error);
