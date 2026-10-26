// Offline, zero-dependency quality checks. Run: node tests/quality.test.cjs
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
const activity=fs.readFileSync('app/src/main/java/com/termeh/piano/MainActivity.java','utf8');
let scriptCount=0;
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  new vm.Script(match[1],{filename:'index inline script '+(++scriptCount)});
}
assert(scriptCount>=3,'Unexpected or missing scripts');
// The paid-download APK must bundle all paid educational lessons; stages remain locked by learning.
const freeStart=html.indexOf('const TREBLE_NOTES = ')+ 'const TREBLE_NOTES = '.length;
const freeEnd=html.indexOf('].concat(window.TERMEH_DEBUG_PREMIUM',freeStart);
assert(freeStart>='const TREBLE_NOTES = '.length && freeEnd>freeStart,'Missing free note list in common HTML');
const freeTreble=vm.runInNewContext('('+html.slice(freeStart,freeEnd+1)+')');
const debugAsset=fs.readFileSync('app/src/debug/assets/premium-preview.js','utf8');
const releaseAsset=fs.readFileSync('app/src/release/assets/premium-preview.js','utf8');
const dc={window:{}};vm.runInNewContext(debugAsset,dc);
const rc={window:{}};vm.runInNewContext(releaseAsset,rc);
const preview=dc.window.TERMEH_DEBUG_PREMIUM;
assert(preview && Array.isArray(preview.trebleExtra));
assert(rc.window.TERMEH_DEBUG_PREMIUM,'Paid-download release must bundle all lessons');
assert.equal(rc.window.TERMEH_CONTENT_VARIANT,'bazaar-paid-candidate');
assert.equal(dc.window.TERMEH_CONTENT_VARIANT,'debug-full-preview');
assert.deepEqual(Array.from(freeTreble,n=>n.code),['C4','D4','E4','F4','G4']);
assert(!html.includes("code: 'G2'"),'Variant lesson data should remain isolated from shared HTML');
assert(!html.includes("id: 'whole'"),'Original duration definitions stay in variant assets');
assert.equal(rc.window.TERMEH_DEBUG_PREMIUM.trebleExtra.length,7,'Full treble curriculum required in paid release');
assert.equal(rc.window.TERMEH_DEBUG_PREMIUM.bass.length,10,'Full bass curriculum required in paid release');
assert.equal(rc.window.TERMEH_DEBUG_PREMIUM.durations.length,4,'Full existing rhythm content required in paid release');
const treble=Array.from(freeTreble).concat(Array.from(preview.trebleExtra));
const bass=Array.from(preview.bass);
const durations=Array.from(preview.durations);
assert.equal(treble.length,12);
assert.equal(bass.length,10);
const trebleExpected=['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5'];
const bassExpected=['G2','A2','B2','C3','D3','E3','F3','G3','A3','C4'];
assert.deepEqual(Array.from(treble,n=>n.code),trebleExpected);
assert.deepEqual(Array.from(bass,n=>n.code),bassExpected);
const semitones={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function midi(code){return 12*(Number(code.slice(1))+1)+semitones[code[0]]}
function referenceFrequency(code){return 440*Math.pow(2,(midi(code)-69)/12)}
for(const [clef,notes] of [['treble',treble],['bass',bass]]){
  for(const note of notes){
    assert.equal(note.keyId,note.code[0],clef+': wrong key for '+note.code);
    assert(Math.abs(note.freq-referenceFrequency(note.code))<0.015,clef+': wrong tuning for '+note.code);
    const y=clef==='treble'?160-10*(trebleExpected.indexOf(note.code)):note.code==='C4'?40:140-10*(bassExpected.indexOf(note.code));
    assert.equal(note.svgY,y,clef+': wrong staff position for '+note.code);
    assert.equal(note.ledgerY,note.code==='C4'? (clef==='treble'?160:40):null,
      clef+': wrong ledger line for '+note.code);
  }
}
assert.equal(treble.find(n=>n.code==='A4').freq,440);
assert.deepEqual(Object.fromEntries(Array.from(durations,d=>[d.id,d.beats])),{whole:4,half:2,quarter:1,eighth:0.5});
for(const permission of ['RECORD_AUDIO','CAMERA','ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION','ACCESS_BACKGROUND_LOCATION','ACCESS_MEDIA_LOCATION'])
  assert(!manifest.includes(permission),'Forbidden permission: '+permission);
assert(activity.includes('request::deny'),'WebView media permissions must be denied');
assert(activity.includes('callback.invoke(origin, false, false)'),'WebView location must be denied');
assert(!html.includes('${target.hintText}'),'Practice feedback must not reveal correct note via hint');
assert(!html.includes('بترکونیم'),'Lion dialogue must use child-friendly wording');
assert(html.includes('آماده‌ای با هم آهنگ‌های قشنگ بسازیم؟'),'Friendly lion dialogue missing');
assert(!/rhythmQuizApples[^\n]*target\.apples/.test(html),'Quiz must not show correct beat count');
assert(html.includes('function beginFinalAssessment()'),'Independent final assessment required');
assert(html.includes('e.correct>=18'),'Final assessment pass threshold must be 18/20');
assert(html.includes('state.mastery[mode].examPassed===true'),'Cannot use last 20 practice results as final exam');
const support=fs.readFileSync('app/src/main/java/com/termeh/piano/SupportTools.java','utf8');
const policy=JSON.parse(fs.readFileSync('config/android-update.json','utf8'));
const gradle=fs.readFileSync('app/build.gradle','utf8');
assert.equal(policy.schema,1);
const currentVersion=Number(gradle.split('versionCode ')[1].trim().split(/\s+/)[0]);
assert(policy.latestVersionCode>=currentVersion,'Update policy must cover current build');
assert(policy.minimumVersionCode<=currentVersion,'Current beta must not be forced to update');
assert(policy.storeUrl==='' || (new URL(policy.storeUrl).origin==='https://cafebazaar.ir' && new URL(policy.storeUrl).pathname==='/app/com.termeh.piano'));
assert(manifest.includes('android.permission.INTERNET'),'Native update check requires normal Internet permission');
assert(activity.includes('setBlockNetworkLoads(true)'),'WebView must not make network requests');
assert(activity.includes('new SupportTools(this)'),'Native parent support entry points missing');
assert(support.includes('new Intent(Intent.ACTION_SENDTO)'),'Support reports must use explicit email compose intent');
assert(support.includes('validStoreUrl(store)'),'Only trusted update store URLs may trigger mandatory updates');
assert(support.includes('enforceCachedPolicy()'),'Cached update minimum must be enforced offline');
assert(support.includes('installNativeCrashRecorder'),'Native crash summaries must be stored locally');
assert(html.includes('termehReportErrors'),'Parent-only email report control missing');
assert(html.includes('termehCheckUpdates'),'Parent-only update check control missing');
assert(html.includes('No locally recorded JavaScript errors.'),'Minimal JS diagnostics missing');
assert(html.includes('id="appMenuToggle"') && html.includes('id="appInfoDialog"'),'Accessible menu and info panels required');
assert(html.includes('data-termeh-theme-choice="auto"'),'System theme option missing');
assert(html.includes('termeh_theme_v1'),'Theme preference must persist without affecting progress');
assert(html.includes('not been established by an independent study'),'Scientific non-endorsement notice missing');
assert(html.includes('supplementary educational game'),'Learning aid disclaimer missing');
assert(html.includes('Bahman Javani'),'Creator attribution missing');
assert(html.includes('termeh-support://feedback') && html.includes('id="sendParentFeedback"'),'Parent-only suggestion route missing');
assert(activity.includes('"feedback".equals(uri.getHost())'),'Feedback route must be handled by Android');
assert(support.includes('void composeFeedback()'),'Native parent feedback email required');
assert(!html.includes('answer=a*b+13'),'Parent math must not have fixed +13');
assert(html.includes('termehMakeParentChallenge'),'Parent math challenges must be varied');
assert(html.includes("data-termeh-edition"),'Build-specific release QA hiding required');
assert(html.includes('termehQaOnly')&&html.includes('termehStoreOnly'),'Store parent screen must distinguish internal diagnostics from honest customer copy');
assert(html.includes('id="sendParentFeedback"'),'Parents still need a genuine support channel');
const qaWorkflow=fs.readFileSync('.github/workflows/android.yml','utf8');
const signedWorkflow=fs.readFileSync('.github/workflows/release.yml','utf8');
assert(!gradle.includes('family {'),'Deprecated family build type must be removed');
assert(!qaWorkflow.includes(':app:assembleFamily'),'CI must stop preparing abandoned family APK');
assert(!signedWorkflow.includes('FAMILY-FULL-TRAINING'),'Signed output must not include family artifact');
assert(fs.existsSync('BAZAAR_LAUNCH_PACKET_FA.md'),'Concise Bazaar launch packet is required');

assert(html.includes('id="masteryDock"') && html.includes('id="masteryBarsButton"'),'Progress should be three small bars near the bottom');
assert(html.includes('note-curriculum.js'),'Audited offline lesson sequence must be present');
assert(html.includes('id="learningMilestone"')&&html.includes('id="learningMilestoneStaff"'),'Review difficult notes on the staff after curriculum progression');
assert(html.includes('trebleNoteTier: state.trebleNoteTier'),'Treble tier must persist with previous progress');
assert(html.includes('const pool = state.mode === \'treble\' ? getActiveTrebleNotes() : BASS_NOTES;'),'Questions must use progressively unlocked pool');
assert(html.includes('The production free lesson')===false,'Technical commentary must not appear as child-visible copy');

assert(html.includes('id="masteryAccuracyTrack"') && html.includes('id="masterySpeedTrack"'),'Three distinct progress metrics required');
assert(html.includes('id="masteryDashboard" role="region" aria-label="Learning progress explanation" hidden'),'Explanations must not be visible by default');
assert(html.includes('setTimeout(closeMasteryDetails,7000)'),'Explanations must collapse after a few seconds');
assert(html.includes('equippedTrophyPiano') && html.includes('equippedTrophyStaff'),'Unlocked badges must appear in the game');
assert(html.includes('rewards-engine.js'),'Cosmetic economy module missing from offline page');
assert(!html.includes('state.coins += 5'),'Five coins for each easy answer defeats rarity');

assert(html.includes("const KEY='termeh_parent_welcome_v2',REVISION=2"),'Materially revised parent briefing must use versioned acknowledgment');
assert(!html.includes("const KEY='termeh_parent_welcome_v1'"),'Original acknowledgement must not auto-accept revised notice');
assert(html.includes('id="welcomeAccepted"')&&html.includes('id="welcomeContinue"')&&html.includes('disabled onclick="confirmParentWelcome()"'),'Explicit read-and-understood tick and disabled continue required');
assert(html.includes('window.reviewParentWelcome')&&html.includes('id="parentReviewNotice"'),'Parent must be able to review onboarding later');
assert(html.includes('id="welcomePrivacy"')&&html.includes('id="welcomeTerms"'),'Parental policy documents must remain accessible on first launch');
assert(html.includes('not the primary source of music education'),'Parent must be informed that this is not the primary instruction');
assert(html.includes('No specific learning or playing outcome is guaranteed'),'No learning guarantee notice missing');
assert(html.includes('Statutory consumer rights still apply'),'Parent acknowledgment must preserve legal rights');
assert(html.includes('termeh_parent_welcome_v3')&&html.includes('acknowledgedAt'),'New paid-download parent notice must be acknowledged locally');

const scientific=fs.readFileSync('SCIENTIFIC_EDUCATIONAL_FOUNDATION_FA.md','utf8');
assert(scientific.includes('https://ies.ed.gov/ncee/wwc/PracticeGuide/1'),'Evidence link missing');
assert(scientific.includes('National Core Arts Standards'),'Music standards link missing');

// Paid upfront: existing in-app billing experiments are dormant QA fixtures only.
const billing=fs.readFileSync('app/src/main/java/com/termeh/piano/BazaarBillingBridge.java','utf8');
assert(activity.includes('if (BuildConfig.DEBUG) {'),'Billing must be available for debugging only');
assert(activity.includes('new BazaarBillingBridge(this, web)'),'QA helper must remain behind debug guard');
assert(!billing.includes('payment.purchaseProduct('),'In-app checkout must not be implemented in paid app');
assert(!billing.includes('payment.consumeProduct('),'No consumable billing path allowed');
assert(html.includes('id="premiumOffer" class="termehQaOnly"'),'Old in-app upgrade offer must be invisible in the sold app');
assert(html.includes('class="termehStoreOnly" aria-label="Purchase model"'),'Explain no further payment to parents');
assert(html.includes('پرداخت یک‌باره پیش از دانلود از کافه‌بازار'),'Parent onboarding must disclose payment model');
assert(html.includes('no in-app purchases or subscription'),'English parent onboarding must match paid model');
console.log('PASS: JS syntax, 22 clef-note definitions, pitch frequency, staff positions, rhythm values, permissions, answer leakage and independent exam.');
