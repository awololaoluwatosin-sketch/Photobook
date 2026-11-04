'use strict';
/* Make a license key by hand (bank transfer, WhatsApp sale, gift, reviewer copy):
     node tools/make-key.js customer@email.com [order-id]            */
const fs = require('fs');
const path = require('path');
const { makeKey } = require('../license');

const email = process.argv[2];
if (!email || email.indexOf('@') < 0) { console.error('Usage: node tools/make-key.js customer@email.com [order-id]'); process.exit(1); }
const privPath = path.join(__dirname, '..', 'keys', 'private.pem');
if (!fs.existsSync(privPath)) { console.error('keys/private.pem not found. Run: node tools/gen-keys.js'); process.exit(1); }
const id = process.argv[3] || 'manual-' + Date.now().toString(36);
const key = makeKey({ email: email.trim().toLowerCase(), id, iat: Date.now(), plan: 'pro' }, fs.readFileSync(privPath, 'utf8'));
console.log('\nLicense key for ' + email + ':\n\n' + key + '\n');
