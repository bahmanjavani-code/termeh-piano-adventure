// Validate ONLY the PUBLIC RSA key exported by Cafe Bazaar's developer console.
// Run in GitHub Actions before any APK is built. Never print key material.
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const raw = process.env.TERMEH_BAZAAR_RSA_PUBLIC_KEY || '';
const key = raw.replace(/\s+/g, '');
if (!key) {
  if (process.env.TERMEH_REQUIRE_BAZAAR_RSA_KEY === '1') {
    throw new Error('Signed Bazaar QA builds require TERMEH_BAZAAR_RSA_PUBLIC_KEY repository variable');
  }
  console.log('Bazaar public RSA not configured; QA billing checks fail closed.');
  process.exit(0);
}

assert.match(key, /^[A-Za-z0-9+/]+={0,2}$/, 'Bazaar public key must be base64, with no header or quotes');
const der = Buffer.from(key, 'base64');
assert(der.length >= 140 && der.length <= 4096, 'Bazaar RSA public key has unexpected length');
assert.equal(der.toString('base64'), key, 'Bazaar key was pasted incorrectly or includes extra characters');
const parsed = crypto.createPublicKey({key: der, format:'der', type:'spki'});
assert.equal(parsed.asymmetricKeyType, 'rsa', 'Bazaar public key must be an RSA SubjectPublicKeyInfo key');
const bits = parsed.asymmetricKeyDetails?.modulusLength || 0;
assert(bits >= 1024, 'Bazaar RSA public key appears to be truncated or too small');
console.log('PASS: Bazaar RSA public key is complete, valid DER/SPKI RSA ('+bits+' bits), ready for signed QA. No payment is enabled.');
