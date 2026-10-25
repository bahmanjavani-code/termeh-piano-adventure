'use strict';
// Guardrails for the owner-selected serverless billing architecture.
// This is NOT a payment test; checkout must remain disabled until full QA.
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
assert.doesNotMatch(java,/\.purchaseProduct\s*\(/,'Checkout must stay off until tests and content are ready');
assert.match(ui,/<button id="buyPremiumBtn"[^>]*\bdisabled\b/);
assert.match(ui,/<button id="restorePremiumBtn"[^>]*\bdisabled\b/);
assert.match(ui,/window\.checkBazaarOwnership=function/);
assert.doesNotMatch(ui,/localStorage\.setItem\(['"](?:premium|termeh_premium_unlocked)['"]/);
assert.doesNotMatch(release,/trebleExtra|debug-full-preview|beatsLabel/);
assert.match(gradle,/implementation 'com\.github\.cafebazaar\.Poolakey:poolakey:2\.3\.0'/);
console.log('PASS: serverless plan safety guardrails. Checkout OFF, lifetime SKU not consumed, signature and SKU/state checks present, release lessons not exposed.');
