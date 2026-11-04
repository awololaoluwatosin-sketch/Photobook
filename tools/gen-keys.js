'use strict';
/* Run ONCE on your own computer:  node tools/gen-keys.js
   - writes keys/private.pem  (SECRET: never share it, never put it in the app, back it up)
   - writes the matching public key into license-public.json (this one ships inside the app) */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const privPath = path.join(root, 'keys', 'private.pem');
if (fs.existsSync(privPath) && !process.argv.includes('--force')) {
  console.error('keys/private.pem already exists. Keys already issued would stop working if you replace it.\nUse --force only if you really want to start over.');
  process.exit(1);
}
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
fs.mkdirSync(path.join(root, 'keys'), { recursive: true });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
fs.writeFileSync(privPath, pem, { mode: 0o600 });
const pubB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
fs.writeFileSync(path.join(root, 'license-public.json'), JSON.stringify({ publicKey: pubB64 }, null, 2) + '\n');
console.log('Done.\n  Private key : keys/private.pem   (KEEP SECRET, BACK IT UP)\n  Public key  : license-public.json (now built into the app)\n');
console.log('For the payment server, set this environment variable:\nLICENSE_PRIVATE_KEY_B64=' + Buffer.from(pem).toString('base64') + '\n');
console.log('Now rebuild the app (npm run dist:win / dist:mac) so it contains the new public key.');
