'use strict';
// CEO is a personal, parallel-installable preview. This must NEVER relax the
// official Bazaar edition's non-consumable ownership, refund or checkout rules.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const gradle=fs.readFileSync('app/build.gradle','utf8');
const activity=fs.readFileSync('app/src/main/java/com/termeh/piano/MainActivity.java','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const ceo=fs.readFileSync('app/src/ceo/assets/premium-preview.js','utf8');
const debug=fs.readFileSync('app/src/debug/assets/premium-preview.js','utf8');
const release=fs.readFileSync('app/src/release/assets/premium-preview.js','utf8');
const workflow=fs.readFileSync('.github/workflows/android.yml','utf8');

assert(gradle.includes("applicationId 'com.termeh.piano'"),'Store app identity changed');
assert(gradle.includes("applicationIdSuffix '.qa'"),'QA identity changed');
assert(gradle.includes("applicationIdSuffix '.ceo'"),'CEO must have independent Android data');
assert(gradle.includes("termehAppLabel: 'Termeh Piano CEO'"),'CEO must be visually distinct');
assert(gradle.includes("buildConfigField 'boolean', 'CEO_EDITION', 'false'"),'Production CEO flag must default OFF');
assert(gradle.includes("buildConfigField 'boolean', 'CEO_EDITION', 'true'"),'CEO flag must be ON only for CEO builds');
assert(/ceo \{[\s\S]*?buildConfigField 'boolean', 'BAZAAR_CHECKOUT_ENABLED', 'false'/.test(gradle),
  'CEO must explicitly have Bazaar checkout OFF');
assert(activity.includes('if (!BuildConfig.CEO_EDITION && (BuildConfig.DEBUG || !BuildConfig.BAZAAR_RSA_PUBLIC_KEY.isEmpty()))'),
  'CEO must not register the native Bazaar payment bridge');
assert(ceo.includes('window.TERMEH_CONTENT_VARIANT = "ceo-full-preview"'), 'CEO course variant absent');
assert(ceo.includes('trebleExtra:')&&ceo.includes('bass:')&&ceo.includes('durations:'),
  'All three CEO course sections must be bundled');
assert(debug.includes('window.TERMEH_CONTENT_VARIANT = "debug-full-preview"'),
  'Existing developer QA must remain unchanged');
assert(release.includes('window.TERMEH_CONTENT_VARIANT = "release-free"')
  && release.includes('window.TERMEH_DEBUG_PREMIUM = null'),
  'Official release must NEVER contain the CEO course');
assert(html.includes("window.TERMEH_CONTENT_VARIANT === 'ceo-full-preview' ? 'ceo'"),
  'The CEO app must render an explicit personal edition label');
assert(html.includes("return window.TERMEH_CONTENT_VARIANT === 'ceo-full-preview'"),
  'CEO full lesson access must not depend on progress or purchases');
assert(html.includes('html[data-termeh-edition="ceo"] #premiumOffer{display:none!important}'),
  'CEO must not display commerce surfaces');
assert(html.includes("if(window.TERMEH_CONTENT_VARIANT==='ceo-full-preview')return;"),
  'CEO must not offer a buy handler');
assert(workflow.includes('gradle --no-daemon :app:assembleCeo'),
  'CEO artifact must build on GitHub Actions');
assert(workflow.includes('Termeh-Piano-CEO-PERSONAL-NOT-FOR-BAZAAR'),
  'CEO artifact must be clearly marked personal and not for Bazaar');
console.log('PASS: CEO has all lessons, no charges, and an independent package; store/QA remain isolated.');
