// Local only. No account, login, remote database, or deployment is used.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {projectRoot} from './sites-env.mjs';
const original=path.join(projectRoot,'dist/server/wrangler.json');
let config;
try {config=JSON.parse(readFileSync(original,'utf8'));}catch{throw Error('Run pnpm build before pnpm db:local.');}
config.main=path.resolve(path.dirname(original),config.main);
if(config.assets?.directory)config.assets.directory=path.resolve(path.dirname(original),config.assets.directory);
config.d1_databases=config.d1_databases.map(binding=>({...binding,migrations_dir:path.join(projectRoot,'drizzle')}));
mkdirSync('.sites-runtime',{recursive:true});
const target=path.join(projectRoot,'.sites-runtime/local-wrangler.json');
writeFileSync(target,JSON.stringify(config));
const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config',target,'--persist-to','.wrangler/state'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
