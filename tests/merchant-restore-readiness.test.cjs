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
// Regression: native parent confirmation should render paragraph breaks.
const singleEscapedNewline=String.fromCharCode(92,110,92,110);
const doubleEscapedNewline=String.fromCharCode(92,92,110,92,92,110);
assert(bridge.includes(' = ?'+singleEscapedNewline+'Then Bazaar will show'),
  'English parent dialog must render proper line breaks');
assert(bridge.includes(' = ؟'+singleEscapedNewline+'سپس بازار قیمت'),
  'Persian parent dialog must render proper line breaks');
assert(!bridge.includes(doubleEscapedNewline),
  'Native parent dialog must not display escape sequences as visible text');
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
assert(html.includes('offer.hidden=!(known||window.termehPriorOwnerRestoreSupported||owned)'),
  'Read-only Bazaar price and restore path must remain visible when NEW sales are paused');
assert(bridge.includes('private boolean catalogLookupConfigured()')
       && bridge.includes('if (!catalogLookupConfigured())')
       && bridge.includes('BuildConfig.BAZAAR_CHECKOUT_ENABLED ? "offer_ready" : "offer_readonly"'),
  'Nonchargeable signed QA must query the real Bazaar SKU without granting permission to charge');
assert(html.includes("const ready=known && code==='offer_ready'"),
  'Only an EXPLICIT live-purchase SKU state can reveal a buy button');
assert(html.includes('buy.hidden=!ready') && html.includes('buy.disabled=!ready'),
  'A known price in a safe QA build can never enable a monetary action');
assert(html.includes("const ready=known && code==='offer_ready' && !owned;"),
  'A customer with a verified lifetime entitlement must not see a second checkout');
assert(html.includes('window.refreshBazaarPurchaseOwnership()'),
  'Verified ownership and refund revocation must update the offered SKU display');
assert(html.includes("if(window.TERMEH_NATIVE_PREMIUM){window.termehBazaarStatus('restore_active');return;}"),
  'Parent checkout action must stop immediately if lifetime ownership is already verified');


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
const icon=fs.readFileSync('app/src/main/res/drawable-nodpi/ic_termeh_store.webp');
const iconDigest=require('node:crypto').createHash('sha256').update(icon).digest('hex');
assert(icon.length>20000 && icon.subarray(0,4).toString('ascii')==='RIFF'
       && icon.subarray(8,12).toString('ascii')==='WEBP',
  'Launcher artwork must be the user-approved Termeh+panda image (valid full-resolution WebP)');
assert.equal(iconDigest, 'aba238c1e86ce6455af20a911f7cc50e60f3a3c84ba98839a4bfdb51d279ec27',
  'The approved store and installed-app icon must not be silently changed');
assert(manifest.includes('android:icon="@drawable/ic_termeh_store"'),
  'Android launcher must use the same approved artwork shown in the Bazaar listing');
console.log('PASS: prior ownership rechecked on resume; restore while sales paused; no accidental checkout, refund race, misplaced hidden button or signing key change.');
