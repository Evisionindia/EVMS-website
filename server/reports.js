import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';
import {syncSheet} from './sheets.js';
import {audit} from './db.js';
export const approved=['submitted_at','name','company','email','phone','interest','message','contact','status','source'];
export const safeCell=v=>/^[\s]*[=+@-]/.test(String(v??''))?"'"+v:String(v??'');
export function csv(rows){return [approved,...rows.map(r=>approved.map(k=>safeCell(r[k])))].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');}
export async function xlsx(rows){const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Leads');sheet.addRow(approved);rows.forEach(r=>sheet.addRow(approved.map(k=>safeCell(r[k]))));sheet.getRow(1).font={bold:true};sheet.columns.forEach(c=>c.width=24);return book.xlsx.writeBuffer();}
export function dateInZone(date,zone){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function yesterday(zone,now=new Date()){const day=dateInZone(now,zone);return new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);}
export function reportService(db,cfg,{mailer,googleFetch=fetch}={}){
 const send=mailer|| (async message=>{const t=nodemailer.createTransport({...cfg.smtp,requireTLS:!cfg.smtp.secure,disableFileAccess:true,disableUrlAccess:true,connectionTimeout:10000,socketTimeout:15000});try{const result=await t.sendMail(message);if(!result.accepted?.length)throw Error('Not accepted');}finally{t.close();}});
 let busy=false;
 async function run(){
  if(busy)return;busy=true;
  try{
   const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:cfg.timezone,hour:'2-digit',hourCycle:'h23'}).format(new Date()));
   if(hour>=cfg.reportHour){
    const target=yesterday(cfg.timezone),last=db.prepare('SELECT MAX(day) day FROM reports').get().day;
    let day=last&&last<target?new Date(Date.parse(last+'T12:00:00Z')+86400000).toISOString().slice(0,10):target;
    for(let i=0;i<31&&day<=target;i++){db.prepare('INSERT OR IGNORE INTO reports(day) VALUES(?)').run(day);day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);}
   }
   const jobs=db.prepare("SELECT * FROM reports WHERE status!='accepted' AND next_attempt<=? LIMIT 7").all(Date.now());
   for(const job of jobs){
    if(!cfg.smtp.host||!cfg.emailFrom){db.prepare("UPDATE reports SET status='configuration_required',last_error='EMAIL_CONFIGURATION_REQUIRED',next_attempt=? WHERE day=?").run(Date.now()+3600000,job.day);continue;}
    try{
     const rows=db.prepare('SELECT * FROM leads WHERE day=? ORDER BY submitted_at').all(job.day);
     await send({from:cfg.emailFrom,to:cfg.recipient,subject:'EVMS leads — '+job.day,messageId:'<evms-report-'+job.day+'@'+new URL(cfg.site).hostname+'>',text:rows.length+' submissions for '+job.day+' ('+cfg.timezone+'). New: '+rows.filter(r=>r.status==='new').length+'. CSV attached.',attachments:[{filename:'leads-'+job.day+'.csv',content:csv(rows),contentType:'text/csv'}]});
     db.prepare("UPDATE reports SET status='accepted',sent_at=?,attempts=attempts+1,last_error=NULL WHERE day=?").run(new Date().toISOString(),job.day);audit(db,null,'report.provider_accepted',job.day);
    }catch{db.prepare("UPDATE reports SET status='failed',attempts=attempts+1,last_error='PROVIDER_FAILED',next_attempt=? WHERE day=?").run(Date.now()+Math.min(86400000,60000*2**Math.min(job.attempts,10)),job.day);}
   }
   if(cfg.sheets.id&&cfg.sheets.email&&cfg.sheets.key){
    for(const job of db.prepare("SELECT * FROM sheets_jobs WHERE status!='synced' AND next_attempt<=? LIMIT 20").all(Date.now())){
     try{
      const row=db.prepare('SELECT * FROM leads WHERE id=?').get(job.lead_id);
      await syncSheet(cfg,job,row,{fetcher:googleFetch});
      db.prepare("UPDATE sheets_jobs SET status='synced',attempts=attempts+1,last_error=NULL WHERE lead_id=?").run(row.id);
     }catch{db.prepare("UPDATE sheets_jobs SET status='failed',attempts=attempts+1,last_error='GOOGLE_SYNC_FAILED',next_attempt=? WHERE lead_id=?").run(Date.now()+3600000,job.lead_id);}
    }
   }
   db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('DELETE FROM limits WHERE expires<?').run(Date.now());
  }finally{busy=false;}
 }
 return {run};
}
