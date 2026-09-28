import {config} from '../server/config.js';import {openDatabase,audit} from '../server/db.js';import bcrypt from 'bcryptjs';import {randomUUID} from 'node:crypto';import readline from 'node:readline/promises';
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const email=(await rl.question('Owner email: ')).trim().toLowerCase();
console.log('Enter owner password through OWNER_BOOTSTRAP_PASSWORD in this process environment; it is not written to a file.');
const password=process.env.OWNER_BOOTSTRAP_PASSWORD;delete process.env.OWNER_BOOTSTRAP_PASSWORD;
rl.close();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password||password.length<14||Buffer.byteLength(password)>72)throw Error('Valid email and a 14–72 byte password required.');
const db=openDatabase(config().dbPath);
try{const id=randomUUID();db.prepare('INSERT INTO owners VALUES(?,?,?)').run(id,email,await bcrypt.hash(password,12));audit(db,id,'owner.created');console.log('Owner created. No password retained.');}finally{db.close();}
