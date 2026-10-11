const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.SAANS_DATABASE_URL });
pool.query(`
  SELECT split_part(idempotency_key, '-', 1) as prefix, count(*) 
  FROM complaints 
  GROUP BY prefix
`).then(res => { 
  console.table(res.rows); 
  process.exit(0); 
});
