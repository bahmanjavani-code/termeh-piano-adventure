'use strict';
// Hard stop before Cafe Bazaar can open an actual payment UI.
// Buying is always optional, never automatic, and consent is native.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const java=fs.readFileSync('app/src/main/java/com/termeh/piano/BazaarBillingBridge.java','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const gradle=fs.readFileSync('app/build.gradle','utf8');
const snippet=java.substring(java.indexOf('public void beginLifetimePurchase('),java.indexOf('public void beginLifetimePurchase(')+11000);
assert(java.includes('private volatile String catalogPrice = ""'),
  'Official store catalog price should be native and fail closed by default');
assert(java.includes('catalogPrice = found ? price : ""'),
  'Never accept price injected by JavaScript instead of official Bazaar SDK');
assert((java.match(/catalogPrice = "";/g)||[]).length>=3,
  'Clear cached official catalog price when SKU availability is lost');
assert(snippet.includes('new CheckBox(activity)')&&snippet.includes('consent.setChecked(false)'),
  'Parent must opt in by default, not start with a checked consent');
assert(snippet.includes('String officialPrice = catalogPrice;'),
  'Show the actual Bazaar catalog price before charging');
assert(snippet.includes('قیمت رسمی کاتالوگ بازار: ')&&snippet.includes('Official Bazaar catalog price: '),
  'Native dialog must show the current price in Persian and English');
assert(snippet.includes('حقوق قانونی خریدار محفوظ است')&&snippet.includes('statutory buyer rights apply'),
  'Must not falsely claim blanket refund prohibition or waive consumer rights');
assert(snippet.includes('بازپرداخت تضمین‌شده نیست')&&snippet.includes('Refunds are not guaranteed'),
  'Be transparent that refunds are not automatic');
const reject=snippet.indexOf('if (!consent.isChecked())');
const math=snippet.indexOf('if (!expected.equals(normalizeParentAnswer(answer.getText())))');
const pay=snippet.indexOf('payment.purchaseProduct(');
assert(reject>0&&math>reject&&pay>math,
  'Unchecked explicit consent and failed parent challenge must reject BEFORE Bazaar checkout');
assert(snippet.substring(reject,math).includes('publishStatus("purchase_terms_not_accepted")'),
  'A declined consent must never open Bazaar checkout');
assert(snippet.includes('if (!checkoutConfigured() || !catalogReady || catalogPrice.isEmpty())'),
  'Bail out if official Bazaar SKU price or merchant capability is unavailable');
assert(html.includes('id="realBazaarTerms"')&&html.includes('بازپرداخت تضمین‌شده نیست'),
  'Consumer terms must be visible before the purchase button');
assert(html.includes('purchase_terms_not_accepted:'),
  'Consent decline must explain that no checkout or charge occurred');
assert(gradle.includes("System.getenv('TERMEH_ENABLE_LIVE_CHECKOUT') == '1'"),
  'Automated builds still compile real charging OFF by default');
assert(gradle.includes("applicationIdSuffix '.ceo'"),
  'Personal CEO edition remains isolated from production purchases');
assert(!snippet.includes('payment.consumePurchase('),
  'Lifetime non-consumable product cannot be consumed');
console.log('PASS: parent opt-in, real Bazaar price, honest refund terms, native math check and zero accidental checkout.');
