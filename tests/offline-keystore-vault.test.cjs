'use strict';
// Offline no-host entitlement cache review/contract test.
// This is NOT an Android Keystore integration test or a real Bazaar purchase.
// The device-only self-test in the parent menu tests the actual Android Keystore.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vault = fs.readFileSync('app/src/main/java/com/termeh/piano/OfflineLicenseVault.java','utf8');
const bridge = fs.readFileSync('app/src/main/java/com/termeh/piano/BazaarBillingBridge.java','utf8');
const html = fs.readFileSync('app/src/main/assets/index.html','utf8');
const manifest = fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
const read = (pattern, msg) => assert.match(vault,pattern,msg);

read(/KeyStore\.getInstance\("AndroidKeyStore"\)/,'Use Android system Keystore');
read(/KeyProperties\.KEY_ALGORITHM_AES/,'Use AES Keystore');
read(/KeyProperties\.PURPOSE_ENCRYPT\s*\|\s*KeyProperties\.PURPOSE_DECRYPT/);
read(/\.setKeySize\(256\)/,'Use AES-256');
read(/\.setBlockModes\(KeyProperties\.BLOCK_MODE_GCM\)/);
read(/\.setEncryptionPaddings\(KeyProperties\.ENCRYPTION_PADDING_NONE\)/);
read(/\.setRandomizedEncryptionRequired\(true\)/);
read(/cipher\.updateAAD\(AAD\)/);
read(/cipher\.doFinal\(ciphertext\)/,'Do not permit bad GCM tags');
read(/new GCMParameterSpec\(128, nonce\)/);
read(/nonce\.length != 12/);
read(/android\.content\.SharedPreferences/);
read(/Context\.MODE_PRIVATE/);
read(/getApplicationContext\(\)/);
read(/BazaarBillingBridge\.PACKAGE_ID\.equals\(purchase\.getPackageName\(\)\)/);
read(/BazaarBillingBridge\.LIFETIME_SKU\.equals\(purchase\.getProductId\(\)\)/);
read(/purchase\.getPurchaseState\(\) != PurchaseState\.PURCHASED/);
read(/record\.put\("verifiedAt", System\.currentTimeMillis\(\)\)/);
read(/boolean clearAfterConfirmedNotOwned\(\)/);
assert.doesNotMatch(vault,/@JavascriptInterface/,'Never expose actual offline entitlement');
assert.doesNotMatch(vault,/getPurchaseToken\(|getOrderId\(|getAccountId\(/,'Do not persist receipts or account identifiers');
assert.doesNotMatch(vault,/localStorage/,'WebView storage is not native entitlement');
assert.match(vault, /boolean disposableSelfTest\(\)/);
const selfTest = vault.split('boolean disposableSelfTest()')[1];
assert(selfTest,'No disposable Keystore test');
assert(selfTest.includes('DEMO_ALIAS') && selfTest.includes('DEMO_PREFS'),'Self-test requires isolated key and preferences');
assert(!selfTest.includes('recordVerifiedPurchase(') && !selfTest.includes('isOwnedOffline('),'Self-test cannot create an entitlement');
assert.match(bridge, /checkOfflineVaultDemo\(\)/);
assert.match(bridge, /new OfflineLicenseVault\(activity\)\.disposableSelfTest\(\)/);
assert.match(html, /id="checkOfflineVaultBtn"/);
assert.match(html, /vault_demo_ok/);
assert.match(html, /vault_demo_failed/);
assert.match(html, /id="buyPremiumBtn"[^>]*disabled/);
assert.match(html, /id="restorePremiumBtn"[^>]*disabled/);
assert.match(manifest, /android:allowBackup="false"/,'Do not back up Keystore-encrypted record');

const key=crypto.randomBytes(32), iv=crypto.randomBytes(12);
const aad=Buffer.from('com.termeh.piano|termeh_premium_lifetime|vault-v1');
const clear=Buffer.from(JSON.stringify({schema:1,packageName:'com.termeh.piano',productId:'termeh_premium_lifetime',purchaseState:'PURCHASED',verifiedAt:Date.now()}));
const enc=crypto.createCipheriv('aes-256-gcm',key,iv);enc.setAAD(aad);
const ciphertext=Buffer.concat([enc.update(clear),enc.final(),enc.getAuthTag()]);
function open(input,deviceKey,context){
  const dec=crypto.createDecipheriv('aes-256-gcm',deviceKey,iv);
  dec.setAAD(context);
  dec.setAuthTag(input.subarray(input.length-16));
  return Buffer.concat([dec.update(input.subarray(0,-16)),dec.final()]);
}
assert.deepEqual(open(ciphertext,key,aad),clear);
assert.throws(()=>open(ciphertext,crypto.randomBytes(32),aad),'Other phone key cannot decrypt');
assert.throws(()=>open(ciphertext,key,Buffer.from('another-product')),'Different app/SKU must fail');
const changed=Buffer.from(ciphertext);changed[0]^=1;
assert.throws(()=>open(changed,key,aad),'Tampered record must fail');
console.log('PASS: native Keystore vault contract, isolated demo test, and AES-GCM tamper/identity simulations. NO purchase or premium unlock.');
