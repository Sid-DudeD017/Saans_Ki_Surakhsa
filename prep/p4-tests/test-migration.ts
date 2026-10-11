import { pool, migrate } from '../../services/command-api/deps';
import { commandConfig } from '../../services/command-api/config';

async function main() {
  const db = pool(commandConfig());
  console.log('Migrating once...');
  await migrate(db);
  console.log('Migrating twice...');
  await migrate(db);
  console.log('SUCCESS: Schema migration is idempotent');
  await db.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
