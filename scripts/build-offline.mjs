import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

export function buildOfflineManifest(root) {
  const dir = join(root, 'dist/client'), files = [];
  function walk(p) {
    for (const item of readdirSync(p, { withFileTypes: true })) {
      if (item.name.startsWith('.')) continue;
      const file = join(p, item.name);
      if (item.isDirectory()) walk(file);
      else if (!['sw.js', 'offline-assets.json', '_headers', '_redirects'].includes(item.name) && !item.name.endsWith('.map')) files.push(file);
    }
  }
  walk(dir);
  files.sort();
  const hash = createHash('sha256');
  for (const f of files) hash.update(relative(dir, f)).update(readFileSync(f));
  hash.update(readFileSync(join(root, 'public/sw.js')));
  const assets = ['/', ...files.map(f => '/' + relative(dir, f).split(sep).join('/'))];
  writeFileSync(join(dir, 'offline-assets.json'), JSON.stringify({ version: hash.digest('hex').slice(0, 20), assets }));
  console.log(`Offline app shell: ${assets.length} resources, API excluded`);
}
