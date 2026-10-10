const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.SAANS_DATABASE_URL || "postgres://saans:saans@127.0.0.1:5433/saans" });

(async () => {
  const comp = await pool.query("SELECT SUBSTRING(idempotency_key FROM '^([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*)') as prefix, count(*) FROM complaints GROUP BY prefix ORDER BY count DESC");
  const cases = await pool.query("SELECT SUBSTRING(duplicate_of FROM '^([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*)') as prefix, count(*) FROM cases GROUP BY prefix ORDER BY count DESC");
  
  // Aggregate by known prefixes
  const aggregate = (rows, col) => {
    let counts = { smoke: 0, "test-key": 0, "http-test": 0, "kisan-smoke": 0, "cit": 0, other: 0, null: 0 };
    for (let r of rows) {
      let p = r.prefix;
      if (!p) counts.null += parseInt(r.count);
      else if (p.startsWith('smoke')) counts.smoke += parseInt(r.count);
      else if (p.startsWith('test')) counts['test-key'] += parseInt(r.count);
      else if (p.startsWith('http-test')) counts['http-test'] += parseInt(r.count);
      else if (p.startsWith('kisan')) counts['kisan-smoke'] += parseInt(r.count);
      else if (p.startsWith('cit')) counts['cit'] += parseInt(r.count);
      else counts.other += parseInt(r.count);
    }
    return counts;
  };
  
  console.log("Complaints breakdown:", aggregate(comp.rows, 'prefix'));
  console.log("Cases breakdown:", aggregate(cases.rows, 'prefix'));
  pool.end();
})();
