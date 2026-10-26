'use strict';
// Regression checks for a NO-CHARGE previous-purchase restoration path.
// This test does NOT contact Bazaar; it checks the native callback structure.
// A real Bazaar account purchase and refund still require device/store QA.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const java=fs.readFileSync('app/src/main/java/com/termeh/piano/BazaarBillingBridge.java','utf8');
const vault=fs.readFileSync('app/src/main/java/com/termeh/piano/OfflineLicenseVault.java','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const release=fs.readFileSync('app/src/release/assets/premium-preview.js','utf8');

const start=java.indexOf('public void restoreVerifiedPurchase()');
const end=java.indexOf('private void publishStatus(',start);
assert(start>0&&end>start,'Native restore handler missing');
const section=java.slice(start,end);
assert.match(section,/activity\.runOnUiThread\(/);
assert.match(section,/if \(destroyed\) return;/);
assert.match(section,/!connected \|\| payment == null/);
assert.match(java,/new AtomicBoolean\(false\)/); // safe re-entrancy guard
assert.match(section,/restoreInProgress\.compareAndSet\(false, true\)/);
assert.match(section,/payment\.getPurchasedProducts\(callback ->/);
assert.match(section,/callback\.querySucceed\(purchases ->/);
assert.match(section,/callback\.queryFailed\(error ->/);
assert.match(section,/PACKAGE_ID\.equals\(purchase\.getPackageName\(\)\)/);
assert.match(section,/LIFETIME_SKU\.equals\(purchase\.getProductId\(\)\)/);
assert.match(section,/purchase\.getPurchaseState\(\) == PurchaseState\.PURCHASED/);
assert.match(section,/vault\.recordVerifiedPurchase\(owned\)/);
assert.match(section,/vault\.isOwnedOffline\(\)/);
assert.match(section,/vault\.clearAfterConfirmedNotOwned\(\)/);
assert.match(section,/restore_cached_no_unlock/);
assert.match(section,/restore_no_purchase/);
assert.match(section,/restore_failed/);
assert.match(section,/new Thread\(\(\) ->/);
assert.doesNotMatch(section,/purchaseProduct\(|consumeProduct\(|getPurchaseToken\(|evaluateJavascript\(/,
    'No checkout, consume, raw receipt or arbitrary JS in native restore');
assert.doesNotMatch(section,/PremiumPackReader\.decrypt\(|TERMEH_DEBUG_PREMIUM|\.getAssets\(/,
    'A restore query cannot unlock or decrypt paid content directly');
const failCallback=section.match(/callback\.queryFailed\(error -> \{([\s\S]*?)\}\);/);
assert(failCallback,'Missing Bazaar error branch');
assert.doesNotMatch(failCallback[1],/clearAfterConfirmedNotOwned|recordVerifiedPurchase/,
    'No entitlement mutation when Bazaar query fails');
const unsupportedCallback=section.match(/if \(purchases == null\) \{([\s\S]*?)\}/);
assert(unsupportedCallback,'Null purchase list must fail closed');
assert.doesNotMatch(unsupportedCallback[1],/clearAfterConfirmedNotOwned|recordVerifiedPurchase/);
assert.match(vault,/purchase\.getPurchaseState\(\) != PurchaseState\.PURCHASED/);
assert.match(vault,/\bboolean clearAfterConfirmedNotOwned\(\)/);
assert.doesNotMatch(vault,/@JavascriptInterface|\.getPurchaseToken\(/,
    'JS must not set stored entitlement and tokens must not be cached');
assert.match(html, /id="restoreExistingBazaarBtn"[^>]*onclick="restoreExistingBazaarPurchase\(\)"/);
assert.match(html, /window\.restoreExistingBazaarPurchase=function\(\)/);
for(const state of ['restore_checking','restore_no_purchase','restore_cached_no_unlock',
    'restore_failed','restore_unavailable','restore_busy']) {
  assert(html.includes(state),'Missing user-visible restore status: '+state);
}
assert.match(html, /id="buyPremiumBtn"[^>]*disabled/);
assert.match(html, /id="restorePremiumBtn"[^>]*disabled/);
assert(!release.includes('debug-full-preview')&&!release.includes('beatsLabel'));
console.log('PASS: no-charge Bazaar restore is signature-gated, native-only, fail-closed, keeps checkout and paid lessons OFF.');
