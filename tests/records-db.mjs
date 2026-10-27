import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// In-memory SQLite only: test the real migrations and database-level invariant.
const db = new DatabaseSync(':memory:');
try {
  db.exec(readFileSync(new URL('../drizzle/0000_sudden_the_hood.sql', import.meta.url), 'utf8'));
  db.prepare('INSERT INTO records VALUES(?,?,?,?)').run('existing', 'stopped-credential', 'review', 123);
  db.exec(readFileSync(new URL('../drizzle/0001_record_credential_guard.sql', import.meta.url), 'utf8'));
  assert.equal(db.prepare('SELECT created FROM records WHERE id=?').get('existing').created, 123);
  db.prepare('UPDATE records SET result=? WHERE id=?').run('new-review', 'existing');
  assert.throws(() => db.prepare('UPDATE records SET credential=? WHERE id=?').run('active-credential', 'existing'), /record_credential_conflict/);
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO records VALUES(?,?,?,?)').run('must-rollback', 'active-credential', 'ok', 456);
    // Same UPSERT shape as sync: a conflict must abort, never replace the result.
    db.prepare('INSERT INTO records VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET credential=excluded.credential,result=excluded.result').run('existing', 'active-credential', 'wrong-ok', 789);
    assert.fail('Conflicting UPSERT was accepted');
  } catch (error) {
    db.exec('ROLLBACK');
    assert.match(error.message, /record_credential_conflict/);
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM records WHERE id=?').get('must-rollback').n, 0);
  assert.deepEqual({ ...db.prepare('SELECT credential,result,created FROM records WHERE id=?').get('existing') }, { credential: 'stopped-credential', result: 'new-review', created: 123 });
  console.log('PASS: migration upgrade preserves data, status update allowed, credential change blocked, conflicting UPSERT transaction rolled back (4)');
} finally { db.close(); }
