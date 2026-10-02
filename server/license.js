import {createCipheriv,createDecipheriv,createHash,createPrivateKey,createPublicKey,randomBytes,randomInt,randomUUID,sign,verify} from 'node:crypto';
import fs from 'node:fs';

const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const canonicalize=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?`[${value.map(canonicalize).join(',')}]`:`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
export const hash=value=>createHash('sha256').update(String(value)).digest('hex');
export const normalizeCode=value=>String(value||'').toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g,'');
export function activationCode(){let raw='';while(raw.length<16){for(const byte of randomBytes(16)){if(raw.length===16)break;raw+=alphabet[byte&31];}}return raw.match(/.{4}/g).join('-');}
export function activationHash(value){const normalized=normalizeCode(value);if(normalized.length!==16)throw Error('ACTIVATION_CODE_INVALID');return hash(`e-vms-activation-v1:${normalized}`);}
export function verificationCode(){return String(randomInt(0,1000000)).padStart(6,'0');}
function secretKey(cfg){const value=String(cfg.trial.secretEncryptionKey||'');if(!/^[a-f0-9]{64}$/i.test(value))throw Error('TRIAL_SECRET_ENCRYPTION_NOT_CONFIGURED');return Buffer.from(value,'hex');}
export function sealActivationCode(cfg,value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secretKey(cfg),iv);const encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;}
export function openActivationCode(cfg,value){const [iv,tag,data]=String(value||'').split(':');if(!/^[a-f0-9]{24}$/i.test(iv||'')||!/^[a-f0-9]{32}$/i.test(tag||'')||!/^[a-f0-9]+$/i.test(data||''))throw Error('TRIAL_ACTIVATION_SECRET_INVALID');const decipher=createDecipheriv('aes-256-gcm',secretKey(cfg),Buffer.from(iv,'hex'));decipher.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([decipher.update(Buffer.from(data,'hex')),decipher.final()]).toString('utf8');}
export function entitlementDetails(entitlements){const quantity=(key,value,unit)=>({key,type:'INTEGER',value,unit,source:'SIGNED_ISSUER_POLICY',verificationStatus:'SIGNED'});return{quantities:[quantity('MAX_CAMERAS',entitlements.maxCameras,'CHANNELS'),quantity('MAX_AI_CAMERAS',entitlements.maxAiCameras,'CHANNELS'),quantity('MAX_ADMIN_USERS',entitlements.maxAdminUsers,'USERS'),quantity('MAX_USERS',entitlements.maxUsers,'USERS'),quantity('MAX_SITES',entitlements.maxSites,'SITES')],features:entitlements.features.map(key=>({key,type:'BOOLEAN',value:true,unit:null,source:'SIGNED_ISSUER_POLICY',verificationStatus:'SIGNED'}))};}
export function loadSigner(cfg){
 if(!cfg.trial.signingKeyPath||!cfg.trial.issuerKeyId)throw Error('TRIAL_SIGNING_NOT_CONFIGURED');
 const privateKey=createPrivateKey(fs.readFileSync(cfg.trial.signingKeyPath));
 return {privateKey,publicKey:createPublicKey(privateKey),keyId:cfg.trial.issuerKeyId};
}
export function signedTrial(cfg,request,now=new Date()){
 const signer=loadSigner(cfg),licenseId=randomUUID(),code=activationCode();
 const expiry=new Date(now.getTime()+cfg.trial.durationDays*86400000);
 const entitlements={maxCameras:cfg.trial.maxCameras,maxAiCameras:cfg.trial.maxAiCameras,maxAdminUsers:cfg.trial.maxAdminUsers,maxUsers:cfg.trial.maxUsers,maxSites:cfg.trial.maxSites,features:cfg.trial.features};
 const payload={licenseVersion:2,licenseId,product:'E-VMS',edition:'CLIENT',licenseType:'TRIAL',customer:{name:`${request.first_name} ${request.last_name}`.trim(),email:request.email,organization:request.company},tier:'TRIAL',issuedAt:now.toISOString(),activationDate:null,expiryDate:expiry.toISOString(),status:'ISSUED',entitlements,entitlementDetails:entitlementDetails(entitlements),deploymentBinding:{type:'NONE'},activationPolicy:{mode:'SIGNED_ARTIFACT_WITH_CODE',offlineVerification:true,activationCodeHash:activationHash(code)},trialPolicy:{source:'WEBSITE_VERIFIED_EMAIL',requestId:request.id}};
 const signature=sign('RSA-SHA256',Buffer.from(canonicalize(payload)),signer.privateKey).toString('base64');
 const envelope={format:'e-vms-license',licenseVersion:2,payload,signature:{algorithm:'RSA-SHA256',keyId:signer.keyId,value:signature}};
 if(!verify('RSA-SHA256',Buffer.from(canonicalize(payload)),signer.publicKey,Buffer.from(signature,'base64')))throw Error('TRIAL_SIGNATURE_SELF_CHECK_FAILED');
 const artifact=JSON.stringify(envelope);
 return {licenseId,code,expiry,artifact,checksum:hash(artifact)};
}
function pdfEscape(value){return String(value).replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)');}
export function certificatePdf({licenseId,customer,company,issuedAt,expiryDate,maxCameras,activationCode,checksum}){
 const lines=['E-Vision India','E-VMS Trial License Certificate',`License ID: ${licenseId}`,`Customer: ${customer}`,`Organization: ${company}`,`Issue date: ${issuedAt}`,`Expiry date: ${expiryDate}`,`Camera entitlement: ${maxCameras} channels`,`Activation reference: ${activationCode}`,`Artifact SHA-256: ${checksum}`,'The signed .evms-license artifact is authoritative.'];
 const stream=`BT /F1 16 Tf 56 760 Td ${lines.map((line,index)=>`${index?'0 -28 Td ':''}(${pdfEscape(line)}) Tj`).join(' ')} ET`;
 const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=Buffer.byteLength(pdf);pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(pdf);
}
