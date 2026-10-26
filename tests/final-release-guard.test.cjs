'use strict';
// Final versioning is independent of one-run consent to accept a real Bazaar charge.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const gradle = fs.readFileSync('app/build.gradle', 'utf8');
const update = JSON.parse(fs.readFileSync('config/android-update.json', 'utf8'));
const html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
const manifest = fs.readFileSync('app/src/main/AndroidManifest.xml', 'utf8');
assert.match(gradle,/versionCode 34\s+versionName '1\.0\.1'/, '1.0.1 must upgrade in place from signed paid test build 33');
assert.equal(update.latestVersionCode,34, 'Update metadata must match update build 34');
assert(gradle.includes("applicationId 'com.termeh.piano'"), 'Preserve previously saved local progress by changing the package');
assert(manifest.includes('android:allowBackup="false"'), 'Do not silently change backup/security policy');
assert(!html.includes('(پس از تکمیل و آزمایش)'), 'Final checkout screen cannot advertise unfinished beta plans');
assert(!html.includes('Advanced lessons are planned for'), 'Final checkout screen cannot advertise unfinished beta plans');
assert(html.includes('window.termehRestoreFromBazaar=function()'), 'Previous Bazaar owners need restore after updates');
assert(html.includes('id="realBazaarBuyBtn"'), 'Final APK needs official store upgrade button');
assert(html.includes("const ready=known && code==='offer_ready'"), 'Inactive SKU must leave checkout hidden');
assert(gradle.includes("System.getenv('TERMEH_ENABLE_LIVE_CHECKOUT') == '1'"), 'Build must require explicit checkout permission');
console.log('PASS: Termeh Piano 1.0.1 build 34, progress-safe upgrade, and explicit Bazaar parental checkout gate.');
