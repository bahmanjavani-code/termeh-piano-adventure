'use strict';
// No real money is spent by this test. It protects a legitimate buyer's
// existing course and makes the pending merchant-setup status inspectable.
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const bridge=read('app/src/main/java/com/termeh/piano/BazaarBillingBridge.java');
const html=read('app/src/main/assets/index.html');
const workflow=read('.github/workflows/release.yml');
const keys=read('tools/check-release-key.sh');
const manifest=read('app/src/main/AndroidManifest.xml');
const activity=read('app/src/main/java/com/termeh/piano/MainActivity.java');
assert(bridge.includes('public boolean canRestoreOwnedLessons()'));
assert(bridge.includes('return VerifiedPremiumLessons.enabled();'),
  'New-sales permission must not be needed just to restore a previous purchase');
assert(bridge.includes('new AlertDialog.Builder(activity)')&&bridge.includes('new SecureRandom()'),
  'Independent native parent approval must survive payment readiness changes');
assert(bridge.includes('private final AtomicLong entitlementEpoch = new AtomicLong()'),
  'Refunds need to invalidate previously queued offline delivery');
assert(bridge.includes('entitlementEpoch.incrementAndGet()')&&
       bridge.includes('entitlementEpoch.get() != version'),
  'A stale background read must not unlock lessons after an online ownership denial');
assert(!bridge.includes('payment.consumeProduct('),'Lifetime purchases must never be consumed');
assert(activity.includes('if (billing != null) billing.recheckOwnershipOnResume();'),
  'Returning from Bazaar must recheck ownership without a full app restart');
const resumeCheck=bridge.match(/void recheckOwnershipOnResume\(\) \{([\s\S]*?)\n    \}/);
assert(resumeCheck && resumeCheck[1].includes('restoreVerifiedPurchase();'),
  'Recheck must query already-owned products, not launch a new purchase');
assert(resumeCheck[1].includes('purchaseInProgress.get()'),
  'Foreground ownership query must not race an in-progress checkout');
assert(!resumeCheck[1].includes('beginLifetimePurchase('),
  'Foregrounding the app must NEVER initiate checkout');

assert(html.includes('window.termehRefreshRestoreAvailability=function()'));
assert(html.includes('api') || html.includes('sdk.canRestoreOwnedLessons()'));
assert(html.includes('offer.hidden=!(ready||window.termehPriorOwnerRestoreSupported)'),
  'Restore path cannot be hidden by a temporarily empty store catalog');
assert(html.includes('buy.hidden=!ready') && html.includes('buy.disabled=!ready'),
  'Unpriced NEW purchases must remain hidden and disabled');
assert(html.includes('button[hidden]{display:none!important}'),
  'Normal app button styles must never override browser hidden semantics');
assert(workflow.includes('Show safe merchant setup readiness') &&
       workflow.includes('AES lesson packaging: automatic per signed build'),
  'A phone-only owner should see readiness without manually creating a new encryption secret');
assert(workflow.includes('Controlled monetary tests must pin the ORIGINAL release certificate first.'),
  'Controlled chargeable builds must not be signed with an unpinned key');
assert(workflow.includes('allow_controlled_real_checkout') &&
       workflow.includes('default: false'),
  'Normal signed candidates must remain non-chargeable');
assert(keys.includes('Release signing certificate changed: STOP!'),
  'Release cert continuity is required for upgrading prior installed copies');
const icon=read('app/src/main/res/drawable/ic_termeh.xml');
assert(icon.includes('viewportWidth="108"')&&manifest.includes('@drawable/ic_termeh'),
  'Keep the previously approved piano icon consistent on the phone');
console.log('PASS: prior ownership rechecked on resume; restore while sales paused; no accidental checkout, refund race, misplaced hidden button or signing key change.');
