'use strict';
/* Photobook Studio license server. No dependencies, Node 18+.

   Payments   POST /paystack-webhook   Paystack tells us a payment succeeded (or was refunded)
   App        POST /api/activate       a computer asks to use a license key  -> signed, expiring token
              POST /api/validate       the app re-checks (refreshes the token, learns about cancellations)
              POST /api/deactivate     frees one computer slot
   You        /admin/*                 list / revoke / restore / reset computers / change limit  (Bearer ADMIN_TOKEN)

   Each license may be active on MAX_DEVICES computers. Cancelled (revoked) licenses stop working the next time
   the app checks in, and in any case when its token expires (TOKEN_DAYS, default 30). */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const L = require('../license');

function createApp(env, deps) {
  env = env || process.env;
  deps = deps || {};
  const STORE = env.STORE_FILE || path.join(env.DATA_DIR || __dirname, 'data.json');
  const CURRENCY = (env.CURRENCY || 'NGN').toUpperCase();
  const MIN_AMOUNT = parseInt(env.MIN_AMOUNT_MINOR || '0', 10);
  const DEFAULT_MAX = parseInt(env.MAX_DEVICES || '3', 10);
  const TOKEN_DAYS = parseInt(env.TOKEN_DAYS || '30', 10);
  const DAY = 864e5;

  // ----- storage (one small JSON file, written atomically) -----
  let data = { issued: {}, licenses: {} };
  try { data = Object.assign(data, JSON.parse(fs.readFileSync(STORE, 'utf8'))); } catch (e) { /* new store */ }
  const save = () => { const tmp = STORE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(data, null, 2)); fs.renameSync(tmp, STORE); };

  let _priv = null, _pub = null;
  const priv = () => {
    if (_priv) return _priv;
    if (!env.LICENSE_PRIVATE_KEY_B64) throw new Error('LICENSE_PRIVATE_KEY_B64 is not set');
    _priv = Buffer.from(env.LICENSE_PRIVATE_KEY_B64, 'base64').toString('utf8');
    return _priv;
  };
  const pub = () => (_pub = _pub || L.publicKeyFromPrivate(priv()));

  // ----- license records -----
  const devRef = (id) => crypto.createHash('sha256').update('ref|' + id).digest('hex').slice(0, 10);
  function record(id, email) {
    let r = data.licenses[id];
    if (!r) r = data.licenses[id] = { id, email: String(email || '').toLowerCase(), max: DEFAULT_MAX, status: 'active', created: Date.now(), devices: {} };
    return r;
  }
  const deviceList = (rec, current) => Object.keys(rec.devices).map((id) => ({
    ref: devRef(id), name: rec.devices[id].name, at: rec.devices[id].at, seen: rec.devices[id].seen, current: id === current
  }));
  const summary = (rec) => ({ id: rec.id, email: rec.email, status: rec.status, max: rec.max, used: Object.keys(rec.devices).length, created: rec.created, devices: deviceList(rec) });
  const find = (q) => {
    q = String(q || '').trim().toLowerCase();
    return Object.keys(data.licenses).map((k) => data.licenses[k]).filter((r) => r.id.toLowerCase() === q || r.email === q);
  };

  // ----- app endpoints -----
  function activate(body, mode) {
    const payload = L.verifyKey(body.key, pub());
    if (!payload) return { status: 400, json: { error: 'invalid_key' } };
    const deviceId = String(body.deviceId || '');
    if (deviceId.length < 8 || deviceId.length > 128) return { status: 400, json: { error: 'bad_device' } };
    const rec = record(payload.id, payload.email);
    if (rec.status === 'revoked') { save(); return { status: 403, json: { error: 'revoked' } }; }
    const now = Date.now();
    const known = rec.devices[deviceId];
    if (!known) {
      if (mode === 'validate') return { status: 409, json: { error: 'device_removed' } };
      if (Object.keys(rec.devices).length >= rec.max) return { status: 409, json: { error: 'device_limit', max: rec.max, devices: deviceList(rec, deviceId) } };
      rec.devices[deviceId] = { name: String(body.deviceName || 'Computer').slice(0, 60), at: now, seen: now };
    } else {
      known.seen = now;
      if (body.deviceName) known.name = String(body.deviceName).slice(0, 60);
    }
    save();
    const token = L.makeToken({ id: rec.id, email: rec.email || payload.email, deviceId, iat: now, exp: now + TOKEN_DAYS * DAY }, priv());
    return { status: 200, json: { ok: true, token, email: rec.email || payload.email, id: rec.id, max: rec.max, used: Object.keys(rec.devices).length, devices: deviceList(rec, deviceId) } };
  }

  function deactivate(body) {
    const payload = L.verifyKey(body.key, pub());
    if (!payload) return { status: 400, json: { error: 'invalid_key' } };
    const rec = data.licenses[payload.id];
    if (rec) {
      Object.keys(rec.devices).forEach((id) => { if (id === body.deviceId || (body.ref && devRef(id) === body.ref)) delete rec.devices[id]; });
      save();
    }
    return { status: 200, json: { ok: true } };
  }

  // ----- admin endpoints -----
  function admin(method, url, body) {
    if (method === 'GET' && url.pathname === '/admin/licenses') {
      const q = url.searchParams.get('q');
      const list = q ? find(q) : Object.keys(data.licenses).map((k) => data.licenses[k]);
      return { status: 200, json: { licenses: list.map(summary) } };
    }
    if (method !== 'POST') return { status: 404, json: { error: 'not_found' } };
    const action = url.pathname.replace('/admin/', '');
    let targets = find(body.q);
    if (!targets.length && action === 'revoke' && body.q && String(body.q).indexOf('@') < 0) targets = [record(String(body.q), '')]; // cancel before first use
    if (!targets.length) return { status: 404, json: { error: 'no_match' } };
    targets.forEach((r) => {
      if (action === 'revoke') r.status = 'revoked';
      else if (action === 'restore') r.status = 'active';
      else if (action === 'reset') r.devices = {};
      else if (action === 'limit') r.max = Math.max(1, parseInt(body.max, 10) || r.max);
    });
    if (['revoke', 'restore', 'reset', 'limit'].indexOf(action) < 0) return { status: 404, json: { error: 'unknown_action' } };
    save();
    return { status: 200, json: { ok: true, licenses: targets.map(summary) } };
  }

  // ----- payments (Paystack) -----
  async function sendEmail(to, key, product) {
    const subject = 'Your ' + product + ' license key';
    const text = 'Thank you for buying ' + product + '!\n\nYour license key:\n\n' + key +
      '\n\nTo activate: open ' + product + ', click Export (or the Trial button at the top), paste the key, and click "Activate license".\n' +
      'Your key works on up to ' + DEFAULT_MAX + ' of your computers. Keep this email in case you reinstall.\n\nNeed help? Just reply to this email.';
    if (env.DRY_RUN === '1') { console.log('[DRY RUN] email to', to, '\n' + text); return; }
    if (!env.RESEND_API_KEY || !env.FROM_EMAIL) throw new Error('RESEND_API_KEY / FROM_EMAIL not set');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], subject, text })
    });
    if (!r.ok) throw new Error('Email provider error ' + r.status + ': ' + (await r.text()));
  }

  async function handlePaystack(raw, signature) {
    const secret = env.PAYSTACK_SECRET;
    if (!secret) return { status: 500, body: 'PAYSTACK_SECRET not set' };
    const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(String(signature || ''));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { status: 401, body: 'bad signature' };
    let ev;
    try { ev = JSON.parse(raw.toString('utf8')); } catch (e) { return { status: 400, body: 'bad json' }; }
    const d = ev.data || {};

    if (ev.event === 'refund.processed') { // money returned -> cancel the license
      const ref = String(d.transaction_reference || (d.transaction && d.transaction.reference) || '');
      if (!ref) return { status: 200, body: 'refund without reference' };
      const rec = record(ref, '');
      rec.status = 'revoked';
      save();
      console.log('License revoked after refund:', ref);
      return { status: 200, body: 'revoked' };
    }
    if (ev.event !== 'charge.success' || d.status !== 'success') return { status: 200, body: 'ignored' };

    const ref = String(d.reference || '');
    if (!ref) return { status: 400, body: 'no reference' };
    if (String(d.currency || '').toUpperCase() !== CURRENCY || (d.amount | 0) < MIN_AMOUNT) {
      console.warn('Payment ignored (amount/currency mismatch):', ref, d.amount, d.currency);
      return { status: 200, body: 'ignored: amount' };
    }
    const email = d.customer && d.customer.email ? String(d.customer.email).trim().toLowerCase() : '';
    if (!email) return { status: 400, body: 'no email' };
    if (data.issued[ref]) return { status: 200, body: 'already issued' }; // Paystack retries webhooks
    const key = L.makeKey({ email, id: ref, iat: Date.now(), plan: 'pro' }, priv());
    await (deps.sendEmail || sendEmail)(email, key, env.PRODUCT_NAME || 'Photobook Studio');
    data.issued[ref] = { email, at: new Date().toISOString() };
    record(ref, email);
    save();
    console.log('License issued for', email, 'ref', ref);
    return { status: 200, body: 'ok' };
  }

  // ----- HTTP -----
  const hits = new Map();
  function limited(ip, bucket, max) {
    const k = bucket + '|' + ip, now = Date.now();
    const arr = (hits.get(k) || []).filter((t) => now - t < 60000);
    arr.push(now); hits.set(k, arr);
    return arr.length > max;
  }
  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []; let n = 0;
      req.on('data', (c) => { n += c.length; if (n > 1e6) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  const send = (res, status, json) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(json)); };
  const authed = (req) => {
    const t = env.ADMIN_TOKEN || '';
    const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const a = Buffer.from(crypto.createHash('sha256').update(t).digest('hex')), b = Buffer.from(crypto.createHash('sha256').update(given).digest('hex'));
    return t.length >= 16 && crypto.timingSafeEqual(a, b);
  };

  const server = http.createServer(async (req, res) => {
    try {
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const url = new URL(req.url, 'http://x');
      if (req.method === 'GET' && url.pathname === '/health') { res.end('ok'); return; }

      if (req.method === 'POST' && url.pathname === '/paystack-webhook') {
        const r = await handlePaystack(await readBody(req), req.headers['x-paystack-signature']);
        res.statusCode = r.status; res.end(r.body); return;
      }
      if (url.pathname.indexOf('/api/') === 0 && req.method === 'POST') {
        if (limited(ip, 'api', 60)) return send(res, 429, { error: 'too_many_requests' });
        let body; try { body = JSON.parse((await readBody(req)).toString('utf8')); } catch (e) { return send(res, 400, { error: 'bad_json' }); }
        const act = url.pathname.slice(5);
        const r = act === 'activate' ? activate(body, 'activate') : act === 'validate' ? activate(body, 'validate') : act === 'deactivate' ? deactivate(body) : { status: 404, json: { error: 'not_found' } };
        return send(res, r.status, r.json);
      }
      if (url.pathname.indexOf('/admin/') === 0) {
        if (limited(ip, 'admin', 30)) return send(res, 429, { error: 'too_many_requests' });
        if (!authed(req)) return send(res, 401, { error: 'unauthorized' });
        let body = {};
        if (req.method === 'POST') { try { body = JSON.parse((await readBody(req)).toString('utf8') || '{}'); } catch (e) { return send(res, 400, { error: 'bad_json' }); } }
        const r = admin(req.method, url, body);
        return send(res, r.status, r.json);
      }
      send(res, 404, { error: 'not_found' });
    } catch (e) {
      console.error(e); res.statusCode = 500; res.end('error'); // 500 on the webhook makes Paystack retry
    }
  });

  return { server, handlePaystack, publicKey: pub, data: () => data };
}

if (require.main === module) {
  const app = createApp(process.env);
  const port = parseInt(process.env.PORT || '3000', 10);
  app.server.listen(port, () => console.log('License server listening on :' + port + '\nPublic key (must match license-public.json):\n' + app.publicKey()));
}
module.exports = { createApp };
