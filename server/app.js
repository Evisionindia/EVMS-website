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
import nodemailer from 'nodemailer';
import {activationHash,certificatePdf,hash as licenseHash,loadSigner,openActivationCode,sealActivationCode,signedTrial,verificationCode} from './license.js';
import {createCoreLicenseRegistrar} from './core-license.js';
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
export function createApp(db,cfg,{resolveRelease,trialMailer,trialRegistrar}={}){
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
 app.get('/api/config',(_req,res)=>res.json({apiBase:cfg.api,site:cfg.site,product:'E-VMS'}));
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
   audit(db,null,'demo.request.created',id,{contextId:id});
  })();
  res.status(201).json({saved:true,message:'Your request has been saved. Our team can contact you using the details provided.'});
 });
 const sendTrialMail=trialMailer||(async message=>{
  if(!cfg.smtp.host||!cfg.emailFrom)throw Error('EMAIL_CONFIGURATION_REQUIRED');
  const transport=nodemailer.createTransport({...cfg.smtp,requireTLS:!cfg.smtp.secure,disableFileAccess:true,disableUrlAccess:true,connectionTimeout:10000,socketTimeout:15000});
  try{const result=await transport.sendMail(message);if(!result.accepted?.length)throw Error('EMAIL_NOT_ACCEPTED');return result;}finally{transport.close();}
 });
 const registerTrial=trialRegistrar||createCoreLicenseRegistrar(cfg);
 const trialReady=()=>Boolean(cfg.trial.configured&&(trialRegistrar||cfg.trial.coreConfigured)&&cfg.smtp.host&&cfg.emailFrom);
 const trialInput=body=>{
  const text=(key,max)=>{const value=String(body[key]||'').trim();if(!value||value.length>max||/[<>]/.test(value))throw Error(`Check ${key.replace('_',' ')}.`);return value;};
  const data={first_name:text('first_name',80),last_name:text('last_name',80),email:text('email',254).toLowerCase(),company:text('company',150),country:text('country',80),intended_usage:text('intended_usage',500),camera_requirement:Number(body.camera_requirement)};
  if(!/^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(data.email))throw Error('Enter a valid work email.');
  if(!Number.isInteger(data.camera_requirement)||data.camera_requirement<1||data.camera_requirement>100000)throw Error('Check camera requirement.');
  if(body.consent!==true)throw Error('Accept the trial and privacy notice.');
  return data;
 };
 app.get('/api/trials/config',(_req,res)=>res.status(trialReady()?200:503).json({available:trialReady(),reason:!cfg.trial.configured?'TRIAL_SIGNING_POLICY_OR_SECRET_CONFIGURATION_REQUIRED':!(trialRegistrar||cfg.trial.coreConfigured)?'CORE_LICENSE_REGISTRATION_REQUIRED':!(cfg.smtp.host&&cfg.emailFrom)?'EMAIL_CONFIGURATION_REQUIRED':null}));
 app.post('/api/trials/request',limit('trial-request',5,3600000),async(req,res)=>{
  if(!cfg.trial.configured)return res.status(503).json({error:'Trial issuance policy or signing is not configured.'});
  if(!(trialRegistrar||cfg.trial.coreConfigured))return res.status(503).json({error:'Authoritative E-VMS trial registration is not configured.'});
  if(!cfg.smtp.host||!cfg.emailFrom)return res.status(503).json({error:'Trial verification email is not configured.'});
  if(req.body.website)return res.status(400).json({error:'Unable to accept this submission.'});
  let data;try{data=trialInput(req.body);loadSigner(cfg);}catch(error){return res.status(error.message.startsWith('Check')||/valid|Accept/.test(error.message)?422:503).json({error:error.message==='TRIAL_SIGNING_NOT_CONFIGURED'?'Trial signing is not configured.':error.message});}
  const emailHash=licenseHash(data.email),now=Date.now(),existing=db.prepare('SELECT * FROM trial_requests WHERE email_hash=?').get(emailHash);
  if(existing?.state==='ISSUED')return res.status(409).json({error:'A trial has already been issued for this verified email.'});
  if(existing&&existing.resend_after>now)return res.status(429).json({error:'A verification code was sent recently. Please wait before requesting another.',retryAfter:Math.ceil((existing.resend_after-now)/1000)});
  const id=existing?.id||randomUUID(),code=verificationCode(),codeHash=licenseHash(`${id}:${code}`),expires=now+cfg.trial.verificationMinutes*60000,resend=now+cfg.trial.resendSeconds*1000,stamp=new Date(now).toISOString();
  db.prepare(`INSERT INTO trial_requests(id,created_at,updated_at,first_name,last_name,email,email_hash,company,country,camera_requirement,intended_usage,consent,verification_hash,verification_expires,resend_after,attempts,state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(email_hash) DO UPDATE SET updated_at=excluded.updated_at,first_name=excluded.first_name,last_name=excluded.last_name,company=excluded.company,country=excluded.country,camera_requirement=excluded.camera_requirement,intended_usage=excluded.intended_usage,verification_hash=excluded.verification_hash,verification_expires=excluded.verification_expires,resend_after=excluded.resend_after,attempts=0,state='EMAIL_PENDING',last_error=NULL`).run(id,stamp,stamp,data.first_name,data.last_name,data.email,emailHash,data.company,data.country,data.camera_requirement,data.intended_usage,1,codeHash,expires,resend,0,'EMAIL_PENDING');
  try{
   await sendTrialMail({from:cfg.emailFrom,to:data.email,subject:'Verify your E-VMS trial request',text:`Your E-VMS verification code is ${code}. It expires in ${cfg.trial.verificationMinutes} minutes. If you did not request this, ignore this email.`});
   db.prepare("UPDATE trial_requests SET state='VERIFICATION_PENDING',last_error=NULL WHERE id=?").run(id);audit(db,null,'trial.verification.provider_accepted',id);
   return res.status(202).json({requestId:id,verificationRequired:true,message:'The email provider accepted the verification message.'});
  }catch(error){db.prepare("UPDATE trial_requests SET state='EMAIL_FAILED',last_error='PROVIDER_FAILED' WHERE id=?").run(id);audit(db,null,'trial.verification.provider_failed',id);return res.status(502).json({error:'The verification email provider did not accept the message. No trial was issued.'});}
 });
 app.post('/api/trials/verify',limit('trial-verify',10,900000),async(req,res)=>{
  const requestId=String(req.body.request_id||'');const code=String(req.body.code||'').replace(/\D/g,'');
  if(!/^[0-9a-f-]{36}$/i.test(requestId)||!/^[0-9]{6}$/.test(code))return res.status(422).json({error:'Enter the request ID and six-digit verification code.'});
  const row=db.prepare('SELECT * FROM trial_requests WHERE id=?').get(requestId);if(!row)return res.status(404).json({error:'Trial request not found.'});
  if(row.state==='ISSUED')return res.status(409).json({error:'This trial request was already issued.'});
  if(row.attempts>=5)return res.status(429).json({error:'Verification is locked after too many failed attempts.'});
  if(row.verification_expires<Date.now()){db.prepare("UPDATE trial_requests SET state='EXPIRED' WHERE id=?").run(requestId);return res.status(410).json({error:'Verification code expired. Request a new code.'});}
  if(row.verification_hash!==licenseHash(`${requestId}:${code}`)){db.prepare('UPDATE trial_requests SET attempts=attempts+1,last_error=? WHERE id=?').run('INVALID_CODE',requestId);return res.status(422).json({error:'Verification code is incorrect.'});}
  let license=db.prepare('SELECT * FROM trial_licenses WHERE request_id=?').get(requestId),issued;
  if(!license){
   try{issued=signedTrial(cfg,row);}catch(error){db.prepare('UPDATE trial_requests SET last_error=? WHERE id=?').run(error.message,requestId);return res.status(503).json({error:'Trial signing is unavailable.'});}
   const downloadToken=randomBytes(32).toString('base64url'),downloadHash=licenseHash(downloadToken),stamp=new Date().toISOString(),pdf=certificatePdf({licenseId:issued.licenseId,customer:`${row.first_name} ${row.last_name}`,company:row.company,issuedAt:stamp,expiryDate:issued.expiry.toISOString(),maxCameras:cfg.trial.maxCameras,activationCode:issued.code,checksum:issued.checksum});
   try{db.transaction(()=>{db.prepare('INSERT INTO trial_licenses(license_id,request_id,email_hash,artifact,artifact_checksum,activation_code_hash,activation_code_encrypted,certificate_pdf,issued_at,expires_at,download_token_hash,download_expires,delivery_state,core_registration_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(issued.licenseId,requestId,row.email_hash,issued.artifact,issued.checksum,activationHash(issued.code),sealActivationCode(cfg,issued.code),pdf,stamp,issued.expiry.toISOString(),downloadHash,Date.now()+cfg.trial.downloadHours*3600000,'NOT_READY','PENDING');db.prepare("UPDATE trial_requests SET state='CORE_REGISTRATION_PENDING',verified_at=COALESCE(verified_at,?),license_id=?,last_error=NULL WHERE id=? AND state!='ISSUED'").run(stamp,issued.licenseId,requestId);})()}catch(error){if(!String(error.code).includes('CONSTRAINT'))return res.status(500).json({error:'Trial issuance could not be prepared.'});}
   license=db.prepare('SELECT * FROM trial_licenses WHERE request_id=?').get(requestId);
  }
  if(!license)return res.status(500).json({error:'Trial issuance could not be prepared.'});
  let activationCode;try{activationCode=openActivationCode(cfg,license.activation_code_encrypted);}catch{db.prepare("UPDATE trial_requests SET state='CORE_REGISTRATION_FAILED',last_error='ACTIVATION_SECRET_UNAVAILABLE' WHERE id=?").run(requestId);return res.status(503).json({error:'Trial recovery material is unavailable. Contact support with the request ID.'});}
  let registration;
  try{
   db.prepare('UPDATE trial_licenses SET registration_attempts=registration_attempts+1,core_registration_state=? WHERE license_id=?').run('REGISTERING',license.license_id);
   registration=await registerTrial({artifact:license.artifact,checksum:license.artifact_checksum,requestId});
   if(registration.license_id!==license.license_id||String(registration.artifact_checksum).toLowerCase()!==license.artifact_checksum.toLowerCase())throw Object.assign(Error('CORE_REGISTRATION_IDENTITY_MISMATCH'),{retryable:false});
   const registeredAt=new Date().toISOString();db.transaction(()=>{db.prepare("UPDATE trial_licenses SET core_registration_state='REGISTERED',core_registered_at=?,last_error=NULL WHERE license_id=?").run(registeredAt,license.license_id);db.prepare("UPDATE trial_requests SET state='DELIVERY_PENDING',last_error=NULL WHERE id=?").run(requestId);audit(db,null,'trial.core.registered',license.license_id,{contextId:requestId});})();
  }catch(error){db.transaction(()=>{db.prepare("UPDATE trial_licenses SET core_registration_state='FAILED',last_error='CORE_REGISTRATION_FAILED' WHERE license_id=?").run(license.license_id);db.prepare("UPDATE trial_requests SET state='CORE_REGISTRATION_FAILED',last_error='CORE_REGISTRATION_FAILED' WHERE id=?").run(requestId);audit(db,null,'trial.core.registration_failed',license.license_id,{result:'FAILED',contextId:requestId});})();return res.status(502).json({error:'The authoritative E-VMS license registry did not confirm this trial. No trial was reported as issued.',requestId});}
  const claim=db.prepare("UPDATE trial_licenses SET delivery_state='EMAIL_SENDING' WHERE license_id=? AND delivery_state='NOT_READY'").run(license.license_id);
  if(claim.changes!==1)return res.status(409).json({error:'Trial delivery is already in progress or requires redelivery.',requestId});
  const downloadTokenPlain=randomBytes(32).toString('base64url'),downloadUrl=`${cfg.site}/api/trials/download/${downloadTokenPlain}`;
  db.prepare('UPDATE trial_licenses SET download_token_hash=?,download_expires=?,download_count=0 WHERE license_id=?').run(licenseHash(downloadTokenPlain),Date.now()+cfg.trial.downloadHours*3600000,license.license_id);
  try{
   await sendTrialMail({from:cfg.emailFrom,to:row.email,subject:'Your E-VMS trial license',text:`YOUR E-VMS BETA TRIAL IS READY\n\nLicense ID: ${license.license_id}\nEdition: E-VMS Pro (CLIENT)\nLicense type: TRIAL\nTrial expiry: ${license.expires_at}\nSecure license download: ${downloadUrl}\nActivation reference: ${activationCode}\n\nDownload E-VMS Pro: ${cfg.site}/downloads\nInstallation and activation guide: ${cfg.site}/workflow\nGetting started and support: ${cfg.site}/contact\n\nThe attached signed .evms-license artifact is authoritative. The website does not report runtime activation; activate it inside E-VMS Pro.`,attachments:[{filename:`E-VMS-Trial-${license.license_id}.evms-license`,content:license.artifact,contentType:'application/vnd.evision.e-vms-license+json'},{filename:`E-VMS-Trial-${license.license_id}-Certificate.pdf`,content:license.certificate_pdf,contentType:'application/pdf'}]});
   db.transaction(()=>{db.prepare("UPDATE trial_licenses SET delivery_state='EMAIL_ACCEPTED',last_error=NULL WHERE license_id=?").run(license.license_id);db.prepare("UPDATE trial_requests SET state='ISSUED',last_error=NULL WHERE id=?").run(requestId);audit(db,null,'trial.license.provider_accepted',license.license_id,{contextId:requestId});})();
   return res.status(201).json({issued:true,licenseId:license.license_id,registration:'REGISTERED',runtimeState:'NOT_ACTIVATED',delivery:'EMAIL_ACCEPTED',downloadUrl,expiresAt:license.expires_at});
  }catch(error){db.transaction(()=>{db.prepare("UPDATE trial_licenses SET delivery_state='EMAIL_FAILED',last_error='PROVIDER_FAILED' WHERE license_id=?").run(license.license_id);db.prepare("UPDATE trial_requests SET state='DELIVERY_FAILED',last_error='PROVIDER_FAILED' WHERE id=?").run(requestId);audit(db,null,'trial.license.provider_failed',license.license_id,{result:'FAILED',contextId:requestId});})();return res.status(502).json({error:'The trial is registered, but the email provider did not accept delivery. Contact support with the request ID.',requestId});}
 });
 app.get('/api/trials/download/:token',limit('trial-download',12,3600000),(req,res)=>{
  const token=String(req.params.token||'');if(!/^[A-Za-z0-9_-]{40,80}$/.test(token))return res.status(404).json({error:'Trial download not found.'});
  const row=db.prepare("SELECT * FROM trial_licenses WHERE download_token_hash=? AND delivery_state='EMAIL_ACCEPTED' AND core_registration_state='REGISTERED'").get(licenseHash(token));
  if(!row||row.download_expires<Date.now()||row.download_count>=3)return res.status(410).json({error:'Trial download is expired or unavailable.'});
  db.prepare('UPDATE trial_licenses SET download_count=download_count+1 WHERE license_id=?').run(row.license_id);audit(db,null,'trial.license.downloaded',row.license_id);
  res.setHeader('Content-Type','application/vnd.evision.e-vms-license+json');res.setHeader('Content-Disposition',`attachment; filename="E-VMS-Trial-${row.license_id}.evms-license"`);res.setHeader('X-Content-SHA256',row.artifact_checksum);return res.send(row.artifact);
 });
 app.post('/api/trials/redeliver',limit('trial-redeliver',5,3600000),async(req,res)=>{
  const requestId=String(req.body.request_id||''),email=String(req.body.email||'').trim().toLowerCase();
  if(!/^[0-9a-f-]{36}$/i.test(requestId)||!/^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(email))return res.status(422).json({error:'Enter the original request ID and verified email.'});
  const row=db.prepare('SELECT tr.email,tr.email_hash,tl.* FROM trial_requests tr JOIN trial_licenses tl ON tl.request_id=tr.id WHERE tr.id=? AND tr.email_hash=?').get(requestId,licenseHash(email));
  if(!row)return res.status(404).json({error:'Issued trial not found.'});
  if(row.core_registration_state!=='REGISTERED')return res.status(409).json({error:'The authoritative E-VMS registry has not confirmed this trial.'});
  if(row.delivery_state==='EMAIL_ACCEPTED')return res.status(409).json({error:'This trial was already accepted by the email provider. Use the link in that message.'});
  const downloadToken=randomBytes(32).toString('base64url'),downloadUrl=`${cfg.site}/api/trials/download/${downloadToken}`;
  const claimed=db.prepare("UPDATE trial_licenses SET download_token_hash=?,download_expires=?,download_count=0,delivery_state='EMAIL_SENDING',last_error=NULL WHERE license_id=? AND delivery_state='EMAIL_FAILED'").run(licenseHash(downloadToken),Date.now()+cfg.trial.downloadHours*3600000,row.license_id);
  if(claimed.changes!==1)return res.status(409).json({error:'Trial redelivery is already in progress. Retry later.'});
  try{
   const activationCode=openActivationCode(cfg,row.activation_code_encrypted);
   await sendTrialMail({from:cfg.emailFrom,to:row.email,subject:'Your E-VMS trial license',text:`YOUR E-VMS BETA TRIAL IS READY\n\nLicense ID: ${row.license_id}\nEdition: E-VMS Pro (CLIENT)\nLicense type: TRIAL\nTrial expiry: ${row.expires_at}\nSecure license download: ${downloadUrl}\nActivation reference: ${activationCode}\n\nDownload E-VMS Pro: ${cfg.site}/downloads\nInstallation and activation guide: ${cfg.site}/workflow\nGetting started and support: ${cfg.site}/contact\n\nThe attached signed .evms-license artifact is authoritative. The website does not report runtime activation; activate it inside E-VMS Pro.`,attachments:[{filename:`E-VMS-Trial-${row.license_id}.evms-license`,content:row.artifact,contentType:'application/vnd.evision.e-vms-license+json'},{filename:`E-VMS-Trial-${row.license_id}-Certificate.pdf`,content:row.certificate_pdf,contentType:'application/pdf'}]});
   db.transaction(()=>{db.prepare("UPDATE trial_licenses SET delivery_state='EMAIL_ACCEPTED',last_error=NULL WHERE license_id=? AND delivery_state='EMAIL_SENDING'").run(row.license_id);db.prepare("UPDATE trial_requests SET state='ISSUED',last_error=NULL WHERE id=?").run(requestId);audit(db,null,'trial.license.redelivery_accepted',row.license_id,{contextId:requestId});})();
   return res.json({delivered:true,delivery:'EMAIL_ACCEPTED',downloadUrl});
  }catch{db.prepare("UPDATE trial_licenses SET delivery_state='EMAIL_FAILED',last_error='PROVIDER_FAILED' WHERE license_id=? AND delivery_state='EMAIL_SENDING'").run(row.license_id);audit(db,null,'trial.license.redelivery_failed',row.license_id);return res.status(502).json({error:'The email provider did not accept redelivery. Retry later or contact support with the request ID.'});}
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
 app.get('/api/owner/overview',owner,(req,res)=>{
  const now=new Date().toISOString(),soon=new Date(Date.now()+30*86400000).toISOString();
  const metrics={
   demoLeads:db.prepare('SELECT COUNT(*) n FROM leads').get().n,
   trialRequests:db.prepare('SELECT COUNT(*) n FROM trial_requests').get().n,
   issuedTrials:db.prepare("SELECT COUNT(*) n FROM trial_licenses WHERE core_registration_state='REGISTERED' AND delivery_state='EMAIL_ACCEPTED'").get().n,
   expiringTrials:db.prepare('SELECT COUNT(*) n FROM trial_licenses WHERE expires_at>? AND expires_at<=?').get(now,soon).n,
   expiredTrials:db.prepare('SELECT COUNT(*) n FROM trial_licenses WHERE expires_at<=?').get(now).n
  };
  const recent=db.prepare('SELECT at,owner_id,action,target,result,context_id FROM audit ORDER BY id DESC LIMIT 12').all();
  res.json({metrics,recent,runtimeLicenseStatus:'NOT_CONNECTED'});
 });
 app.get('/api/owner/trials',owner,(req,res)=>{
  const state=String(req.query.state||'').trim(),q=String(req.query.q||'').trim().toLowerCase();
  if(state&&!['EMAIL_PENDING','VERIFICATION_PENDING','EMAIL_FAILED','EXPIRED','CORE_REGISTRATION_PENDING','CORE_REGISTRATION_FAILED','DELIVERY_PENDING','DELIVERY_FAILED','ISSUED'].includes(state))return res.status(422).json({error:'Invalid trial state.'});
  const where=[],args=[];if(state){where.push('tr.state=?');args.push(state);}if(q){where.push('(LOWER(tr.email) LIKE ? OR LOWER(tr.company) LIKE ? OR LOWER(tr.first_name||\' \'||tr.last_name) LIKE ? OR LOWER(COALESCE(tr.license_id,\'\')) LIKE ?)');args.push(...Array(4).fill(`%${q}%`));}
  const rows=db.prepare(`SELECT tr.id request_id,tr.first_name||' '||tr.last_name applicant,tr.email,tr.company,tr.camera_requirement,tr.state request_state,tr.verified_at,tr.license_id,tr.created_at,tr.updated_at,tr.last_error,tl.issued_at,tl.expires_at,tl.delivery_state,tl.core_registration_state,tl.core_registered_at,tl.registration_attempts,tl.download_count,tl.artifact_checksum FROM trial_requests tr LEFT JOIN trial_licenses tl ON tl.request_id=tr.id ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY tr.updated_at DESC LIMIT 500`).all(...args);
  audit(db,req.owner.owner_id,'trials.list');res.json({rows});
 });
 app.get('/api/owner/licenses',owner,(req,res)=>{
  const now=new Date().toISOString();
  const rows=db.prepare(`SELECT tl.license_id,tr.first_name||' '||tr.last_name customer,tr.company,'CLIENT' edition,'TRIAL' type,'2' version,tl.issued_at,tl.expires_at,tl.delivery_state,tl.core_registration_state,tl.core_registered_at,tl.registration_attempts,tl.download_count,tl.artifact_checksum,tr.camera_requirement requested_cameras FROM trial_licenses tl JOIN trial_requests tr ON tr.id=tl.request_id ORDER BY tl.issued_at DESC LIMIT 500`).all().map(row=>({...row,websiteStatus:row.delivery_state==='EMAIL_ACCEPTED'?'DELIVERED':row.delivery_state,coreRegistryStatus:row.core_registration_state,runtimeStatus:'NOT_CONNECTED',expiryStatus:row.expires_at<=now?'EXPIRED':'CURRENT'}));
  res.json({rows,authority:'SIGNED_ARTIFACT',runtimeActivationState:'NOT_CONNECTED'});
 });
 app.get('/api/owner/audit',owner,(req,res)=>{
  const rows=db.prepare('SELECT at,owner_id,action,target,result,context_id FROM audit ORDER BY id DESC LIMIT 500').all();
  res.json({rows});
 });
 app.get('/api/owner/settings',owner,(_req,res)=>res.json({emailConfigured:!!(cfg.smtp.host&&cfg.emailFrom),sheetsConfigured:!!(cfg.sheets.id&&cfg.sheets.email&&cfg.sheets.key),trialConfigured:!!cfg.trial.configured,coreRegistrationConfigured:!!cfg.trial.coreConfigured,releaseRepository:cfg.repo,privateReleases:!!cfg.privateReleases,timezone:cfg.timezone,retentionDays:cfg.retentionDays}));
 app.get('/api/owner/company',owner,(_req,res)=>{const company=JSON.parse(fs.readFileSync(path.join(root,'content/company.json'),'utf8'));res.json(company);});
 app.post('/api/owner/reports',owner,(req,res)=>{const day=req.body.day;if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||day>new Date().toISOString().slice(0,10))return res.status(422).json({error:'Valid report date required.'});db.prepare('INSERT OR IGNORE INTO reports(day) VALUES(?)').run(day);db.prepare("UPDATE reports SET status='pending',next_attempt=0 WHERE day=? AND status!='accepted'").run(day);audit(db,req.owner.owner_id,'report.queued',day);res.json({queued:true});});
 app.get('/robots.txt',(_req,res)=>res.type('text').send('User-agent: *\nDisallow: /owner\nDisallow: /api/\nSitemap: '+cfg.site+'/sitemap.xml'));
 app.get('/sitemap.xml',(_req,res)=>res.type('xml').send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/','/product','/workflow','/deployment','/about','/contact','/downloads','/trial','/privacy'].map(p=>'<url><loc>'+cfg.site+p+'</loc></url>').join('')+'</urlset>'));
 const publicDir=fs.existsSync(path.join(root,'dist/index.html'))?path.join(root,'dist'):path.join(root,'public');
 app.get(['/','/product','/workflow','/deployment','/about','/contact','/downloads','/trial','/owner','/privacy'],(req,res)=>{res.set('Cache-Control','no-store');if(req.path==='/owner')res.set('X-Robots-Tag','noindex, nofollow').set('Cache-Control','no-store');const page=req.path==='/'?'index.html':req.path.slice(1)+'.html';const html=fs.readFileSync(path.join(publicDir,page),'utf8').replaceAll('__SITE_URL__',cfg.site);const ld=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];if(ld){const digest=createHash('sha256').update(ld).digest('base64');res.set('Content-Security-Policy',res.get('Content-Security-Policy').replace("script-src 'self'","script-src 'self' 'sha256-"+digest+"'"));}res.type('html').send(html);});
 app.use(express.static(publicDir,{index:false,dotfiles:'deny',maxAge:0}));
 app.use((_req,res)=>res.status(404).json({error:'Not found.'}));
 app.use((err,_req,res,_next)=>{const status=err.type==='entity.too.large'?413:err.status===400?400:500;res.status(status).json({error:status===500?'Service unavailable. Please retry.':status===413?'Request too large.':'Invalid request.'});});
 return app;
}
