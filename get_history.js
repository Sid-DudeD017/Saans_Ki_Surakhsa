const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.SAANS_DATABASE_URL });
pool.query("SELECT created_at, actor, action, previous_hash, entry_hash, before_state->>'status' as before, after_state->>'status' as after FROM audit_log WHERE ticket_id = $1 ORDER BY created_at ASC", [process.argv[2]])
  .then(res => {
    console.table(res.rows);
    process.exit(0);
  });
