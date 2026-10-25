'use strict';

/**
 * Server-side premium activation core. NOT an HTTP endpoint or an app module.
 *
 * All three injected functions must run on a trusted HTTPS BACKEND:
 *  - verifyWithBazaar(token, fixed app/sku): contacts Bazaar using SERVER-ONLY credentials;
 *    returns a normalized server-authenticated purchase result, NEVER request JSON.
 *  - registerDevice(tokenHash, publicKeyHash): server-side atomic rate/abuse control;
 *    return true only when activating/restoring this genuine account is allowed.
 *  - loadPack(): returns the private AES pack and its private 32-byte AES key.
 *
 * No production adapter, deployment, merchant token or real premium pack exists yet.
 * This library NEVER enables checkout and NEVER returns plaintext paid lessons.
 */

const crypto = require('node:crypto');
const { PACKAGE_NAME, SKU, FORMAT } = require('../tools/secure-premium-pack.cjs');

function reject() {
  // Avoid reflecting receipts, token formats, secrets or internal upstream responses.
  throw new Error('Premium activation unavailable or not authorized');
}

function decodeDeviceKey(spkiBase64) {
  if (typeof spkiBase64 !== 'string' || spkiBase64.length < 200 ||
      spkiBase64.length > 2500 || !/^[A-Za-z0-9+/]+={0,2}$/.test(spkiBase64)) reject();
  const der = Buffer.from(spkiBase64, 'base64');
  if (der.toString('base64') !== spkiBase64) reject();
  let key;
  try { key = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' }); }
  catch { reject(); }
  if (key.asymmetricKeyType !== 'rsa' ||
      (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) reject();
  return { key, der };
}

function validatePack(envelope, contentKey) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) ||
      envelope.format !== FORMAT || envelope.packageName !== PACKAGE_NAME ||
      envelope.productId !== SKU ||
      typeof envelope.ciphertext !== 'string' ||
      typeof envelope.nonce !== 'string' ||
      typeof envelope.tag !== 'string' ||
      envelope.ciphertext.length < 2 || envelope.ciphertext.length > 3000000 ||
      Buffer.from(envelope.nonce, 'base64').length !== 12 ||
      Buffer.from(envelope.tag, 'base64').length !== 16 ||
      !Buffer.isBuffer(contentKey) || contentKey.length !== 32) reject();
  // The backend must authenticate the existing private encrypted pack with its key.
  const decryptor = crypto.createDecipheriv('aes-256-gcm', contentKey,
    Buffer.from(envelope.nonce, 'base64'));
  decryptor.setAAD(Buffer.from(PACKAGE_NAME + '|' + SKU + '|' + FORMAT, 'utf8'));
  decryptor.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  try {
    const clear = Buffer.concat([
      decryptor.update(Buffer.from(envelope.ciphertext, 'base64')),
      decryptor.final()
    ]);
    if (!clear.length || clear.length > 2 * 1024 * 1024) reject();
    const parsed = JSON.parse(clear.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) reject();
    clear.fill(0);
  } catch { reject(); }
}

/**
 * Token and device public key are UNTRUSTED input. The server must re-check Bazaar
 * for EVERY new activation/restore before calling registerDevice/loadPack.
 */
async function activateLifetime({ purchaseToken, devicePublicKeySpki,
  verifyWithBazaar, registerDevice, loadPack }) {
  if (typeof purchaseToken !== 'string' || purchaseToken.length < 10 ||
      purchaseToken.length > 2048 || /[\u0000-\u001f]/.test(purchaseToken) ||
      typeof verifyWithBazaar !== 'function' ||
      typeof registerDevice !== 'function' ||
      typeof loadPack !== 'function') reject();

  const device = decodeDeviceKey(devicePublicKeySpki);
  let verified;
  try {
    verified = await verifyWithBazaar({
      purchaseToken, packageName: PACKAGE_NAME, productId: SKU
    });
  } catch { reject(); }

  // Only normalized data produced by a trusted Bazaar API adapter, never client JSON.
  if (verified?.verified !== true || verified.packageName !== PACKAGE_NAME ||
      verified.productId !== SKU || verified.purchaseState !== 'PURCHASED') reject();

  const tokenHash = crypto.createHash('sha256').update(purchaseToken).digest('hex');
  const deviceKeyHash = crypto.createHash('sha256').update(device.der).digest('hex');

  let permitted;
  try {
    permitted = await registerDevice({
      tokenHash, deviceKeyHash, packageName: PACKAGE_NAME, productId: SKU
    });
  } catch { reject(); }
  if (permitted !== true) reject();

  let pack;
  try { pack = await loadPack(); } catch { reject(); }
  if (!pack || typeof pack.keyHex !== 'string' ||
      !/^[0-9a-f]{64}$/i.test(pack.keyHex)) reject();
  const key = Buffer.from(pack.keyHex, 'hex');
  try {
    validatePack(pack.envelope, key);
    const wrapped = crypto.publicEncrypt({
      key: device.key,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    }, key);
    return {
      schema: 1,
      packageName: PACKAGE_NAME,
      productId: SKU,
      wrapping: 'RSA-OAEP-SHA256',
      deviceKeySha256: deviceKeyHash,
      wrappedContentKey: wrapped.toString('base64'),
      encryptedPack: pack.envelope
    };
  } catch { reject(); }
  finally { key.fill(0); }
}

module.exports = { activateLifetime };
