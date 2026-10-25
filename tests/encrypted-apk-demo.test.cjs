'use strict';
// QA-only native lesson pack proof. Demo key/lesson are intentionally PUBLIC.
// The fixture is not commercial content and must never activate a purchase.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const packText = fs.readFileSync('app/src/main/assets/premium-demo-pack.json', 'utf8');
const pack = JSON.parse(packText);
const decoder = fs.readFileSync('app/src/main/java/com/termeh/piano/PremiumPackReader.java', 'utf8');
const demo = fs.readFileSync('app/src/main/java/com/termeh/piano/PremiumPackDemo.java', 'utf8');
const bridge = fs.readFileSync('app/src/main/java/com/termeh/piano/BazaarBillingBridge.java', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
const match = demo.match(/PUBLIC_TEST_KEY_HEX\s*=\s*"([a-f0-9]{64})"/);
assert(match, 'Dummy demo AES key missing');
const key = Buffer.from(match[1], 'hex');
const aad = Buffer.from('com.termeh.piano|termeh_premium_lifetime|TPK1');

function open(envelope, secret) {
  assert.equal(envelope.format, 'TPK1');
  assert.equal(envelope.packageName, 'com.termeh.piano');
  assert.equal(envelope.productId, 'termeh_premium_lifetime');
  const nonce = Buffer.from(envelope.nonce, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const bytes = Buffer.from(envelope.ciphertext, 'base64');
  assert.equal(nonce.length, 12);
  assert.equal(tag.length, 16);
  const cipher = crypto.createDecipheriv('aes-256-gcm', secret, nonce);
  cipher.setAAD(aad);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(bytes), cipher.final()]);
}

const clear = open(pack, key);
const data = JSON.parse(clear.toString('utf8'));
assert.deepEqual(data, {
  schema: 1, productId: 'termeh_premium_lifetime', demo: true,
  lessons: [{ id: 'encrypted_demo_only', title: 'تمرین نمونهٔ رمزگذاری‌شده (غیرقابل فروش)' }]
});
assert(!packText.includes('تمرین نمونه'),'Never include demo plaintext inside shipped pack');
assert(!packText.includes('encrypted_demo_only'),'Never include lesson IDs in plaintext pack');
assert(!packText.includes(match[1]),'Demo key must not be bundled in the pack envelope');
assert.throws(() => open(pack, crypto.randomBytes(32)), 'Wrong key must fail');
const badTag = { ...pack, tag: Buffer.alloc(16).toString('base64') };
assert.throws(() => open(badTag, key), 'Modified AES tag must fail');
const mutated = Buffer.from(pack.ciphertext, 'base64'); mutated[0] ^= 1;
assert.throws(() => open({ ...pack, ciphertext: mutated.toString('base64') }, key));
assert.match(decoder, /AES\/GCM\/NoPadding/);
assert.match(decoder, /cipher\.updateAAD\(AAD\)/);
assert.match(decoder, /cipher\.doFinal\(ciphertextWithTag\)/);
assert.match(decoder, /MAX_ENVELOPE_BYTES/);
assert.match(decoder, /new JSONObject/);
assert.doesNotMatch(decoder, /@JavascriptInterface/);
assert.match(demo, /NONCOMMERCIAL AES-256-GCM DEMO ONLY/);
assert.match(bridge, /checkEncryptedDemoPack\(\)/);
assert.match(html, /id="checkEncryptedPackBtn"/);
assert.match(html, /demo_pack_ok/);
assert.match(html, /demo_pack_failed/);
assert.match(html, /id="buyPremiumBtn"[^>]*disabled/);
assert.match(html, /id="restorePremiumBtn"[^>]*disabled/);
console.log('PASS: encrypted APK demo authenticates, wrong key and tampering fail. Sample-only; paid checkout and unlock remain OFF.');
