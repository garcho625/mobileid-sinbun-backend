import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { keys, sign, verify, check } from '../lib/proof.ts';

const base = new URL(process.argv[2] || 'http://127.0.0.1:8788');
assert(['127.0.0.1', 'localhost'].includes(base.hostname) && base.protocol === 'http:', 'Only loopback local servers may be tested');
async function call(body, expected = 200) {
  const r = await fetch(new URL('/api/demo', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  assert.equal(r.status, expected);
  return r.json();
}
const trust = await call({ action: 'prepare' });
assert.equal(trust.publicKey.crv, 'P-256');
assert(!('d' in trust.publicKey));
const device = await keys();
const { credential } = await call({ action: 'issue', deviceKey: device.publicKey });
assert(await verify(credential, trust.publicKey));
const nonce = crypto.randomUUID(), response = await sign({ nonce, id: credential.payload.id }, device.privateKey);
const now = Date.now();
const normal = await check(credential, response, trust, nonce, now, new Set(), 'visit');
assert(normal.every(c => c.ok), JSON.stringify({ checks: normal, issuedDelta: now - credential.payload.issued, preparedDelta: now - trust.prepared }));
assert(!(await check(credential, response, trust, nonce, Date.now(), new Set([nonce]), 'visit'))[1].ok);
const tampered = structuredClone(credential); tampered.payload.name = 'tampered';
assert(!(await check(tampered, response, trust, nonce, Date.now(), new Set(), 'visit'))[0].ok);
assert(!(await check(credential, response, trust, '', Date.now(), new Set(), 'visit'))[1].ok);
assert((await check(null, response, trust, nonce, Date.now(), new Set(), 'visit')).every(c => !c.ok));
assert.equal((await call({ action: 'status', id: credential.payload.id })).status, 'active');
const record = { id: crypto.randomUUID(), credential: credential.payload.id, result: 'client supplied arbitrary result' };
let sync = await call({ action: 'sync', records: [record] });
assert.equal(sync.saved, 1);
assert.equal(sync.records[0].result, '복구 확인 · 상태 일치');
assert.equal((await call({ action: 'stop', id: credential.payload.id })).status, 'stopped');
sync = await call({ action: 'sync', records: [record] });
assert.equal(sync.records[0].result, '상태 불일치 · 담당자 검토');
assert.equal((await call({ action: 'records' })).records.filter(r => r.id === record.id).length, 1);
// P1 regression: one receipt belongs to one credential, even within a batch.
const active = (await call({ action: 'issue', deviceKey: device.publicKey })).credential;
const receipt = credentialId => ({ id: crypto.randomUUID(), credential: credentialId, result: 'untrusted client result' });
const normalRecord = receipt(active.payload.id);
const normalSync = await call({ action: 'sync', records: [normalRecord] });
assert.equal(normalSync.saved, 1);
assert.equal(normalSync.records[0].credential, active.payload.id);
assert.equal(normalSync.records[0].result, '복구 확인 · 상태 일치');
const identical = await call({ action: 'sync', records: [normalRecord, normalRecord] });
assert.equal(identical.saved, 1, 'saved counts unique persisted receipts, not submitted array length');
assert.deepEqual(identical.records, normalSync.records, 'Repeated sync keeps identity and first timestamp');
assert.deepEqual((await call({ action: 'sync', records: [normalRecord] })).records, normalSync.records);
for (const credentials of [[credential.payload.id, active.payload.id], [active.payload.id, credential.payload.id]]) {
  const conflictId = crypto.randomUUID(), preceding = receipt(active.payload.id);
  await call({ action: 'sync', records: [preceding, ...credentials.map(c => ({ id: conflictId, credential: c, result: 'x' }))] }, 409);
  const rows = (await call({ action: 'records' })).records;
  assert(!rows.some(r => r.id === conflictId || r.id === preceding.id), 'Conflicting batch must write nothing');
}
const preceding = receipt(active.payload.id);
await call({ action: 'sync', records: [preceding, { ...record, credential: active.payload.id }] }, 409);
assert(!(await call({ action: 'records' })).records.some(r => r.id === preceding.id));
const stoppedRecord = receipt(credential.payload.id);
const stoppedSync = await call({ action: 'sync', records: [stoppedRecord, stoppedRecord] });
assert.equal(stoppedSync.saved, 1);
assert.equal(stoppedSync.records[0].result, '상태 불일치 · 담당자 검토');
assert.deepEqual(await call({ action: 'sync', records: [] }), { saved: 0, records: [] });
for (let i = 0; i < 6; i++) {
  const sharedId = crypto.randomUUID();
  const attempts = [credential.payload.id, active.payload.id].map(c => {
    const own = receipt(c);
    return { own, body: { action: 'sync', records: [own, { id: sharedId, credential: c, result: 'x' }] } };
  });
  const responses = await Promise.all(attempts.map(async attempt => {
    const r = await fetch(new URL('/api/demo', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attempt.body) });
    return { status: r.status, data: await r.json(), attempt };
  }));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const winner = responses.find(r => r.status === 200), loser = responses.find(r => r.status === 409);
  assert.equal(winner.data.saved, 2);
  const rows = (await call({ action: 'records' })).records;
  const stored = rows.find(r => r.id === sharedId);
  assert.equal(stored.credential, winner.attempt.own.credential);
  assert.equal(stored.result, stored.credential === credential.payload.id ? '상태 불일치 · 담당자 검토' : '복구 확인 · 상태 일치');
  assert(!rows.some(r => r.id === loser.attempt.own.id), 'Losing concurrent batch must not partially commit');
}
await call({ action: 'issue', deviceKey: { kty: 'EC' } }, 400);
await call({ action: 'issue', deviceKey: device.privateKey }, 400);
await call({ action: 'sync', records: [null] }, 400);
await call({ action: 'sync', records: [{}] }, 400);
await call({ action: 'sync', records: Array(101).fill(record) }, 400);
await call({ action: 'sync', records: [{ ...record, credential: 'unknown-review-id' }] }, 400);
const uncommitted = { ...record, id: crypto.randomUUID() };
await call({ action: 'sync', records: [uncommitted, { ...record, id: crypto.randomUUID(), credential: 'unknown-review-id' }] }, 400);
assert(!(await call({ action: 'records' })).records.some(r => r.id === uncommitted.id), 'Invalid batch must not partially insert');
await call(null, 400);
await call({ action: 'not-supported' }, 400);
const crossOrigin = await fetch(new URL('/api/demo', base), { method: 'POST', headers: { Origin: 'https://example.invalid' }, body: JSON.stringify({ action: 'prepare' }) });
assert.equal(crossOrigin.status, 403);
await crossOrigin.arrayBuffer();
const health = await fetch(base.origin, { signal: AbortSignal.timeout(15000) });
assert.equal(health.status, 200, 'HTML must still render after rejected API requests');
assert((await health.text()).includes('CONTINUITY LAB'));
await call({ action: 'prepare' });
mkdirSync('.sites-runtime', { recursive: true });
writeFileSync('.sites-runtime/api-test-result.json', JSON.stringify({ base: base.origin, recordId: record.id, credentialId: record.credential, passed: true, p1RegressionPassed: true, concurrentConflictRounds: 6 }, null, 2));
console.log('PASS: local HTTP + Workers/D1 issuance, signature, nonce/replay/tamper, status, sync/update/query, malformed inputs, cross-origin rejection; P1 unique saved count, retry idempotency, conflicting duplicates (both orders), stopped records, atomic rejection, concurrent conflicts (6 rounds)');
