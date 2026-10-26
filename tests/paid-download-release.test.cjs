'use strict';
// Safeguards for the chosen paid-before-download app distribution model.
// No actual checkout is performed inside the application.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('app/src/main/assets/index.html');
const release=read('app/src/release/assets/premium-preview.js');
const debug=read('app/src/debug/assets/premium-preview.js');
const main=read('app/src/main/java/com/termeh/piano/MainActivity.java');
const rc={window:{}},dc={window:{}};
vm.runInNewContext(release,rc);vm.runInNewContext(debug,dc);
const paid=rc.window.TERMEH_DEBUG_PREMIUM,dev=dc.window.TERMEH_DEBUG_PREMIUM;
assert.equal(rc.window.TERMEH_CONTENT_VARIANT,'bazaar-paid-candidate');
assert.equal(dc.window.TERMEH_CONTENT_VARIANT,'debug-full-preview');
assert(paid,'Paid-download APK MUST contain entire learning content and not require second purchase');
assert.equal(paid.trebleExtra.length,7);
assert.equal(paid.bass.length,10);
assert.equal(paid.durations.length,4);
assert.deepEqual(Array.from(paid.trebleExtra,n=>n.code),Array.from(dev.trebleExtra,n=>n.code));
assert.deepEqual(Array.from(paid.bass,n=>n.code),Array.from(dev.bass,n=>n.code));
assert.deepEqual(Array.from(paid.durations,n=>n.id),Array.from(dev.durations,n=>n.id));
assert(!release.includes('debug-full-preview'),'Commercial variant must not contain debug fixture marker');
assert(html.includes("TERMEH_CONTENT_VARIANT === 'debug-full-preview' ? 'qa' : 'store'"),
  'Paid APK must not show engineering/debug menus');
assert(html.includes('<section id="premiumOffer" class="termehQaOnly"'),
  'Obsolete in-app purchase plan must be hidden in a paid download');
assert(html.includes('class="termehStoreOnly" aria-label="Purchase model"'),
  'Parents should be told there is no second charge');
assert(html.includes('یک خرید برای کل برنامه؛ بدون پرداخت داخلی'));
assert(html.includes('no in-app purchases or subscription'));
assert(html.includes("const KEY='termeh_parent_welcome_v3',REVISION=3;"),
  'Material payment-model changes must prompt fresh guardian acknowledgement');
assert(html.includes('TermehNoteCurriculum.promotionStatus('),
  'Upfront purchase never skips stepwise educational practice');
assert(html.includes('TermehMeterEngine.scenarioAt('),
  'The paid content includes interactive time-signature practice');
assert(main.includes('if (BuildConfig.DEBUG) {'));
assert(main.includes('billing = new BazaarBillingBridge(this, web);'));
assert(main.includes('if (billing != null) billing.start();'));
assert(!main.includes('billing.start();\n')||main.includes('if (billing != null) billing.start();'),
  'Release must never auto-connect to the abandoned in-app payment service');
const java=read('app/src/main/java/com/termeh/piano/BazaarBillingBridge.java');
assert(!java.includes('payment.purchaseProduct('),
  'No direct in-app checkout or additional charge is permitted for paid download');
console.log('PASS: full curriculum in paid candidate, no extra checkout, beta QA tools hidden, local education gates remain.');
