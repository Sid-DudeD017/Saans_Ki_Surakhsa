const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.SAANS_DATABASE_URL });
pool.query(`SELECT case_id, count(*) FROM status_history GROUP BY case_id ORDER BY count DESC LIMIT 1`)
  .then(res => { console.table(res.rows); process.exit(0); });
