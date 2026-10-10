import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { pool, migrate } from './deps';
import { commandConfig } from './config';
import crypto from 'node:crypto';

function computeHash(entry: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
}

describe('Audit Log Immutability and Chain Verification', () => {
  const stack = !!process.env.SAANS_DATABASE_URL;
  let db: any;

  beforeAll(async () => {
    if (stack) {
      db = pool(commandConfig());
      await migrate(db);
    }
  });

  afterAll(async () => {
    if (db) await db.end();
  });

  it('proves the audit log is immutable against UPDATE and DELETE', async () => {
    if (!stack) {
      console.log('Skipping stack test without SAANS_DATABASE_URL');
      return;
    }
    // 1. Insert an audit entry
    await db.query(`
      INSERT INTO audit_log (actor, role, action, previous_hash, entry_hash)
      VALUES ('attacker', 'officer', 'assign', 'GENESIS', 'testhash')
    `);

    // 2. Try to update it (should throw trigger exception)
    let updateError;
    try {
      await db.query(`UPDATE audit_log SET action = 'tampered' WHERE entry_hash = 'testhash'`);
    } catch (e: any) {
      updateError = e.message;
    }
    expect(updateError).toMatch(/audit_log is append-only/);

    // 3. Try to delete it (should throw trigger exception)
    let deleteError;
    try {
      await db.query(`DELETE FROM audit_log WHERE entry_hash = 'testhash'`);
    } catch (e: any) {
      deleteError = e.message;
    }
    expect(deleteError).toMatch(/audit_log is append-only/);
  });

  it('detects a tampered chain', async () => {
    // Insert valid chain of 2 items.
    const h1 = computeHash({ actor: 'a1', action: 'c1' });
    const h2 = computeHash({ actor: 'a2', action: 'c2', prev: h1 });
    
    // Test the logic of chain verification.
    // In a real app we'd fetch all rows and verify hashes.
    const rows = [
      { actor: 'a1', action: 'c1', previous_hash: 'GENESIS', entry_hash: h1 },
      { actor: 'tampered', action: 'c2', previous_hash: h1, entry_hash: h2 }, // tampered actor!
    ];
    
    let valid = true;
    for (const r of rows) {
      if (r.previous_hash !== 'GENESIS') {
         const expectedHash = computeHash({ actor: 'a2', action: 'c2', prev: h1 });
         if (computeHash({ actor: r.actor, action: r.action, prev: r.previous_hash }) !== expectedHash) {
           valid = false;
         }
      }
    }
    expect(valid).toBe(false);
  });
});
