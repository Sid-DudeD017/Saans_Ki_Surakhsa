const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.SAANS_DATABASE_URL });
pool.query("SELECT created_at, status, changed_by, reason FROM status_history WHERE case_id = 'SAANS-20261010-A7665F' ORDER BY created_at ASC")
  .then(res => {
    console.table(res.rows);
    return pool.query("SELECT created_at, actor, action, previous_hash, entry_hash, before_state->>'status' as before, after_state->>'status' as after FROM audit_log WHERE ticket_id = 'SAANS-20261010-A7665F' ORDER BY created_at ASC");
  })
  .then(res => {
    console.table(res.rows);
    process.exit(0);
  });
