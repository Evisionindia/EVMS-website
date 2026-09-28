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
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at TEXT NOT NULL,owner_id TEXT,action TEXT NOT NULL,target TEXT);
 CREATE TABLE IF NOT EXISTS reports(day TEXT PRIMARY KEY,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,last_error TEXT,sent_at TEXT);
 CREATE TABLE IF NOT EXISTS sheets_jobs(lead_id TEXT PRIMARY KEY REFERENCES leads(id),row_number INTEGER UNIQUE NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,last_error TEXT);
 CREATE TABLE IF NOT EXISTS release_cache(key TEXT PRIMARY KEY,payload TEXT NOT NULL,checked INTEGER NOT NULL);
 `);
 if(!db.prepare('PRAGMA table_info(leads)').all().some(c=>c.name==='source'))db.exec("ALTER TABLE leads ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown'");
 return db;
}
export const audit=(db,owner,action,target=null)=>db.prepare('INSERT INTO audit(at,owner_id,action,target) VALUES(?,?,?,?)').run(new Date().toISOString(),owner,action,target);
