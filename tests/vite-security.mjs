import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const base = new URL(process.argv[2] || 'http://127.0.0.1:5174');
assert(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname));
assert.equal(process.platform, 'win32', 'This regression must run on Windows/NTFS');
const root = fileURLToPath(new URL('../', import.meta.url));
const filename = `audit-dummy-${randomUUID()}.key`;
const fixture = join(root, filename), marker = `FAKE_AUDIT_MARKER_${randomUUID()}`;
const results = [];
writeFileSync(fixture, marker, { flag: 'wx' });
try {
  const paths = [`/${filename}?raw`, `/${filename}::$DATA?raw`, `/${filename}::$DATA?import&raw`, `/${filename}%3A%3A%24DATA?raw`];
  // Ask Windows for this dummy file's 8.3 alias; never enumerate real key files.
  const short = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', `for %I in ("${fixture}") do @echo %~sI`], { encoding: 'utf8', windowsHide: true });
  if (short.error) throw short.error;
  assert.equal(short.status, 0);
  const shortName = basename(short.stdout.trim());
  if (shortName.includes('~')) paths.push(`/${shortName}?raw`);
  for (const path of paths) {
    const r = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
    const text = await r.text();
    results.push({ path, status: r.status, markerExposed: text.includes(marker) });
    assert(!text.includes(marker), `Dummy file exposed via ${path}`);
    assert(r.status === 403 || r.status === 404, `Expected file rejection, received ${r.status}: ${path}`);
  }
  mkdirSync(join(root, '.sites-runtime/qa'), { recursive: true });
  writeFileSync(join(root, '.sites-runtime/qa/vite-security-result.json'), JSON.stringify({ platform: process.platform, base: base.origin, passed: true, shortNameTested: shortName.includes('~'), results }, null, 2));
  console.log('PASS: Windows dummy .key direct/ADS/encoded ADS/available 8.3 file access blocked');
} finally { unlinkSync(fixture); }
