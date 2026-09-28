# Deployment

## Same-origin Node service

Run `npm ci`, `npm run build`, then `npm start`. Set HTTPS `PUBLIC_SITE_URL`, `NODE_ENV=production`, correct proxy trust, persistent `DATABASE_PATH` and owner/integration settings. Terminate TLS at a trusted reverse proxy. Keep the DB directory readable/writable only by the app user. Back it up using SQLite's online backup interface, or stop the app before copying the database and WAL files together.

## Railway

The repository includes Dockerfile and railway.json. Attach a persistent volume at `/data`, set `DATABASE_PATH=/data/website.sqlite`, configure the HTTPS public domain and origins, and enable exactly one app replica. Railway injects PORT; health path is /health. Verify volume permissions for the non-root node user. Provision owner from a console with the same volume mounted.

Use the built-in scheduler on the always-running service. A separate Railway cron service must not accidentally use a different local database; only use it with explicitly shared/accessible state and without simultaneous schedulers. No deployment was executed.

[Railway volumes](https://docs.railway.com/volumes) and [cron documentation](https://docs.railway.com/cron-jobs) were consulted for the deployment model.

## Hostinger

A Linux VPS capable of running Node 22+, native SQLite bindings, a persistent disk and an HTTPS reverse proxy is the supported documented model. Use systemd or an equivalent supervisor for the app. Configure restart/backup and one scheduler.

Hostinger also offers managed Node.js web apps on selected plans, but the plan's persistent disk, native-module and always-running scheduler support must be confirmed before using this SQLite deployment. Do not claim compatibility with all plans.

For static-only hosting, upload dist as the frontend and host the API/database on Railway or a suitable VPS. Map each clean public route to its corresponding HTML file, including /workflow and /deployment. Configure runtime-config.js and canonical PUBLIC_SITE_URL; configure exact CORS origins, HTTPS and cookie policy on the API. Static-only hosting cannot run the lead database/backend.

[Hostinger Node.js options](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/) and [deployment guidance](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) were consulted. **NOT VERIFIED — HOSTINGER DEPLOYMENT NOT EXECUTED.**

## Release checks

Run tests/build/audit, configure owner, test lead persistence and owner exports on the deployed domain, verify HTTPS cookies/CSRF/CORS, configure and test actual email/Sheets/GitHub access. Review privacy/retention with the business before launch. **NOT VERIFIED — RAILWAY DEPLOYMENT NOT EXECUTED.**

## Multi-page routes

The Node server serves /product, /workflow, /deployment, /about, /contact and /downloads directly. A separate static host must map each of those paths to the corresponding .html file in dist (and /owner and /privacy likewise). Do not use a blanket SPA fallback to index.html: each page has distinct content and metadata. The workflow uses HTML/CSS and a small workflow.js controller; there is no WebGL/CDN/model service.
