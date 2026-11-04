#!/usr/bin/env node
'use strict';
/* Manage licenses on your live license server.
   Setup (once):  set SERVER=https://your-server  and  ADMIN_TOKEN=<the same token you set on the server>
   Usage:
     node tools/admin.js list [email-or-order-id]
     node tools/admin.js revoke  <email-or-order-id>     cancel (e.g. after a refund); app returns to trial at next check
     node tools/admin.js restore <email-or-order-id>
     node tools/admin.js reset   <email-or-order-id>     free all computers so the customer can activate again
     node tools/admin.js limit   <email-or-order-id> <n> change allowed computers */
const [cmd, q, n] = process.argv.slice(2);
const SERVER = (process.env.SERVER || '').replace(/\/+$/, ''), TOKEN = process.env.ADMIN_TOKEN || '';
if (!SERVER || !TOKEN || !cmd) { console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0].replace(/^[^]*?\/\*/, '')); process.exit(1); }
(async () => {
  const H = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };
  const r = cmd === 'list'
    ? await fetch(SERVER + '/admin/licenses' + (q ? '?q=' + encodeURIComponent(q) : ''), { headers: H })
    : await fetch(SERVER + '/admin/' + cmd, { method: 'POST', headers: H, body: JSON.stringify({ q, max: n }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('Error', r.status, j.error || ''); process.exit(1); }
  console.log(JSON.stringify(j.licenses || j, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
