import './sites-env.mjs';
import { spawnSync } from 'node:child_process';

const action = process.argv[2];
const commands = {
  migrate: ['d1', 'migrations', 'apply', 'DB'],
  inspect: ['d1', 'execute', 'DB', '--command', 'SELECT id, credential, result, created FROM records ORDER BY created DESC LIMIT 100'],
};
if (!commands[action] || process.argv.length !== 3) throw Error('Expected migrate or inspect.');
const env = { ...process.env, CLOUDFLARE_CF_FETCH_ENABLED: 'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false' };
for (const name of Object.keys(env)) if (/^(CLOUDFLARE_API_|CF_API_|CLOUDFLARE_ACCOUNT_ID|CF_ACCOUNT_ID)/.test(name)) delete env[name];
const result = spawnSync(process.execPath, [
  '--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js',
  ...commands[action], '--local', '--config', 'wrangler.local.json', '--persist-to', '.wrangler/state',
], { stdio: 'inherit', env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
