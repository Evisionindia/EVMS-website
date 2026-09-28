import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {syncRelease,checksum} from '../scripts/mirror-lib.js';import {releaseCatalog} from '../server/releases.js';import {openDatabase} from '../server/db.js';import {config} from '../server/config.js';
const exe=text=>{const b=Buffer.alloc(160);b.write('MZ');b.writeUInt32LE(64,60);b.write('PE\0\0',64);b.write(text,80);return b;};
const policy=JSON.parse(fs.readFileSync('content/releases.json'));
function fixtures(){
 let next=100,uploads=0;const releases=[],data=new Map();
 const api={request:async(path,o={})=>{
  if(path.includes('/tags/'))return releases.find(r=>r.tag_name===decodeURIComponent(path.split('/tags/')[1]))||null;
  if(o.method==='POST'){const r={id:next++,assets:[],html_url:'https://github.com/'+policy.mirrorRepository+'/releases/tag/'+o.body.tag_name,published_at:'2026-09-28T00:00:00Z',...o.body};releases.push(r);return r;}
  if(o.method==='DELETE'){const id=Number(path.split('/').at(-1));for(const r of releases)r.assets=r.assets.filter(a=>a.id!==id);data.delete(id);return{};}
  if(o.method==='PATCH'){const r=releases.find(r=>r.id===Number(path.split('/').at(-1)));Object.assign(r,o.body);return r;}
 },list:async path=>releases.find(r=>r.id===Number(path.split('/').at(-2))).assets,bytes:async(_r,id)=>data.get(id),
 upload:async(_r,id,name,bytes)=>{uploads++;const a={id:next++,name,size:bytes.length,state:'uploaded',digest:checksum(bytes),browser_download_url:'https://github.com/'+policy.mirrorRepository+'/releases/download/'+releases.find(r=>r.id===id).tag_name+'/'+name};releases.find(r=>r.id===id).assets.push(a);data.set(a.id,bytes);return a;}};
 let sourceId=1;function source(tag){const assets=['Client','Owner'].map(role=>{const bytes=exe('fixture '+tag+role);const id=sourceId++;data.set(id,bytes);return{id,name:'EVMS-'+role+'-Setup-'+tag.slice(1)+'-x64.exe',size:bytes.length,state:'uploaded',digest:checksum(bytes)};});return{id:sourceId++,tag_name:tag,name:'EVMS '+tag,body:'Changes in '+tag,draft:false,prerelease:false,published_at:'2026-09-28T00:00:00Z',html_url:'https://github.com/'+policy.sourceRepository+'/releases/tag/'+tag,assets};}
 return{api,source,releases,data,uploads:()=>uploads};
}
test('source → verified mirror → catalog → download; next version, repeat, notes edit',async()=>{
 const f=fixtures(),a=f.source('v1.1.0');await syncRelease(a,f.api,f.api,policy);assert.equal(f.releases.length,1);assert.equal(f.releases[0].draft,false);assert.equal(f.uploads(),3);
 await syncRelease(a,f.api,f.api,policy);assert.equal(f.uploads(),3);assert.equal(f.releases.length,1);
 a.body='Corrected release notes';await syncRelease(a,f.api,f.api,policy);assert.equal(f.uploads(),3);assert.match(f.releases[0].body,/Corrected/);
 const b=f.source('v1.1.1');await syncRelease(b,f.api,f.api,policy);assert.equal(f.releases.length,2);
 const db=openDatabase(':memory:'),cfg=config({});
 const catalog=releaseCatalog(db,cfg,async url=>({ok:true,status:200,json:async()=>String(url).endsWith('/latest')?f.releases[1]:f.releases}));
 const result=await catalog();assert.equal(result.latestTag,'v1.1.1');assert.equal(result.releases.length,2);
 for(const release of result.releases)for(const asset of release.assets)assert.equal(checksum(await f.api.bytes(policy.mirrorRepository,asset.id)),asset.digest);
 db.close();
});
test('missing upload recovered, unrelated files excluded, broken/changed assets rejected',async()=>{
 const f=fixtures(),r=f.source('v1.1.0');r.assets.push({id:99,name:'private.sqlite',state:'uploaded',size:9});await syncRelease(r,f.api,f.api,policy);assert.equal(f.releases[0].assets.some(a=>a.name==='private.sqlite'),false);
 const lost=f.releases[0].assets.find(a=>a.name.includes('Owner'));f.releases[0].assets=f.releases[0].assets.filter(a=>a!==lost);await syncRelease(r,f.api,f.api,policy);assert.equal(f.releases[0].assets.filter(a=>a.name.includes('Owner')).length,1);
 f.data.set(r.assets[0].id,Buffer.from('MZ changed'));await assert.rejects(()=>syncRelease(r,f.api,f.api,policy),/verification|checksum/);
 const g=fixtures(),bad=g.source('v2.0.0');g.data.set(bad.assets[0].id,Buffer.alloc(bad.assets[0].size));await assert.rejects(()=>syncRelease(bad,g.api,g.api,policy),/verification/);assert.equal(g.releases.length,0);
 const incomplete=g.source('v3.0.0');incomplete.assets.pop();await assert.rejects(()=>syncRelease(incomplete,g.api,g.api,policy),/required/);
});
test('unrelated existing tag never overwritten; changed published bytes require new version',async()=>{
 const f=fixtures(),r=f.source('v1.1.0');f.releases.push({id:999,tag_name:r.tag_name,body:'Not ours',assets:[]});await assert.rejects(()=>syncRelease(r,f.api,f.api,policy),/another release/);
 f.releases.length=0;await syncRelease(r,f.api,f.api,policy);const bytes=exe('changed release content');f.data.set(r.assets[0].id,bytes);r.assets[0].size=bytes.length;r.assets[0].digest=checksum(bytes);await assert.rejects(()=>syncRelease(r,f.api,f.api,policy),/new version/);
});
test('catalog unavailable, empty, malformed, cached stale and sync warning',async()=>{
 const db=openDatabase(':memory:'),cfg=config({});let result=await releaseCatalog(db,cfg,async()=>({ok:false,status:404}))();assert.equal(result.unavailable,true);
 result=await releaseCatalog(db,cfg,async url=>String(url).endsWith('/latest')?{ok:false,status:404}:{ok:true,status:200,json:async()=>[]})();assert.equal(result.empty,true);
 db.prepare('UPDATE release_cache SET checked=0').run();result=await releaseCatalog(db,cfg,async()=>{throw Error();})();assert.equal(result.stale,true);assert.equal(result.empty,true);db.close();
});
