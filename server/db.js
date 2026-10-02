import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
export function openDatabase(filename){
 if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
 const db=new Database(filename); db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');db.pragma('busy_timeout = 5000');
 db.exec(`
 CREATE TABLE IF NOT EXISTS owners(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,owner_id TEXT REFERENCES owners(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS leads(id TEXT PRIMARY KEY,submitted_at TEXT NOT NULL,day TEXT NOT NULL,name TEXT NOT NULL,company TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,interest TEXT NOT NULL,message TEXT NOT NULL,contact TEXT NOT NULL,consent INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'new',dedupe TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS lead_day ON leads(day);
 CREATE INDEX IF NOT EXISTS lead_dedupe ON leads(dedupe,submitted_at);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at TEXT NOT NULL,owner_id TEXT,action TEXT NOT NULL,target TEXT,result TEXT NOT NULL DEFAULT 'SUCCESS',context_id TEXT);
 CREATE TABLE IF NOT EXISTS reports(day TEXT PRIMARY KEY,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,last_error TEXT,sent_at TEXT);
 CREATE TABLE IF NOT EXISTS sheets_jobs(lead_id TEXT PRIMARY KEY REFERENCES leads(id),row_number INTEGER UNIQUE NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,last_error TEXT);
 CREATE TABLE IF NOT EXISTS release_cache(key TEXT PRIMARY KEY,payload TEXT NOT NULL,checked INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS trial_requests(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,first_name TEXT NOT NULL,last_name TEXT NOT NULL,email TEXT NOT NULL,email_hash TEXT UNIQUE NOT NULL,company TEXT NOT NULL,country TEXT NOT NULL,camera_requirement INTEGER NOT NULL,intended_usage TEXT NOT NULL,consent INTEGER NOT NULL,verification_hash TEXT NOT NULL,verification_expires INTEGER NOT NULL,resend_after INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,state TEXT NOT NULL,verified_at TEXT,license_id TEXT,last_error TEXT);
 CREATE TABLE IF NOT EXISTS trial_licenses(license_id TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL REFERENCES trial_requests(id),email_hash TEXT UNIQUE NOT NULL,artifact TEXT NOT NULL,artifact_checksum TEXT NOT NULL,activation_code_hash TEXT NOT NULL,activation_code_encrypted TEXT NOT NULL,certificate_pdf BLOB NOT NULL,issued_at TEXT NOT NULL,expires_at TEXT NOT NULL,download_token_hash TEXT UNIQUE NOT NULL,download_expires INTEGER NOT NULL,download_count INTEGER NOT NULL DEFAULT 0,delivery_state TEXT NOT NULL,core_registration_state TEXT NOT NULL DEFAULT 'PENDING',core_registered_at TEXT,registration_attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT);
 CREATE INDEX IF NOT EXISTS trial_request_state_time ON trial_requests(state,updated_at);
 CREATE INDEX IF NOT EXISTS trial_license_expiry ON trial_licenses(expires_at);
 `);
 const leadColumns=db.prepare('PRAGMA table_info(leads)').all();
 if(!leadColumns.some(c=>c.name==='source'))db.exec("ALTER TABLE leads ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown'");
 const auditColumns=db.prepare('PRAGMA table_info(audit)').all();
 if(!auditColumns.some(c=>c.name==='result'))db.exec("ALTER TABLE audit ADD COLUMN result TEXT NOT NULL DEFAULT 'SUCCESS'");
 if(!auditColumns.some(c=>c.name==='context_id'))db.exec("ALTER TABLE audit ADD COLUMN context_id TEXT");
 const trialLicenseColumns=db.prepare('PRAGMA table_info(trial_licenses)').all();
 if(!trialLicenseColumns.some(c=>c.name==='core_registration_state'))db.exec("ALTER TABLE trial_licenses ADD COLUMN core_registration_state TEXT NOT NULL DEFAULT 'PENDING'");
 if(!trialLicenseColumns.some(c=>c.name==='core_registered_at'))db.exec("ALTER TABLE trial_licenses ADD COLUMN core_registered_at TEXT");
 if(!trialLicenseColumns.some(c=>c.name==='registration_attempts'))db.exec("ALTER TABLE trial_licenses ADD COLUMN registration_attempts INTEGER NOT NULL DEFAULT 0");
 if(!trialLicenseColumns.some(c=>c.name==='activation_code_encrypted'))db.exec("ALTER TABLE trial_licenses ADD COLUMN activation_code_encrypted TEXT");
 return db;
}
export const audit=(db,owner,action,target=null,{result='SUCCESS',contextId=null}={})=>db.prepare('INSERT INTO audit(at,owner_id,action,target,result,context_id) VALUES(?,?,?,?,?,?)').run(new Date().toISOString(),owner,action,target,result,contextId);
