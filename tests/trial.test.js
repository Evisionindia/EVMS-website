import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createPrivateKey,createPublicKey,generateKeyPairSync,verify} from 'node:crypto';
import {config} from '../server/config.js';
import {openDatabase} from '../server/db.js';
import {createApp} from '../server/app.js';
import {activationHash,canonicalize,hash} from '../server/license.js';

const trialBody={first_name:'Test',last_name:'Operator',email:'operator@example.com',company:'Example Company',country:'India',camera_requirement:12,intended_usage:'Evaluate camera organization and playback.',consent:true};

async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'e-vms-trial-'));
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const keyPath=path.join(dir,'trial-private.pem');
 fs.writeFileSync(keyPath,privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
 const c=config({PUBLIC_SITE_URL:'http://localhost:4100',TRIAL_DURATION_DAYS:'30',TRIAL_MAX_CAMERAS:'16',TRIAL_MAX_AI_CAMERAS:'4',TRIAL_MAX_ADMIN_USERS:'1',TRIAL_MAX_USERS:'3',TRIAL_MAX_SITES:'1',TRIAL_FEATURES:'camera_management,playback',TRIAL_SIGNING_PRIVATE_KEY_PATH:keyPath,TRIAL_ISSUER_KEY_ID:'trial-test-2026',TRIAL_SECRET_ENCRYPTION_KEY:'11'.repeat(32),TRIAL_VERIFICATION_MINUTES:'10',TRIAL_DOWNLOAD_HOURS:'24',TRIAL_RESEND_SECONDS:'30',SMTP_HOST:'fixture',EMAIL_FROM:'trials@example.com'});
 const db=openDatabase(path.join(dir,'test.sqlite')),messages=[],registrations=[],mailControl={failLicense:false,failRegistration:false};
 const mailer=async message=>{messages.push(message);if(mailControl.failLicense&&message.subject==='Your E-VMS trial license')throw Error('fixture failure');return{accepted:[message.to]};};
 const registrar=async input=>{registrations.push(input);if(mailControl.failRegistration)throw Error('core unavailable');const envelope=JSON.parse(input.artifact);return{success:true,license_id:envelope.payload.licenseId,artifact_checksum:input.checksum,registration_state:'REGISTERED',runtime_state:'NOT_ACTIVATED'};};
 const app=createApp(db,c,{resolveRelease:async()=>({unavailable:true}),trialMailer:mailer,trialRegistrar:registrar});
 const server=await new Promise(resolve=>{const current=app.listen(0,'127.0.0.1',()=>resolve(current));});
 t.after(()=>{server.close();db.close();fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const request=(route,method='GET',body)=>fetch(base+route,{method,headers:{Origin:'http://localhost:4100','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 return{c,db,messages,registrations,mailControl,request,privateKey:createPrivateKey(fs.readFileSync(keyPath))};
}

async function requestAndVerify(fixture){
 let response=await fixture.request('/api/trials/request','POST',trialBody);assert.equal(response.status,202);const requested=await response.json();
 const code=fixture.messages[0].text.match(/\b\d{6}\b/)?.[0];assert.match(code,/^\d{6}$/);
 response=await fixture.request('/api/trials/verify','POST',{request_id:requested.requestId,code});
 return{response,requestId:requested.requestId,code};
}

test('verified trial flow signs canonical E-VMS artifact and limits retrieval',async t=>{
 const f=await fixture(t);assert.equal((await f.request('/api/trials/config')).status,200);
 assert.equal((await f.request('/api/trials/request','POST',{...trialBody,email:'invalid'})).status,422);
 const {response}=await requestAndVerify(f);assert.equal(response.status,201);const issued=await response.json();assert.equal(issued.delivery,'EMAIL_ACCEPTED');assert.equal(issued.registration,'REGISTERED');assert.equal(issued.runtimeState,'NOT_ACTIVATED');assert.equal(f.registrations.length,1);
 const licenseMessage=f.messages.find(message=>message.subject==='Your E-VMS trial license');assert.equal(licenseMessage.attachments.length,2);assert.match(licenseMessage.attachments[1].content.toString('ascii',0,8),/^%PDF-1\.4/);assert.match(licenseMessage.text,/YOUR E-VMS BETA TRIAL IS READY/);assert.match(licenseMessage.text,/Edition: E-VMS Pro \(CLIENT\)/);assert.match(licenseMessage.text,/Download E-VMS Pro: http:\/\/localhost:4100\/downloads/);assert.match(licenseMessage.text,/Installation and activation guide: http:\/\/localhost:4100\/workflow/);assert.match(licenseMessage.text,/Getting started and support: http:\/\/localhost:4100\/contact/);
 const envelope=JSON.parse(licenseMessage.attachments[0].content);assert.equal(envelope.format,'e-vms-license');assert.equal(envelope.payload.product,'E-VMS');assert.equal(envelope.payload.licenseType,'TRIAL');assert.equal(envelope.payload.entitlements.maxCameras,16);assert.equal(envelope.payload.entitlementDetails.quantities.find(item=>item.key==='MAX_CAMERAS').unit,'CHANNELS');assert.equal(envelope.payload.activationPolicy.mode,'SIGNED_ARTIFACT_WITH_CODE');
 const publicKey=createPublicKey(f.privateKey);assert.equal(verify('RSA-SHA256',Buffer.from(canonicalize(envelope.payload)),publicKey,Buffer.from(envelope.signature.value,'base64')),true);
 const tampered=structuredClone(envelope);tampered.payload.entitlements.maxCameras=999;assert.equal(verify('RSA-SHA256',Buffer.from(canonicalize(tampered.payload)),publicKey,Buffer.from(tampered.signature.value,'base64')),false);
 const downloadPath=new URL(issued.downloadUrl).pathname;for(let index=0;index<3;index++){const download=await f.request(downloadPath);assert.equal(download.status,200);const bytes=await download.text();assert.equal(hash(bytes),download.headers.get('x-content-sha256'));}
 assert.equal((await f.request(downloadPath)).status,410);assert.equal((await f.request('/api/trials/request','POST',trialBody)).status,409);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM trial_licenses').get().n,1);const stored=f.db.prepare('SELECT activation_code_hash,core_registration_state FROM trial_licenses').get();const code=licenseMessage.text.match(/[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){3}/)[0];assert.equal(stored.activation_code_hash,activationHash(code));assert.equal(stored.core_registration_state,'REGISTERED');assert.equal(envelope.payload.activationPolicy.activationCodeHash,stored.activation_code_hash);
});

test('wrong verification attempts lock without issuing a license',async t=>{
 const f=await fixture(t);let response=await f.request('/api/trials/request','POST',trialBody);const request=await response.json();
 for(let attempt=0;attempt<5;attempt++)assert.equal((await f.request('/api/trials/verify','POST',{request_id:request.requestId,code:'000000'})).status,422);
 assert.equal((await f.request('/api/trials/verify','POST',{request_id:request.requestId,code:'000000'})).status,429);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM trial_licenses').get().n,0);
});

test('expired verification code never issues a license',async t=>{
 const f=await fixture(t);const body={...trialBody,email:'expired@example.com'};const response=await f.request('/api/trials/request','POST',body);const request=await response.json(),code=f.messages[0].text.match(/\b\d{6}\b/)[0];
 f.db.prepare('UPDATE trial_requests SET verification_expires=? WHERE id=?').run(Date.now()-60000,request.requestId);
 const verifyResponse=await f.request('/api/trials/verify','POST',{request_id:request.requestId,code});assert.equal(verifyResponse.status,410);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM trial_licenses').get().n,0);
});

test('provider failure is explicit and redelivery uses a newly accepted token',async t=>{
 const f=await fixture(t);f.mailControl.failLicense=true;const {response,requestId}=await requestAndVerify(f);assert.equal(response.status,502);assert.equal(f.db.prepare('SELECT delivery_state FROM trial_licenses WHERE request_id=?').get(requestId).delivery_state,'EMAIL_FAILED');
 f.mailControl.failLicense=false;const redelivery=await f.request('/api/trials/redeliver','POST',{request_id:requestId,email:trialBody.email});assert.equal(redelivery.status,200);const body=await redelivery.json();assert.equal(body.delivery,'EMAIL_ACCEPTED');assert.equal((await f.request(new URL(body.downloadUrl).pathname)).status,200);
});

test('core registration failure stays non-issued and retry reuses the same canonical license',async t=>{
 const f=await fixture(t);f.mailControl.failRegistration=true;const first=await requestAndVerify(f);assert.equal(first.response.status,502);
 const pending=f.db.prepare('SELECT tr.state,tl.license_id,tl.core_registration_state FROM trial_requests tr JOIN trial_licenses tl ON tl.request_id=tr.id WHERE tr.id=?').get(first.requestId);assert.equal(pending.state,'CORE_REGISTRATION_FAILED');assert.equal(pending.core_registration_state,'FAILED');
 f.mailControl.failRegistration=false;const retry=await f.request('/api/trials/verify','POST',{request_id:first.requestId,code:first.code});assert.equal(retry.status,201);const completed=await retry.json();assert.equal(completed.licenseId,pending.license_id);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM trial_licenses').get().n,1);assert.equal(f.registrations.at(-1).requestId,first.requestId);
});

test('database failure rolls issuance back instead of claiming success',async t=>{
 const f=await fixture(t);const response=await f.request('/api/trials/request','POST',trialBody);const request=await response.json(),code=f.messages[0].text.match(/\b\d{6}\b/)[0];f.db.exec('DROP TABLE trial_licenses');
 const verifyResponse=await f.request('/api/trials/verify','POST',{request_id:request.requestId,code});assert.equal(verifyResponse.status,500);assert.notEqual(f.db.prepare('SELECT state FROM trial_requests WHERE id=?').get(request.requestId).state,'ISSUED');
});
