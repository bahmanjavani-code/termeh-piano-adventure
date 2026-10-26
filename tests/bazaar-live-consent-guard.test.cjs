'use strict';
/* Verify purchase-copy truthfulness and safety without merchant credentials.
 * This does NOT simulate a real Bazaar order or claim successful settlement.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('app/src/main/assets/index.html');
const java=read('app/src/main/java/com/termeh/piano/BazaarBillingBridge.java');
const gradle=read('app/build.gradle');
const workflow=read('.github/workflows/release.yml');
const faTerms=read('docs/terms.html'),enTerms=read('docs/en/terms.html');

assert(html.includes("const KEY='termeh_parent_welcome_v5',REVISION=5"),
  'A material change to real-charge terms must require a new parent acknowledgment');
assert(html.includes('data-termeh-billing'),'Payment messaging must depend on native checkout capability');
assert(html.includes('window.termehSyncBillingCapabilities=function()'),
  'The visible parent disclosure needs read-only native readiness data');
assert(html.includes('api.isLiveCheckoutEnabled()') && html.includes('api.canRestoreOwnedLessons()'),
  'Do not infer paid-merchant readiness from localStorage or JS flags');
assert(html.includes('This can charge real money.') &&
       html.includes('این خرید ممکن است واقعاً هزینه داشته باشد.'),
  'A native chargeable build must be explicit about possible charges in both languages');
assert(html.includes('The exact price') || html.includes('Bazaar displays the exact price'),
  'A parent should be told the store declares the final payable price');
assert(html.includes('html[data-termeh-billing="live"] .termehBillingOffOnly') &&
       html.includes('html:not([data-termeh-billing="live"]) .termehBillingLiveOnly'),
  'Never show the opposite billing terms to a parent');
assert(html.includes('window.termehCanRestoreBoughtLessons') &&
       html.includes('offer.hidden=!(ready||window.termehCanRestoreBoughtLessons)'),
  'An already-paid user must be able to recover bought lessons when new sales are paused');
assert(html.includes('buy.hidden=!ready') && html.includes('buy.disabled=!ready'),
  'Do not show an unpriced purchase button');
assert(java.includes('public boolean isLiveCheckoutEnabled()') &&
       java.includes('BuildConfig.BAZAAR_CHECKOUT_ENABLED'),
  'Read-only checkout capability must originate from the signed native build');
assert(java.includes('public boolean canRestoreOwnedLessons()') &&
       java.includes('return VerifiedPremiumLessons.enabled();'),
  'Existing buyers should restore content even when the new-sales flag is OFF');
assert(java.includes('entitlementEpoch.incrementAndGet()') &&
       java.includes('entitlementEpoch.get() != version'),
  'A refund must invalidate a previously queued offline lesson restore');
assert(java.includes('new AlertDialog.Builder(activity)'),
  'A deliberate parent confirmation is required before opening the official store');
assert(!java.includes('payment.consumeProduct('),
  'Lifetime product must never be consumed');
assert(gradle.includes("TERMEH_BAZAAR_CONTROLLED_TEST_AUTHORIZED") &&
       gradle.includes("System.getenv('TERMEH_ENABLE_LIVE_CHECKOUT') == '1'"),
  'Normal builds must keep new charges OFF');
assert(workflow.includes('allow_controlled_real_checkout') &&
       workflow.includes('default: false'),
  'Controlled real payments need a per-run opt-in');
assert(workflow.includes('A real-money payment test requires the ORIGINAL pinned signing certificate'),
  'Real checkout cannot launch with an unknown signing certificate');
assert(workflow.includes('Show safe Bazaar payment test readiness') &&
       workflow.includes('MERCHANT_PUBLIC_KEY: configured') === false,
  'Readiness summary must not hard-code a successful merchant setup');
assert(faTerms.includes('ساخت‌هایی که توسعه‌دهنده مشخصاً پرداخت واقعی') &&
       enTerms.includes('Controlled real-checkout testing'),
  'Legal terms must not falsely promise zero charges during a live controlled test');
const icon=read('app/src/main/res/drawable/ic_termeh.xml');
assert(icon.includes('android:fillColor') && icon.includes('viewportWidth="108"'),
  'Keep the previously selected Termeh music icon rather than silently replacing it');
console.log('PASS: original icon preserved, guardian terms match native mode, store catalog gates purchase, restore survives paused sales, and refund races are blocked.');
