const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.SAANS_DATABASE_URL });
pool.query(`SELECT entry_hash FROM audit_log ORDER BY created_at DESC LIMIT 3`)
  .then(res => { console.table(res.rows); process.exit(0); });
