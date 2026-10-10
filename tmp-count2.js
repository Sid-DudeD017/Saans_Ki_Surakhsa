const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.SAANS_DATABASE_URL });
pool.query(`
  SELECT count(*) FROM cases WHERE duplicate_of NOT LIKE 'smoke-%' AND duplicate_of NOT LIKE 'cit-%' AND duplicate_of NOT LIKE 'kisan-smoke-%' AND duplicate_of NOT LIKE 'test-%' AND duplicate_of NOT LIKE 'http-test-%' AND duplicate_of IS NOT NULL
`).then(res => { console.log("UUID keys in cases:", res.rows[0].count); });
pool.query(`
  SELECT count(*) FROM complaints WHERE idempotency_key NOT LIKE 'smoke-%' AND idempotency_key NOT LIKE 'cit-%' AND idempotency_key NOT LIKE 'kisan-smoke-%' AND idempotency_key NOT LIKE 'test-%' AND idempotency_key NOT LIKE 'http-test-%'
`).then(res => { console.log("UUID keys in complaints:", res.rows[0].count); process.exit(0); });
