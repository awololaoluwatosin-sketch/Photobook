'use strict';
/* Signed license data. Two kinds, both signed with the seller's private key (Ed25519):
     PBS1.<payload>.<sig>   license KEY    (sent to the buyer by email)
     PBT1.<payload>.<sig>   activation TOKEN (issued by the license server to one computer, expires, refreshed online)
   The app holds only the public key, so it can verify these but never make them. */
const crypto = require('crypto');

const enc = (b) => Buffer.from(b).toString('base64url');
const dec = (s) => Buffer.from(s, 'base64url');

function sign(prefix, payload, privatePem) {
  const body = prefix + '.' + enc(JSON.stringify(payload));
  return body + '.' + enc(crypto.sign(null, Buffer.from(body), crypto.createPrivateKey(privatePem)));
}

function verifySigned(prefix, text, publicKeyB64) {
  try {
    if (!publicKeyB64) return null;
    const parts = String(text || '').replace(/\s+/g, '').split('.');
    if (parts.length !== 3 || parts[0] !== prefix) return null;
    const pub = crypto.createPublicKey({ key: Buffer.from(publicKeyB64, 'base64'), format: 'der', type: 'spki' });
    if (!crypto.verify(null, Buffer.from(parts[0] + '.' + parts[1]), pub, dec(parts[2]))) return null;
    const p = JSON.parse(dec(parts[1]).toString('utf8'));
    return p && typeof p === 'object' ? p : null;
  } catch (e) { return null; }
}

const makeKey = (payload, privatePem) => sign('PBS1', payload, privatePem);
function verifyKey(key, publicKeyB64) {
  const p = verifySigned('PBS1', key, publicKeyB64);
  if (!p || !p.email || !p.id) return null;
  if (p.exp && Date.now() > p.exp) return null;
  return p;
}

const makeToken = (payload, privatePem) => sign('PBT1', payload, privatePem);
// Returns the payload when the signature is genuine. Expiry and device are checked by the caller.
function verifyToken(token, publicKeyB64) {
  const p = verifySigned('PBT1', token, publicKeyB64);
  if (!p || !p.id || !p.deviceId || !p.exp) return null;
  return p;
}

function publicKeyFromPrivate(privatePem) {
  return crypto.createPublicKey(crypto.createPrivateKey(privatePem)).export({ type: 'spki', format: 'der' }).toString('base64');
}

module.exports = { makeKey, verifyKey, makeToken, verifyToken, publicKeyFromPrivate };
