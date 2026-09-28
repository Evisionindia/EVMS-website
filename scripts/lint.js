import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
let failed=false;for(const dir of ['server','scripts','public','tests'])for(const f of fs.readdirSync(dir)){if(!f.endsWith('.js'))continue;const result=spawnSync(process.execPath,['--check',path.join(dir,f)],{encoding:'utf8'});if(result.status){failed=true;console.error(result.stderr);}}
if(failed)process.exitCode=1;else console.log('All JavaScript syntax checks passed.');
