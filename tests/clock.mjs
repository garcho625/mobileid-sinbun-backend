import assert from 'node:assert/strict';
import { keys, sign, check } from '../lib/proof.ts';

const issuer = await keys(), device = await keys(), now = Date.now(), nonce = crypto.randomUUID();
const response = await sign({ id: 'clock-boundary', nonce }, device.privateKey);
async function run(issued, expires, prepared = now) {
  const credential = await sign({ id: 'clock-boundary', name: 'test', deviceKey: device.publicKey, issued, expires }, issuer.privateKey);
  return check(credential, response, { publicKey: issuer.publicKey, prepared }, nonce, now, new Set(), 'visit');
}
assert((await run(now + 1000, now + 3600000, now + 1000)).every(c => c.ok), 'Small local clock skew is tolerated');
assert(!(await run(now + 2500, now + 3600000))[2].ok, 'Larger future issuance is rejected');
assert(!(await run(now - 1000, now))[2].ok, 'Expiry remains strict');
assert(!(await run(now - 900001, now + 3600000))[3].ok, 'Fifteen-minute preparation remains strict');
console.log('PASS: small clock skew, future issuance rejection, strict expiry, strict preparation age (4)');
