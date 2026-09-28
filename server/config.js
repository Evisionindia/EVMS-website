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
 return {production,port,host:env.HOST||'0.0.0.0',dbPath:path.resolve(env.DATABASE_PATH||'data/website.sqlite'),site:url.origin,api:api?.origin||'',origins,sameSite,trustProxy:Number(env.TRUST_PROXY||0),sessionHours:hours,repo,privateReleases:env.GITHUB_PRIVATE_RELEASES==='true',githubToken:env.GITHUB_TOKEN||'',timezone,reportHour,scheduler:env.SCHEDULER_ENABLED==='true',retentionDays:Number(env.RETENTION_DAYS||365),smtp:{host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:env.SMTP_SECURE==='true',auth:env.SMTP_USER?{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}:undefined},emailFrom:env.EMAIL_FROM,recipient:env.LEAD_REPORT_RECIPIENT||'sales1@evisionindia.com',sheets:{id:env.GOOGLE_SHEETS_ID,email:env.GOOGLE_CLIENT_EMAIL,key:env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g,'\n')}};
}
