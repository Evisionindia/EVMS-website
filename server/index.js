import {config} from './config.js';import {openDatabase} from './db.js';import {createApp} from './app.js';import {reportService} from './reports.js';
const cfg=config(),db=openDatabase(cfg.dbPath),app=createApp(db,cfg),reports=reportService(db,cfg);
const server=app.listen(cfg.port,cfg.host,()=>console.log('Website listening on '+cfg.host+':'+server.address().port));
const timer=cfg.scheduler?setInterval(()=>reports.run().catch(()=>console.error('Scheduler run failed; stored leads preserved.')),60000):null;
if(cfg.scheduler)reports.run().catch(()=>console.error('Initial scheduler run failed.'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(timer)clearInterval(timer);server.close(()=>{db.close();process.exit(0);});});
