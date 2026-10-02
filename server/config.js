import path from 'node:path';
import fs from 'node:fs';
const policy=JSON.parse(fs.readFileSync(new URL('../content/releases.json',import.meta.url)));
export function config(env=process.env){
 const production=env.NODE_ENV==='production';
 const url=new URL(env.PUBLIC_SITE_URL||'http://localhost:4100');
 const api=env.API_BASE_URL?new URL(env.API_BASE_URL):null;
 if(!['http:','https:'].includes(url.protocol)||api&&!['http:','https:'].includes(api.protocol))throw Error('HTTP(S) site/API URLs required');
 if(production&&(url.protocol!=='https:'||api&&api.protocol!=='https:'))throw Error('Production site/API require HTTPS');
 const sameSite=env.COOKIE_SAME_SITE||'lax';
 if(!['lax','strict','none'].includes(sameSite)||sameSite==='none'&&!production)throw Error('Invalid cookie policy');
 const origins=new Set([url.origin,...(env.CORS_ORIGINS||'').split(',').filter(Boolean).map(x=>new URL(x.trim()).origin)]);
 const timezone=env.REPORT_TIMEZONE||'UTC'; new Intl.DateTimeFormat('en',{timeZone:timezone}).format();
 const hours=Number(env.SESSION_HOURS||8),reportHour=Number(env.REPORT_HOUR||9),port=Number(env.PORT||4100);
 if(!Number.isInteger(hours)||hours<1||hours>24||!Number.isInteger(reportHour)||reportHour<0||reportHour>23||!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port, session or report setting');
 if(!Number.isInteger(Number(env.TRUST_PROXY||0))||Number(env.TRUST_PROXY||0)<0||Number(env.TRUST_PROXY||0)>5)throw Error('Invalid proxy hop count');
 const repo=env.GITHUB_RELEASE_REPO||policy.mirrorRepository;
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error('Invalid GitHub repository');
 const registrationUrl=env.CORE_LICENSE_REGISTRATION_URL?new URL(env.CORE_LICENSE_REGISTRATION_URL):null;
 if(registrationUrl&&!['http:','https:'].includes(registrationUrl.protocol))throw Error('Core license registration URL must use HTTP(S)');
 if(production&&registrationUrl?.protocol!=='https:')throw Error('Production core license registration requires HTTPS');
 const trial={durationDays:Number(env.TRIAL_DURATION_DAYS||0),maxCameras:Number(env.TRIAL_MAX_CAMERAS||0),maxAiCameras:Number(env.TRIAL_MAX_AI_CAMERAS||0),maxAdminUsers:Number(env.TRIAL_MAX_ADMIN_USERS||0),maxUsers:Number(env.TRIAL_MAX_USERS||0),maxSites:Number(env.TRIAL_MAX_SITES||0),features:String(env.TRIAL_FEATURES||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean),signingKeyPath:env.TRIAL_SIGNING_PRIVATE_KEY_PATH?path.resolve(env.TRIAL_SIGNING_PRIVATE_KEY_PATH):'',issuerKeyId:env.TRIAL_ISSUER_KEY_ID||'',secretEncryptionKey:env.TRIAL_SECRET_ENCRYPTION_KEY||'',verificationMinutes:Number(env.TRIAL_VERIFICATION_MINUTES||10),downloadHours:Number(env.TRIAL_DOWNLOAD_HOURS||24),resendSeconds:Number(env.TRIAL_RESEND_SECONDS||60),registrationUrl:registrationUrl?.toString()||'',serviceToken:env.CORE_LICENSE_SERVICE_TOKEN||'',registrationTimeoutMs:Number(env.CORE_LICENSE_TIMEOUT_MS||5000)};
 trial.configured=Boolean(Number.isInteger(trial.durationDays)&&trial.durationDays>0&&Number.isInteger(trial.maxCameras)&&trial.maxCameras>0&&Number.isInteger(trial.maxAiCameras)&&trial.maxAiCameras>=0&&trial.maxAiCameras<=trial.maxCameras&&Number.isInteger(trial.maxAdminUsers)&&trial.maxAdminUsers>0&&Number.isInteger(trial.maxUsers)&&trial.maxUsers>=trial.maxAdminUsers&&Number.isInteger(trial.maxSites)&&trial.maxSites>0&&trial.features.every(value=>/^[A-Z0-9_]{2,80}$/.test(value))&&new Set(trial.features).size===trial.features.length&&Number.isInteger(trial.verificationMinutes)&&trial.verificationMinutes>=5&&trial.verificationMinutes<=60&&Number.isInteger(trial.downloadHours)&&trial.downloadHours>=1&&trial.downloadHours<=168&&Number.isInteger(trial.resendSeconds)&&trial.resendSeconds>=30&&trial.resendSeconds<=3600&&trial.signingKeyPath&&trial.issuerKeyId&&/^[a-f0-9]{64}$/i.test(trial.secretEncryptionKey));
 trial.coreConfigured=Boolean(trial.registrationUrl&&/^evms_sa_[0-9a-f-]{36}\.[A-Za-z0-9_-]{40,}$/i.test(trial.serviceToken)&&Number.isInteger(trial.registrationTimeoutMs)&&trial.registrationTimeoutMs>=1000&&trial.registrationTimeoutMs<=30000);
 return {production,port,host:env.HOST||'0.0.0.0',dbPath:path.resolve(env.DATABASE_PATH||'data/website.sqlite'),site:url.origin,api:api?.origin||'',origins,sameSite,trustProxy:Number(env.TRUST_PROXY||0),sessionHours:hours,repo,privateReleases:env.GITHUB_PRIVATE_RELEASES==='true',githubToken:env.GITHUB_TOKEN||'',timezone,reportHour,scheduler:env.SCHEDULER_ENABLED==='true',retentionDays:Number(env.RETENTION_DAYS||365),smtp:{host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:env.SMTP_SECURE==='true',auth:env.SMTP_USER?{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}:undefined},emailFrom:env.EMAIL_FROM,recipient:env.LEAD_REPORT_RECIPIENT||'sales1@evisionindia.com',sheets:{id:env.GOOGLE_SHEETS_ID,email:env.GOOGLE_CLIENT_EMAIL,key:env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g,'\n')},trial};
}
