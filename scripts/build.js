import fs from 'node:fs';import path from 'node:path';import {build} from 'esbuild';
await import('./pages.js');
for(const stale of ['dist/scene.js'])if(fs.existsSync(stale))fs.unlinkSync(stale);
fs.mkdirSync('dist',{recursive:true});fs.cpSync('public','dist',{recursive:true});
for(const name of ['app','owner','workflow','hero-scene','trial'])await build({entryPoints:['public/'+name+'.js'],outfile:'dist/'+name+'.js',minify:true,bundle:true,target:'es2022'});
const api=process.env.API_BASE_URL||'';if(api&&!/^https?:\/\//.test(api))throw Error('API_BASE_URL must be an HTTP(S) origin');
fs.writeFileSync('dist/runtime-config.js','window.EVMS_CONFIG='+JSON.stringify({apiBase:api})+';');
const site=process.env.PUBLIC_SITE_URL||'';if(site){const origin=new URL(site).origin;for(const name of ['index','product','workflow','deployment','about','contact','downloads','trial','privacy','owner']){const p=path.join('dist',name+'.html');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll('__SITE_URL__',origin));}}
console.log('Built public application. Runtime config can be replaced at deployment without rebuilding JS.');
