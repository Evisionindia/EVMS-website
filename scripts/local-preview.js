// Run from the website root after building. This profile ignores deployment credentials.
import {config} from '../server/config.js';
import {openDatabase} from '../server/db.js';
import {createApp} from '../server/app.js';

const cfg = config({
  HOST: '127.0.0.1',
  PORT: '4196',
  PUBLIC_SITE_URL: 'http://127.0.0.1:4196',
  DATABASE_PATH: 'data/local-preview-20261106/website.sqlite'
});
const db = openDatabase(cfg.dbPath);
const server = createApp(db, cfg).listen(cfg.port, cfg.host, () => {
  console.log('E-VMS public website QA: ' + cfg.site);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => db.close()));
}