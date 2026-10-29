'use strict';
// Guardrails for the owner-selected serverless billing architecture.
// This is NOT a payment test; real checkout remains compile-time OFF without merchant QA.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const java=read('app/src/main/java/com/termeh/piano/BazaarBillingBridge.java');
const ui=read('app/src/main/assets/index.html');
const release=read('app/src/release/assets/premium-preview.js');
const gradle=read('app/build.gradle');
assert.match(java,/SecurityCheck\.Enable\(key\)/,'Bazaar signature checking must be enabled');
assert.match(java,/LIFETIME_SKU\s*=\s*"termeh_premium_lifetime"/);
assert.match(java,/getPurchaseState\(\)\s*==\s*PurchaseState\.PURCHASED/);
assert.match(java,/PACKAGE_ID\.equals\(purchase\.getPackageName\(\)\)/);
assert.match(java,/LIFETIME_SKU\.equals\(purchase\.getProductId\(\)\)/);
assert.doesNotMatch(java,/\.consumeProduct\s*\(/,'Lifetime purchase must never be consumed');
assert.match(java,/\.purchaseProduct\s*\(/,'Poolakey product flow should now be implemented behind a compile-time gate');
assert.match(java,/VerifiedPremiumLessons\.enabled\(\)/,'Native paid pack and verified entitlement are required');
assert.match(java,/if \(!checkoutConfigured\(\) \|\| !catalogReady \|\| catalogPrice\.isEmpty\(\)\)/,
  'Checkout must be impossible without active merchant SKU price');
assert.match(java,/new AlertDialog\.Builder\(activity\)/,
  'Require a native parent purchase confirmation before opening Bazaar');
assert.match(java,/new SecureRandom\(\)/,'No fixed parent challenge for monetary actions');
assert.match(java,/if \(!expected\.equals\(normalizeParentAnswer\(answer\.getText\(\)\)\)\)/,
  'Wrong native math answer blocks charging regardless of JS WebView state');
assert.match(java,/Character\.digit\(candidate\.charAt\(i\), 10\)/,
  'Persian and Arabic digit keypads must be supported in native guardian confirmation');
assert.match(java,/purchaseInProgress\.set\(false\);\s*publishStatus\("parent_verification_required"\)/,
  'Native guard must reset state without charging on a failed parental check');
assert.match(java,/restoreVerifiedPurchase\(\);/,
  'Purchase callback must re-query signed Bazaar inventory');
assert.match(gradle,/System\.getenv\('TERMEH_ENABLE_LIVE_CHECKOUT'\) == '1'/,
  'Real paid flow is OFF by default and requires a separate signed opt-in');
assert.match(gradle,/if \(liveRequested && !paidReady\)/,
  'No real payments without RSA, AES data and valid owner delivery');
assert.match(java,/BuildConfig\.BAZAAR_RSA_PUBLIC_KEY/);
assert.match(ui,/<button id="buyPremiumBtn"[^>]*\bdisabled\b/);
assert.match(ui,/<button id="restorePremiumBtn"[^>]*\bdisabled\b/);
assert.match(ui,/window\.checkBazaarOwnership=function/);
assert.doesNotMatch(ui,/localStorage\.setItem\(['"](?:premium|termeh_premium_unlocked)['"]/);
assert.doesNotMatch(release,/trebleExtra|debug-full-preview|beatsLabel/);
assert.match(gradle,/implementation 'com\.github\.cafebazaar\.Poolakey:poolakey:2\.3\.0'/);
console.log('PASS: serverless plan safety guardrails. Checkout OFF, lifetime SKU not consumed, signature and SKU/state checks present, release lessons not exposed.');
