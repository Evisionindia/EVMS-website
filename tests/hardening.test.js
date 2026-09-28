import test from 'node:test';import assert from 'node:assert/strict';import {validateLead,createApp} from '../server/app.js';import {config} from '../server/config.js';import {openDatabase} from '../server/db.js';import {createHash} from 'node:crypto';
const lead={name:'Fixture',company:'Example',email:'test@example.com',phone:'',interest:'Product demonstration',message:'',contact:'email',consent:true};
test('phone/interest/proxy reject malformed input; migration preserves source default',()=>{
 assert.throws(()=>validateLead({...lead,phone:'not-a-phone'}));assert.throws(()=>validateLead({...lead,interest:'invented interest'}));assert.throws(()=>config({TRUST_PROXY:'-1'}));
 assert.equal(validateLead({...lead,phone:'+91 98112 50806'}).phone,'+91 98112 50806');
 const db=openDatabase(':memory:');assert.ok(db.prepare('PRAGMA table_info(leads)').all().some(c=>c.name==='source'));db.close();
});
test('owner POST filters and exports need session+CSRF; sorting and source are preserved',async t=>{
 const db=openDatabase(':memory:'),cfg=config({}),server=createApp(db,cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.close();db.close();});
 const base='http://127.0.0.1:'+server.address().port,headers={Origin:cfg.site,'Content-Type':'application/json'};
 const post=(route,body,h={})=>fetch(base+route,{method:'POST',headers:{...headers,...h},body:JSON.stringify(body)});
 assert.equal((await post('/api/owner/leads/query',{})).status,401);assert.equal((await post('/api/owner/export',{})).status,401);
 await post('/api/leads',{...lead,source:'/contact?private=secret'});assert.equal(db.prepare('SELECT source FROM leads').get().source,'/contact');
 db.prepare('INSERT INTO owners VALUES(?,?,?)').run('one','fixture@example.com','unused');db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(createHash('sha256').update('fixture').digest('hex'),'one','csrf',Date.now()+60000);
 const h={Cookie:'evms_owner=fixture','X-CSRF-Token':'csrf'};
 assert.equal((await post('/api/owner/leads/query',{}, {Cookie:h.Cookie})).status,403);
 assert.equal((await post('/api/owner/leads/query',{sort:'toString'},h)).status,400);
 const rows=await (await post('/api/owner/leads/query',{q:'Fixture',sort:'oldest'},h)).json();assert.equal(rows.count,1);
 assert.equal((await post('/api/owner/export',{format:'csv'},h)).status,200);
 for(const day of ['2026-02-30','2099-01-01','bad'])assert.equal((await post('/api/owner/reports',{day},h)).status,422);
 for(const path of ['/.env','/content/company.json','/../server/config.js','/data/website.sqlite'])assert.equal((await fetch(base+path)).status,404);
 const home=await fetch(base);assert.match(home.headers.get('content-security-policy'),/sha256-/);assert.equal(home.headers.get('cache-control'),'no-store');
});
