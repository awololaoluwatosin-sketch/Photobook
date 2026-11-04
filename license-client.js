'use strict';
/* The app's side of licensing (runs in the main process).
   - With a license server configured: a key must be activated on this computer. The server returns a signed token
     tied to this machine that expires after ~30 days and is refreshed in the background. Cancelled licenses and
     removed computers are noticed at the next check. If the computer is offline, the app keeps working until the
     token expires.
   - With no license server configured: the signed key alone unlocks the app (works fully offline). */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const license = require('./license');

const DAY = 864e5;

function normalizeServer(u) {
  u = String(u || '').trim().replace(/\/+$/, '');
  if (/^https:\/\//i.test(u)) return u;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u)) return u; // local testing only
  return '';
}

function run(cmd, args) {
  return new Promise((resolve) => execFile(cmd, args, { timeout: 5000, windowsHide: true }, (err, out) => resolve(err ? '' : String(out))));
}

// A stable id for this computer (hashed, so the raw hardware id never leaves the machine).
async function machineId(userData) {
  let raw = '';
  try {
    if (process.platform === 'win32') {
      const out = await run('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid']);
      const m = out.match(/MachineGuid\s+REG_SZ\s+(\S+)/i); raw = m ? m[1] : '';
    } else if (process.platform === 'darwin') {
      const out = await run('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']);
      const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/); raw = m ? m[1] : '';
    } else {
      for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
        try { raw = fs.readFileSync(f, 'utf8').trim(); if (raw) break; } catch (e) { /* next */ }
      }
    }
  } catch (e) { raw = ''; }
  if (!raw) { // fallback: a random id stored once on this computer
    const f = path.join(userData, 'device.json');
    try { raw = JSON.parse(fs.readFileSync(f, 'utf8')).id; } catch (e) { /* create */ }
    if (!raw) { raw = crypto.randomUUID(); try { fs.writeFileSync(f, JSON.stringify({ id: raw })); } catch (e) { /* ignore */ } }
  }
  return crypto.createHash('sha256').update('photobook-studio|' + raw).digest('hex').slice(0, 32);
}

function create(opts) {
  const { userData, net, publicKey, config, onChange } = opts;
  const server = normalizeServer(config.licenseServer);
  const file = path.join(userData, 'license.json');
  const deviceName = (os.hostname() || 'Computer').slice(0, 60);
  let st = { key: '', token: '', activatedAt: 0, lastCheck: 0, maxSeen: 0, devices: [], max: 0, used: 0 };
  let deviceId = null;
  let active = null;

  const persist = () => { try { st.maxSeen = Math.max(st.maxSeen || 0, Date.now()); fs.writeFileSync(file, JSON.stringify(st)); } catch (e) { /* ignore */ } };

  function evaluate() {
    active = null;
    if (!st.key) return;
    const kp = license.verifyKey(st.key, publicKey);
    if (!kp) return;
    if (!server) { active = kp; return; }
    const tp = license.verifyToken(st.token, publicKey);
    if (!tp || tp.id !== kp.id || !deviceId || tp.deviceId !== deviceId) return; // wrong computer: copied files don't work
    const now = Date.now();
    if (now > tp.exp) return;                                // not re-checked for too long
    if (now < (st.maxSeen || 0) - DAY) return;               // clock turned back
    active = Object.assign({}, kp, { exp: tp.exp });
  }

  function info() {
    evaluate();
    return {
      licensed: !!active, email: active ? active.email : '', id: active ? active.id : '', serverMode: !!server,
      max: st.max || 0, used: st.used || 0, devices: st.devices || [], expires: active && active.exp ? active.exp : 0,
      lastCheck: st.lastCheck || 0, deviceName: deviceName
    };
  }

  async function call(p, body, timeout) {
    const r = await net.fetch(server + p, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout || 15000)
    });
    let json = {};
    try { json = await r.json(); } catch (e) { /* not json */ }
    return { status: r.status, json };
  }

  function clear() { st.key = ''; st.token = ''; st.devices = []; st.used = 0; persist(); evaluate(); }

  async function init() {
    deviceId = await machineId(userData);
    try { st = Object.assign(st, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (e) { /* trial */ }
    evaluate();
    return info();
  }

  async function activate(key) {
    key = String(key || '').replace(/\s+/g, '');
    if (!license.verifyKey(key, publicKey)) {
      return { ok: false, code: 'invalid', error: 'That license key isn’t valid. Copy the whole key from your purchase email and try again.' };
    }
    if (!server) { st = Object.assign(st, { key, token: '', activatedAt: Date.now() }); persist(); evaluate(); return Object.assign({ ok: true }, info()); }
    let r;
    try { r = await call('/api/activate', { key, deviceId, deviceName }); }
    catch (e) { return { ok: false, code: 'network', error: 'Couldn’t reach the license server. Check your internet connection and try again.' }; }
    const j = r.json || {};
    if (r.status === 200 && j.ok) {
      const tp = license.verifyToken(j.token, publicKey);
      if (!tp || tp.deviceId !== deviceId) return { ok: false, code: 'server', error: 'The license server sent an unexpected reply. Please try again.' };
      st = Object.assign(st, { key, token: j.token, activatedAt: Date.now(), lastCheck: Date.now(), devices: j.devices || [], max: j.max, used: j.used });
      persist(); evaluate();
      return Object.assign({ ok: true }, info());
    }
    if (r.status === 409 && j.error === 'device_limit') {
      return { ok: false, code: 'device_limit', max: j.max, devices: j.devices || [], error: 'This license is already active on ' + j.max + ' computers. Remove one below, then activate again.' };
    }
    if (r.status === 403) return { ok: false, code: 'revoked', error: 'This license has been cancelled (for example after a refund). Please contact support if you think this is a mistake.' };
    if (r.status === 400) return { ok: false, code: 'invalid', error: 'That license key isn’t valid. Copy the whole key from your purchase email and try again.' };
    return { ok: false, code: 'server', error: 'The license server had a problem. Please try again in a moment.' };
  }

  async function removeDevice(key, ref) {
    if (!server) return { ok: false, error: 'No license server configured.' };
    try {
      const r = await call('/api/deactivate', { key: String(key || '').replace(/\s+/g, ''), ref });
      return r.status === 200 ? { ok: true } : { ok: false, error: 'Could not remove that computer.' };
    } catch (e) { return { ok: false, error: 'Couldn’t reach the license server.' }; }
  }

  // Re-check with the server. Refreshes the token, or learns the license was cancelled / this computer was removed.
  async function check() {
    if (!server || !st.key) return { changed: false, offline: false };
    let r;
    try { r = await call('/api/validate', { key: st.key, deviceId, deviceName }); } catch (e) { return { changed: false, offline: true }; }
    const j = r.json || {};
    if (r.status === 200 && j.ok) {
      const tp = license.verifyToken(j.token, publicKey);
      if (tp && tp.deviceId === deviceId) { st = Object.assign(st, { token: j.token, lastCheck: Date.now(), devices: j.devices || [], max: j.max, used: j.used }); persist(); evaluate(); }
      return { changed: false, offline: false };
    }
    if (r.status === 403 || r.status === 409) {
      const reason = r.status === 403 ? 'revoked' : 'removed';
      clear();
      return { changed: true, reason };
    }
    return { changed: false, offline: false };
  }

  async function deactivate() {
    if (server && st.key) { try { await call('/api/deactivate', { key: st.key, deviceId }, 5000); } catch (e) { /* offline: still removed here */ } }
    clear();
    return info();
  }

  function startTimers() {
    const notify = (reason) => { if (onChange) onChange(info(), reason); };
    const doCheck = async () => { const r = await check(); if (r.changed) notify(r.reason); };
    setTimeout(doCheck, 4000);
    setInterval(doCheck, 12 * 3600 * 1000).unref();
    let was = !!active;
    setInterval(() => { // catch a token running out while the app stays open
      const now = !!info().licensed;
      if (was && !now) notify('expired');
      was = now; persist();
    }, 60000).unref();
  }

  return { init, info, isActive: () => { evaluate(); return !!active; }, activate, removeDevice, check, deactivate, startTimers, deviceName };
}

module.exports = { create, normalizeServer };
