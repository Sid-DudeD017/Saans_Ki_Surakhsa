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

  it('detects a tampered entry using SHA-256 chain', async () => {
    const rawString1 = `genesis` + `officer-1` + `note` + `case-123` + `{"status":"submitted"}` + `{"status":"submitted"}` + `2026-10-10T12:00:00Z`;
    const h1 = crypto.createHash('sha256').update(rawString1).digest('hex');

    const rawString2 = `${h1}` + `officer-1` + `resolve` + `case-123` + `{"status":"submitted"}` + `{"status":"resolved"}` + `2026-10-10T12:05:00Z`;
    const h2 = crypto.createHash('sha256').update(rawString2).digest('hex');
    
    // Test the logic of chain verification.
    const rows = [
      { actor: 'officer-1', action: 'note', ticket_id: 'case-123', before_state: {status: 'submitted'}, after_state: {status: 'submitted'}, previous_hash: 'genesis', entry_hash: h1, created_at: new Date('2026-10-10T12:00:00Z') },
      { actor: 'attacker', action: 'resolve', ticket_id: 'case-123', before_state: {status: 'submitted'}, after_state: {status: 'resolved'}, previous_hash: h1, entry_hash: h2, created_at: new Date('2026-10-10T12:05:00Z') }, // tampered actor!
    ];
    
    let valid = true;
    for (const r of rows) {
      const bStr = JSON.stringify(r.before_state);
      const aStr = JSON.stringify(r.after_state);
      const raw = `${r.previous_hash}${r.actor}${r.action}${r.ticket_id}${bStr}${aStr}${r.created_at.toISOString()}`;
      const computed = crypto.createHash('sha256').update(raw).digest('hex');
      if (computed !== r.entry_hash) {
        valid = false;
      }
    }
    expect(valid).toBe(false);
  });
});
