import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import bcrypt from 'bcryptjs';import {randomBytes} from 'node:crypto';
import {config} from '../server/config.js';import {openDatabase} from '../server/db.js';import {createApp,validateLead} from '../server/app.js';import {releaseResolver} from '../server/releases.js';import {csv,xlsx,reportService,yesterday} from '../server/reports.js';import {syncSheet} from '../server/sheets.js';import ExcelJS from 'exceljs';
const body={name:'Test Person',company:'Example',email:'test@example.com',phone:'',interest:'Product demonstration',message:'Please contact me.',contact:'email',consent:true};
const cfg=()=>config({PUBLIC_SITE_URL:'http://localhost:4100',REPORT_TIMEZONE:'Asia/Kolkata',REPORT_HOUR:'0'});
async function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'evms-site-')),file=path.join(dir,'test.sqlite'),db=openDatabase(file);const app=createApp(db,cfg(),{resolveRelease:async()=>({unavailable:true})});const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});t.after(()=>{server.close();db.close();fs.rmSync(dir,{recursive:true,force:true});});const url='http://127.0.0.1:'+server.address().port;const request=(route,method='GET',value,headers={})=>fetch(url+route,{method,headers:{Origin:'http://localhost:4100','Content-Type':'application/json',...headers},...(value?{body:JSON.stringify(value)}:{})});return{db,request,file};}
test('lead persistence, duplicate protection, SQL/XSS rejection, private data and owner lifecycle',async t=>{
 const {db,request,file}=await fixture(t);let r=await request('/api/leads','POST',body);assert.equal(r.status,201);assert.equal((await r.json()).saved,true);
 const reopened=openDatabase(file);assert.equal(reopened.prepare('SELECT COUNT(*) n FROM leads').get().n,1);reopened.close();
 assert.equal((await request('/api/leads','POST',body)).status,200);assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,1);
 assert.equal((await request('/api/leads','POST',{...body,email:'bad'})).status,422);
 assert.equal((await request('/api/leads','POST',{...body,name:'<script>alert(1)</script>'})).status,422);
 assert.equal((await request('/api/leads','POST',{...body,name:"Robert'); DROP TABLE leads;--",email:'other@example.com'})).status,201);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,2);
 const ids=db.prepare('SELECT id FROM leads').all();for(const id of ids){assert.equal((await request('/api/owner/leads/'+id.id)).status,401);}
 assert.equal((await request('/api/owner/export?format=xlsx')).status,401);assert.equal((await request('/data/website.sqlite')).status,404);
 assert.equal((await request('/api/leads','POST',body,{Origin:'https://evil.example'})).status,403);
 const password=randomBytes(24).toString('hex');db.prepare('INSERT INTO owners VALUES(?,?,?)').run('owner','owner@example.com',await bcrypt.hash(password,4));
 assert.equal((await request('/api/owner/login','POST',{email:'owner@example.com',password:'wrong'})).status,401);
 r=await request('/api/owner/login','POST',{email:'owner@example.com',password});assert.equal(r.status,200);
 const cookie=r.headers.get('set-cookie').split(';')[0],session=await r.json();assert.match(r.headers.get('set-cookie'),/HttpOnly/);
 r=await request('/api/owner/leads');assert.equal(r.status,401);
 const headers={Cookie:cookie,'X-CSRF-Token':session.csrf};
 assert.equal((await request('/api/owner/leads','GET',null,headers)).status,200);
 for(const route of ['/api/owner/overview','/api/owner/trials','/api/owner/licenses','/api/owner/audit','/api/owner/settings','/api/owner/company']){
  const protectedResponse=await request(route,'GET',null,headers);assert.equal(protectedResponse.status,200,route);
 }
 const overview=await (await request('/api/owner/overview','GET',null,headers)).json();assert.equal(overview.metrics.demoLeads,2);assert.equal(overview.runtimeLicenseStatus,'NOT_CONNECTED');
 const auditRows=await (await request('/api/owner/audit','GET',null,headers)).json();assert.ok(auditRows.rows.some(row=>row.action==='demo.request.created'&&row.result==='SUCCESS'));
 assert.equal((await request('/api/owner/leads/'+ids[0].id,'PATCH',{status:'contacted'},{Cookie:cookie})).status,403);
 assert.equal((await request('/api/owner/leads/'+ids[0].id,'PATCH',{status:'contacted'},headers)).status,200);
 r=await request('/api/owner/export?format=xlsx','GET',null,headers);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await r.arrayBuffer()));assert.equal(book.worksheets[0].rowCount,3);
 assert.equal((await request('/api/owner/leads?q=%27%20OR%201%3D1--','GET',null,headers)).status,200);
 assert.equal((await request('/api/owner/logout','POST',{},headers)).status,200);assert.equal((await request('/api/owner/me','GET',null,headers)).status,401);
});
test('validation, oversized requests, throttling and expired sessions',async t=>{
 assert.throws(()=>validateLead({...body,consent:false}));assert.throws(()=>validateLead({...body,name:''}));assert.throws(()=>validateLead({...body,message:'x'.repeat(2001)}));
 const {request}=await fixture(t);
 assert.equal((await request('/api/leads','POST',{...body,message:'x'.repeat(20000)})).status,413);
 for(let i=0;i<5;i++)await request('/api/leads','POST',body);
 assert.equal((await request('/api/leads','POST',body)).status,429);
 for(let i=0;i<8;i++)await request('/api/owner/login','POST',{email:'none@example.com',password:'incorrect'});
 assert.equal((await request('/api/owner/login','POST',{email:'none@example.com',password:'incorrect'})).status,429);
 assert.equal((await request('/api/owner/reports')).status,401);
});
test('database failure never claims lead saved',async t=>{const {request,db}=await fixture(t);db.exec('DROP TABLE sheets_jobs');const r=await request('/api/leads','POST',body);assert.equal(r.status,500);assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,0);});
test('release caching, stale identity, asset validation and token isolation',async()=>{
 const db=openDatabase(':memory:'),c=cfg();c.githubToken='test-only-token';let calls=0;const raw={tag_name:'v1.1.0',published_at:'2026-09-01T00:00:00Z',html_url:'https://github.com/'+c.repo+'/releases/tag/v1.1.0',assets:[{id:1,name:'E-VMS-Pro-1.1.0-Windows-x64.exe',state:'uploaded',size:1234,browser_download_url:'https://github.com/'+c.repo+'/releases/download/v1.1.0/E-VMS-Pro-1.1.0-Windows-x64.exe'}]};
 const resolve=releaseResolver(db,c,async(_u,o)=>{calls++;assert.equal(o.headers.Authorization,'Bearer test-only-token');return{ok:true,json:async()=>raw};});
 assert.equal((await resolve()).tag,'v1.1.0');assert.equal((await resolve()).stale,false);assert.equal(calls,1);assert.ok(!JSON.stringify(await resolve()).includes(c.githubToken));
 db.prepare('UPDATE release_cache SET checked=?').run(Date.now()-700000);assert.equal((await releaseResolver(db,c,async()=>{throw Error();})()).stale,true);
 db.prepare('UPDATE release_cache SET checked=?').run(Date.now()-90000000);assert.equal((await releaseResolver(db,c,async()=>{throw Error();})()).stale,true);
 db.exec('DELETE FROM release_cache');assert.equal((await releaseResolver(db,c,async()=>({ok:true,json:async()=>({...raw,prerelease:true})}))()).unavailable,true);db.close();
});
test('export formulas are text and report failures preserve leads',async()=>{
 assert.match(csv([{name:'=HYPERLINK("bad")'}]),/'=HYPERLINK/);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await xlsx([{name:'=1+1'}]));assert.equal(book.worksheets[0].getCell('B2').value,"'=1+1");
 const db=openDatabase(':memory:'),c=cfg();db.prepare('INSERT INTO reports(day) VALUES(?)').run(yesterday(c.timezone));
 await reportService(db,c).run();assert.equal(db.prepare('SELECT status FROM reports').get().status,'configuration_required');
 c.smtp.host='fixture';c.emailFrom='sales@example.com';db.exec('UPDATE reports SET next_attempt=0');
 await reportService(db,c,{mailer:async()=>{throw Error('fixture outage');}}).run();assert.equal(db.prepare('SELECT status FROM reports').get().status,'failed');
 db.exec('UPDATE reports SET next_attempt=0');let delivered=0;await reportService(db,c,{mailer:async m=>{delivered++;assert.equal(m.to,c.recipient);assert.ok(m.attachments[0].content);}}).run();assert.equal(delivered,1);assert.equal(db.prepare('SELECT status FROM reports').get().status,'accepted');db.close();
});
test('Sheets refuses public sharing and retries the same reserved row',async()=>{
 const c=cfg();c.sheets.id='fixture';const urls=[],options={getToken:async()=>({token:'fixture'}),fetcher:async(u)=>{urls.push(u);return{ok:true,json:async()=>({permissions:[{type:'user'}]})};}};
 await syncSheet(c,{row_number:2},{id:'one'},options);await syncSheet(c,{row_number:2},{id:'one'},options);assert.equal(urls[1],urls[3]);assert.match(urls[1],/valueInputOption=RAW/);
 await assert.rejects(()=>syncSheet(c,{row_number:2},{id:'one'},{...options,fetcher:async()=>({ok:true,json:async()=>({permissions:[{type:'anyone'}]})})}));
});
test('production origins and HTTPS fail closed',()=>{
 assert.throws(()=>config({NODE_ENV:'production',PUBLIC_SITE_URL:'http://example.com'}));
 assert.throws(()=>config({COOKIE_SAME_SITE:'none'}));
 assert.throws(()=>config({NODE_ENV:'production',PUBLIC_SITE_URL:'https://example.com',CORE_LICENSE_REGISTRATION_URL:'http://core.example.com/api/license/register-website-trial'}));
 assert.equal(config({NODE_ENV:'production',PUBLIC_SITE_URL:'https://example.com',PORT:'6200',API_BASE_URL:'https://api.example.com',CORE_LICENSE_REGISTRATION_URL:'https://core.example.com/api/license/register-website-trial'}).port,6200);
});

test('expired owner sessions and unknown IDs remain private',async t=>{
 const {db,request}=await fixture(t);
 const {createHash}=await import('node:crypto');const token='fixture-token';
 db.prepare('INSERT INTO owners VALUES(?,?,?)').run('owner','owner@example.com','unused');
 db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(createHash('sha256').update(token).digest('hex'),'owner','csrf',Date.now()-1);
 assert.equal((await request('/api/owner/me','GET',null,{Cookie:'evms_owner='+token})).status,401);
 assert.equal((await request('/api/owner/leads/nonexistent','GET',null,{Cookie:'evms_owner='+token})).status,401);
});
test('reports preserve existing leads when provider fails and succeeds',async t=>{
 const {db,request}=await fixture(t);await request('/api/leads','POST',body);
 const day=db.prepare('SELECT day FROM leads').get().day;db.prepare('INSERT INTO reports(day) VALUES(?)').run(day);
 const c=cfg();c.smtp.host='fixture';c.emailFrom='sales@example.com';
 await reportService(db,c,{mailer:async()=>{throw Error('offline');}}).run();
 assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,1);
 db.exec('UPDATE reports SET next_attempt=0');await reportService(db,c,{mailer:async()=>{}}).run();
 assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,1);
});
test('private asset redirects never receive the GitHub token',async()=>{
 const {proxyInstaller}=await import('../server/download.js');const {PassThrough}=await import('node:stream');
 const stream=new PassThrough();stream.attachment=()=>stream;stream.type=()=>stream;stream.set=()=>stream;
 const chunks=[];stream.on('data',c=>chunks.push(c));const c=cfg();c.githubToken='fixture-secret';const calls=[];
 await proxyInstaller(stream,c,{id:42,name:'E-VMS-Pro-1.1.0-Windows-x64.exe'},async(url,options)=>{calls.push({url:String(url),options});return calls.length===1?new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/test'}}):new Response('fixture bytes');});
 assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-secret');assert.equal(calls[1].options.headers,undefined);assert.equal(Buffer.concat(chunks).toString(),'fixture bytes');
 const blocked=new PassThrough();await assert.rejects(()=>proxyInstaller(blocked,c,{id:42,name:'fixture.exe'},async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})));
});
