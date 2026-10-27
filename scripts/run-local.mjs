import { projectRoot } from './sites-env.mjs';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Only local Vite dev/build operations are accepted; never deploy.
const command = process.argv[2];
if (!['dev', 'build', 'start'].includes(command) || process.argv.length !== 3) {
  throw new Error('Expected dev, build, or start, without extra arguments.');
}
// Do not inherit a logged-in Cloudflare account's credentials or .dev.vars.
for (const name of Object.keys(process.env)) {
  if (/^(CLOUDFLARE_|CF_)/.test(name)) delete process.env[name];
}
process.env.CLOUDFLARE_CF_FETCH_ENABLED = 'false';
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false';
process.env.CLOUDFLARE_INCLUDE_PROCESS_ENV = 'false';
if (command === 'start') {
  let built;
  try { built = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8')); }
  catch { throw Error('Run pnpm.cmd build before pnpm.cmd start.'); }
  if (built.name !== 'ansim-local-demo' || built.d1_databases?.some(db => db.database_id !== '00000000-0000-4000-8000-000000000000' || db.remote)) throw Error('Expected the local demo build. Run pnpm.cmd build.');
  const result = spawnSync(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'dev', '--config', 'dist/server/wrangler.json', '--local', '--persist-to', '.wrangler/state', '--ip', '127.0.0.1', '--port', '8787', '--inspector-port', '0'], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
const vite = await import('vite');
const config = { configFile: path.join(projectRoot, 'vite.local.config.ts') };
if (command === 'build') await (await vite.createBuilder(config)).buildApp();
else {
  const server = await vite.createServer(config);
  await server.listen();
  server.printUrls();
}
