import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {audit} from './db.js';
import {releaseResolver,releaseCatalog} from './releases.js';
import {proxyInstaller} from './download.js';
import {csv,xlsx,dateInZone} from './reports.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=s=>createHash('sha256').update(s).digest('hex');
const fields={name:100,company:150,email:254,phone:40,interest:80,message:2000,contact:20};
export function validateLead(body){
 const data={};
 for(const [key,max] of Object.entries(fields)){
  if(typeof body[key]!=='string'||body[key].length>max)throw Error('Please check '+key+'.');
  data[key]=body[key].trim();
  if(/[<>]/.test(data[key])||[...data[key]].some(c=>c.charCodeAt(0)<9))throw Error('Use plain text in '+key+'.');
 }
 if(!data.name||!data.company||!data.interest||!/^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(data.email))throw Error('Name, company, interest and a valid email are required.');
 if(!['email','phone'].includes(data.contact)||data.contact==='phone'&&!data.phone)throw Error('Check preferred contact method.');
 if(data.phone&&(!/^[+()0-9 .-]{7,40}$/.test(data.phone)||data.phone.replace(/\D/g,'').length<7||data.phone.replace(/\D/g,'').length>15))throw Error('Please enter a valid phone number.');
 if(!['Product demonstration','Camera organization','Recording and playback','Deployment discussion'].includes(data.interest))throw Error('Choose an available product interest.');
 if(body.consent!==true)throw Error('Please acknowledge the contact and privacy notice.');
 data.email=data.email.toLowerCase();return data;
}
export function createApp(db,cfg,{resolveRelease}={}){
 const app=express();app.disable('x-powered-by');app.set('trust proxy',cfg.trustProxy);
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'","data:"],connectSrc:["'self'",...(cfg.api?[cfg.api]:[])],upgradeInsecureRequests:cfg.production?[]:null}},strictTransportSecurity:cfg.production?undefined:false}));
 app.use((req,res,next)=>{
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  const origin=req.headers.origin;
  if(origin){if(!cfg.origins.has(origin))return res.status(403).json({error:'Origin not allowed.'});res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Credentials','true');res.vary('Origin');}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Content-Type,X-CSRF-Token');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');return res.sendStatus(204);}
  if(['POST','PATCH','DELETE','PUT'].includes(req.method)&&!cfg.origins.has(origin))return res.status(403).json({error:'Request origin required.'});
  next();
 });
 app.use(express.json({limit:'16kb'}));app.use(cookieParser());
 app.use((req,res,next)=>{if(['POST','PATCH'].includes(req.method)&&(!req.is('application/json')||!req.body||typeof req.body!=='object'||Array.isArray(req.body)))return res.status(400).json({error:'JSON object required.'});next();});
 app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 const limit=(bucket,max,windowMs)=>(req,res,next)=>{
  const key=bucket+':'+hash(req.ip||'unknown'),now=Date.now();
  const row=db.prepare('SELECT * FROM limits WHERE key=?').get(key);
  if(!row||row.expires<now)db.prepare('INSERT OR REPLACE INTO limits VALUES(?,?,?)').run(key,1,now+windowMs);
  else{if(row.count>=max){res.setHeader('Retry-After',String(Math.ceil((row.expires-now)/1000)));return res.status(429).json({error:'Too many attempts. Please try later.'});}db.prepare('UPDATE limits SET count=count+1 WHERE key=?').run(key);}
  next();
 };
 const owner=(req,res,next)=>{
  const session=req.cookies.evms_owner;
  const row=typeof session==='string'?db.prepare('SELECT s.*,o.email FROM sessions s JOIN owners o ON o.id=s.owner_id WHERE token_hash=? AND expires>?').get(hash(session),Date.now()):null;
  if(!row)return res.status(401).json({error:'Owner sign-in required.'});
  if(req.method!=='GET'&&req.headers['x-csrf-token']!==row.csrf)return res.status(403).json({error:'Session verification failed. Reload and try again.'});
  req.owner=row;next();
 };
 app.get('/health',(_req,res)=>{try{db.prepare('SELECT 1').get();res.json({alive:true,ready:true,database:true});}catch{res.status(503).json({alive:true,ready:false,database:false});}});
 app.get('/api/config',(_req,res)=>res.json({apiBase:cfg.api,site:cfg.site,product:'EVMS'}));
 app.get('/runtime-config.js',(_req,res)=>res.type('js').set('Cache-Control','no-store').send('window.EVMS_CONFIG='+JSON.stringify({apiBase:cfg.api})+';'));
 const features=JSON.parse(fs.readFileSync(path.join(root,'content/verified-features.json'),'utf8'));
 app.get('/api/features',(_req,res)=>res.json(features.filter(f=>f.public).map(({id,name,description,category,limitation})=>({id,name,description,category,limitation}))));
 const release=resolveRelease||releaseResolver(db,cfg);
 const catalog=releaseCatalog(db,cfg);
 app.get('/api/releases',limit('catalog',60,60000),async(_q,res)=>{const data=await catalog();res.status(data.unavailable?503:200).json(cfg.privateReleases&&data.releases?{...data,releases:data.releases.map(r=>({...r,assets:r.assets.map(a=>({...a,url:cfg.api+'/api/releases/download/'+a.id}))}))}:data);});
 app.get('/api/releases/latest',limit('release',60,60000),async(_req,res)=>{const data=await release();res.status(data.unavailable?503:200).json(cfg.privateReleases&&!data.unavailable?{...data,assets:data.assets.map(a=>({...a,url:cfg.api+'/api/releases/download/'+a.id}))}:data);});
 app.get('/api/releases/download/:id',limit('download',6,60000),async(req,res)=>{if(!cfg.privateReleases||!cfg.githubToken)return res.status(503).json({error:'Download configuration required.'});const data=await catalog();const asset=data.releases?.flatMap(r=>r.assets).find(a=>String(a.id)===req.params.id&&Number.isSafeInteger(a.id)&&a.id>0);if(!asset)return res.status(404).json({error:'Verified installer not found.'});try{await proxyInstaller(res,cfg,asset);}catch{if(!res.headersSent)res.status(502).json({error:'GitHub download unavailable.'});else res.destroy();}});
 app.post('/api/leads',limit('lead',5,3600000),(req,res)=>{
  if(req.body.website)return res.status(400).json({error:'Unable to accept this submission.'});
  let data;try{data=validateLead(req.body);}catch(e){return res.status(422).json({error:e.message});}
  const dedupe=hash(JSON.stringify(data)),now=new Date();
  const duplicate=db.prepare('SELECT id FROM leads WHERE dedupe=? AND submitted_at>?').get(dedupe,new Date(Date.now()-86400000).toISOString());
  if(duplicate)return res.status(200).json({saved:true,message:'Your request is already saved. Thank you.'});
  const id=randomUUID(),day=dateInZone(now,cfg.timezone);
  db.transaction(()=>{
   db.prepare('INSERT INTO leads(id,submitted_at,day,name,company,email,phone,interest,message,contact,consent,dedupe) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,now.toISOString(),day,data.name,data.company,data.email,data.phone,data.interest,data.message,data.contact,1,dedupe);
   db.prepare('UPDATE leads SET source=? WHERE id=?').run('/contact',id);
   const n=db.prepare('SELECT COALESCE(MAX(row_number),1)+1 AS n FROM sheets_jobs').get().n;
   db.prepare('INSERT INTO sheets_jobs(lead_id,row_number) VALUES(?,?)').run(id,n);
  })();
  res.status(201).json({saved:true,message:'Your request has been saved. Our team can contact you using the details provided.'});
 });
 app.post('/api/owner/login',limit('login',8,900000),async(req,res)=>{
  const {email,password}=req.body;
  if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>256)return res.status(400).json({error:'Invalid sign-in input.'});
  const row=db.prepare('SELECT * FROM owners WHERE email=?').get(email.trim().toLowerCase());
  const valid=await bcrypt.compare(password,row?.password_hash||'$2b$12$C6UzMDM.H6dfI/f/IKcEe.7w84NwBjttCpPjERHNVGM31VDfkUhO6');
  if(!row||!valid){audit(db,null,'login.failed');return res.status(401).json({error:'Email or password is incorrect.'});}
  const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex'),expires=Date.now()+cfg.sessionHours*3600000;
  if(req.cookies.evms_owner)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(req.cookies.evms_owner));
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token),row.id,csrf,expires);
  res.cookie('evms_owner',token,{httpOnly:true,secure:cfg.production,sameSite:cfg.sameSite,path:'/',maxAge:cfg.sessionHours*3600000});
  audit(db,row.id,'login.success');res.json({email:row.email,csrf,expires});
 });
 app.get('/api/owner/me',owner,(req,res)=>res.json({email:req.owner.email,csrf:req.owner.csrf,expires:req.owner.expires}));
 app.post('/api/owner/logout',owner,(req,res)=>{db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.owner.token_hash);res.clearCookie('evms_owner',{path:'/',secure:cfg.production,httpOnly:true,sameSite:cfg.sameSite});audit(db,req.owner.owner_id,'logout');res.json({ok:true});});
 const filtered=req=>{
  const input=req.method==='POST'?req.body:req.query;const q=String(input.q||'').slice(0,150),status=String(input.status||''),day=String(input.day||'');
  if(status&&!['new','contacted','qualified','closed'].includes(status)||day&&!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Object.assign(Error('Invalid filter'),{status:400});
  return {where:"WHERE (?='' OR name LIKE ? OR company LIKE ? OR email LIKE ?) AND (?='' OR status=?) AND (?='' OR day=?)",args:[q,'%'+q+'%','%'+q+'%','%'+q+'%',status,status,day,day]};
 };
 const listLeads=(req,res)=>{const input=req.method==='POST'?req.body:req.query;const sorts={newest:'submitted_at DESC',oldest:'submitted_at ASC',name:'name COLLATE NOCASE ASC'};const order=Object.hasOwn(sorts,input.sort||'newest')?sorts[input.sort||'newest']:null;if(!order)return res.status(400).json({error:'Invalid sort.'});const f=filtered(req),page=Math.max(1,Math.min(100000,Math.floor(Number(input.page)||1)));const count=db.prepare('SELECT COUNT(*) n FROM leads '+f.where).get(...f.args).n;const rows=db.prepare('SELECT id,submitted_at,name,company,email,interest,status FROM leads '+f.where+' ORDER BY '+order+' LIMIT 30 OFFSET ?').all(...f.args,(page-1)*30);audit(db,req.owner.owner_id,'leads.list');res.json({rows,count,page});};app.get('/api/owner/leads',owner,listLeads);app.post('/api/owner/leads/query',owner,listLeads);
 app.get('/api/owner/leads/:id',owner,(req,res)=>{const row=db.prepare('SELECT * FROM leads WHERE id=?').get(req.params.id);if(!row)return res.status(404).json({error:'Lead not found.'});audit(db,req.owner.owner_id,'lead.view',row.id);const {dedupe:ignored,...safe}=row;res.json(safe);});
 app.patch('/api/owner/leads/:id',owner,(req,res)=>{if(!['new','contacted','qualified','closed'].includes(req.body.status))return res.status(422).json({error:'Invalid status.'});const r=db.prepare('UPDATE leads SET status=? WHERE id=?').run(req.body.status,req.params.id);if(!r.changes)return res.status(404).json({error:'Lead not found.'});audit(db,req.owner.owner_id,'lead.status',req.params.id);res.json({ok:true});});
 const exportLeads=async(req,res)=>{
  const f=filtered(req),rows=db.prepare('SELECT * FROM leads '+f.where+' ORDER BY submitted_at LIMIT 10001').all(...f.args);
  if(rows.length>10000)return res.status(422).json({error:'Filter to at most 10,000 leads per export.'});
  const format=(req.method==='POST'?req.body.format:req.query.format)==='xlsx'?'xlsx':'csv';
  audit(db,req.owner.owner_id,'leads.export',format);
  res.attachment('evms-leads.'+format).type(format==='csv'?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(format==='csv'?csv(rows):Buffer.from(await xlsx(rows)));
 };app.get('/api/owner/export',owner,exportLeads);app.post('/api/owner/export',owner,exportLeads);
 app.get('/api/owner/reports',owner,(_req,res)=>res.json({reports:db.prepare('SELECT * FROM reports ORDER BY day DESC LIMIT 90').all(),emailConfigured:!!(cfg.smtp.host&&cfg.emailFrom),sheetsConfigured:!!(cfg.sheets.id&&cfg.sheets.email&&cfg.sheets.key),sheets:db.prepare('SELECT status,COUNT(*) count FROM sheets_jobs GROUP BY status').all(),timezone:cfg.timezone,retentionDays:cfg.retentionDays}));
 app.post('/api/owner/reports',owner,(req,res)=>{const day=req.body.day;if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||day>new Date().toISOString().slice(0,10))return res.status(422).json({error:'Valid report date required.'});db.prepare('INSERT OR IGNORE INTO reports(day) VALUES(?)').run(day);db.prepare("UPDATE reports SET status='pending',next_attempt=0 WHERE day=? AND status!='accepted'").run(day);audit(db,req.owner.owner_id,'report.queued',day);res.json({queued:true});});
 app.get('/robots.txt',(_req,res)=>res.type('text').send('User-agent: *\nDisallow: /owner\nDisallow: /api/\nSitemap: '+cfg.site+'/sitemap.xml'));
 app.get('/sitemap.xml',(_req,res)=>res.type('xml').send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/','/product','/workflow','/deployment','/about','/contact','/downloads','/privacy'].map(p=>'<url><loc>'+cfg.site+p+'</loc></url>').join('')+'</urlset>'));
 const publicDir=fs.existsSync(path.join(root,'dist/index.html'))?path.join(root,'dist'):path.join(root,'public');
 app.get(['/','/product','/workflow','/deployment','/about','/contact','/downloads','/owner','/privacy'],(req,res)=>{res.set('Cache-Control','no-store');if(req.path==='/owner')res.set('X-Robots-Tag','noindex, nofollow').set('Cache-Control','no-store');const page=req.path==='/'?'index.html':req.path.slice(1)+'.html';const html=fs.readFileSync(path.join(publicDir,page),'utf8').replaceAll('__SITE_URL__',cfg.site);const ld=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];if(ld){const digest=createHash('sha256').update(ld).digest('base64');res.set('Content-Security-Policy',res.get('Content-Security-Policy').replace("script-src 'self'","script-src 'self' 'sha256-"+digest+"'"));}res.type('html').send(html);});
 app.use(express.static(publicDir,{index:false,dotfiles:'deny',maxAge:0}));
 app.use((_req,res)=>res.status(404).json({error:'Not found.'}));
 app.use((err,_req,res,_next)=>{const status=err.type==='entity.too.large'?413:err.status===400?400:500;res.status(status).json({error:status===500?'Service unavailable. Please retry.':status===413?'Request too large.':'Invalid request.'});});
 return app;
}
