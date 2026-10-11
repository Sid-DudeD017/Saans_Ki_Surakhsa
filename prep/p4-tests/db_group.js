const { Pool } = require('pg');
async function main() {
  const pool = new Pool({ connectionString: process.env.SAANS_DATABASE_URL || "postgres://saans:saans@127.0.0.1:5433/saans" });
  try {
    const q = await pool.query(`
      SELECT to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as sec, 
             split_part(duplicate_of, '-', 1) as prefix, 
             count(*) 
      FROM cases 
      GROUP BY sec, prefix 
      ORDER BY count DESC 
      LIMIT 20
    `);
    console.table(q.rows);
  } finally {
    await pool.end();
  }
}
main().catch(console.error);
