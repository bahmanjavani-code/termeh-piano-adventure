// Offline cryptographic contract tests. All Bazaar responses here are MOCKS:
// NO real payment, remote API call, merchant credential or deployed backend.
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { activateLifetime } = require('../server/secure-activation-core.cjs');
const { seal, PACKAGE_NAME, SKU } = require('../tools/secure-premium-pack.cjs');

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'termeh-activation-test-'));
  try {
    const privateLessons = { schema: 1, lessons: [{ id: 'test-only', text: 'NEVER SHIP IN APK' }] };
    fs.writeFileSync(path.join(temp, 'lessons.json'), JSON.stringify(privateLessons));
    seal(path.join(temp, 'lessons.json'), path.join(temp, 'lessons.tpk'), path.join(temp, 'lessons.key'));

    const loadPack = async () => ({
      keyHex: fs.readFileSync(path.join(temp, 'lessons.key'), 'utf8').trim(),
      envelope: JSON.parse(fs.readFileSync(path.join(temp, 'lessons.tpk'), 'utf8'))
    });
    const makeDevice = () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      return {
        publicKeySpki: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
        privateKey
      };
    };
    const a = makeDevice();
    const b = makeDevice();
    const verified = {
      verified: true, packageName: PACKAGE_NAME,
      productId: SKU, purchaseState: 'PURCHASED'
    };
    const registered = new Set();
    const check = async ({ purchaseToken, packageName, productId }) => {
      assert.equal(purchaseToken, 'VALID_TEST_TOKEN_123456');
      assert.equal(packageName, PACKAGE_NAME);
      assert.equal(productId, SKU);
      return verified;
    };
    const registerDevice = async ({ tokenHash, deviceKeyHash, productId, packageName }) => {
      assert.match(tokenHash, /^[a-f0-9]{64}$/);
      assert.match(deviceKeyHash, /^[a-f0-9]{64}$/);
      assert(!tokenHash.includes('VALID_TEST_TOKEN'));
      assert.equal(productId, SKU);
      assert.equal(packageName, PACKAGE_NAME);
      registered.add(deviceKeyHash);
      return true;
    };
    const goodRequest = {
      purchaseToken: 'VALID_TEST_TOKEN_123456',
      devicePublicKeySpki: a.publicKeySpki,
      verifyWithBazaar: check,
      registerDevice,
      loadPack
    };
    const activated = await activateLifetime(goodRequest);
    assert.equal(activated.packageName, PACKAGE_NAME);
    assert.equal(activated.productId, SKU);
    assert.equal(activated.wrapping, 'RSA-OAEP-SHA256');
    assert(!JSON.stringify(activated).includes('VALID_TEST_TOKEN'));
    assert(!JSON.stringify(activated).includes('NEVER SHIP IN APK'));
    assert.equal(registered.size, 1);
    const key = crypto.privateDecrypt({
      key: a.privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256'
    }, Buffer.from(activated.wrappedContentKey, 'base64'));
    assert.equal(key.length, 32);
    const encrypted = activated.encryptedPack;
    const dec = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.nonce, 'base64'));
    dec.setAAD(Buffer.from(PACKAGE_NAME + '|' + SKU + '|TPK1'));
    dec.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
    const plaintext = Buffer.concat([
      dec.update(Buffer.from(encrypted.ciphertext, 'base64')), dec.final()
    ]);
    assert.deepEqual(JSON.parse(plaintext.toString('utf8')), privateLessons);

    assert.throws(() => crypto.privateDecrypt({
      key: b.privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256'
    }, Buffer.from(activated.wrappedContentKey, 'base64')), 'Another phone cannot unwrap this key');

    async function denied(overrides) {
      await assert.rejects(() => activateLifetime({ ...goodRequest, ...overrides }),
        /Premium activation unavailable or not authorized/);
    }
    await denied({ verifyWithBazaar: async () => ({ ...verified, purchaseState: 'REFUNDED' }) });
    await denied({ verifyWithBazaar: async () => ({ ...verified, purchaseState: 'PENDING' }) });
    await denied({ verifyWithBazaar: async () => ({ ...verified, productId: 'wrong_sku' }) });
    await denied({ verifyWithBazaar: async () => ({ ...verified, packageName: 'attacker.package' }) });
    await denied({ verifyWithBazaar: async () => ({ ...verified, verified: false }) });
    await denied({ verifyWithBazaar: async () => { throw new Error('network failed'); } });
    await denied({ verifyWithBazaar: null });
    await denied({ registerDevice: async () => false });
    await denied({ registerDevice: async () => { throw new Error('rate limited'); } });
    await denied({ registerDevice: null });
    await denied({ loadPack: null });
    await denied({ purchaseToken: 'BAD' });
    await denied({ devicePublicKeySpki: b.publicKeySpki.slice(20) });
    const wrongKey = makeDevice();
    await denied({ devicePublicKeySpki: wrongKey.publicKeySpki.replace(/.$/, '-') });
    await denied({ loadPack: async () => {
      const pack = await loadPack();
      pack.envelope.productId = 'wrong_sku';
      return pack;
    } });
    await denied({ loadPack: async () => {
      const pack = await loadPack();
      const bytes = Buffer.from(pack.envelope.ciphertext, 'base64');
      bytes[0] ^= 1;
      pack.envelope.ciphertext = bytes.toString('base64');
      return pack;
    } });

    console.log('PASS: mocked Bazaar authorization and device-bound AES wrapping; rejected refunds, errors, wrong app/SKU, other devices, tampered packs. NO REAL PAYMENT.');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
