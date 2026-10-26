'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const curriculum=require('../app/src/main/assets/note-curriculum.js');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const debug=fs.readFileSync('app/src/debug/assets/premium-preview.js','utf8');
const rc=fs.readFileSync('app/src/release/assets/premium-preview.js','utf8');
const {window:w}={window:{}};
vm.runInNewContext(debug,{window:w});
const release={window:{}};vm.runInNewContext(rc,release);
const freeCodes=['C4','D4','E4','F4','G4'];
const extra=Array.from(w.TERMEH_DEBUG_PREMIUM.trebleExtra);
const full=[...freeCodes.map(code=>({code})),...extra];
const hist=(n,pool=full,ms=1600)=>Array.from({length:n},(_,i)=>({
  note:pool[i%pool.length].code,ms,correct:true,at:i*1000
}));
assert.deepEqual(full.map(n=>n.code),['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5']);
assert.equal(full.find(n=>n.code==='G5').svgY,50);
assert.equal(curriculum.maxTier(full),3);
assert.equal(curriculum.maxTier(full.slice(0,5)),1,'Release without premium may never unlock advanced content');
assert.deepEqual(curriculum.activeNotes(full,1).map(x=>x.code),freeCodes);
assert.deepEqual(curriculum.activeNotes(full,2).map(x=>x.code),full.slice(0,8).map(x=>x.code));
assert.deepEqual(curriculum.activeNotes(full,3).map(x=>x.code),full.map(x=>x.code));
assert.deepEqual(curriculum.activeNotes(full.slice(0,5),3).map(x=>x.code),freeCodes,'Forged local tier cannot reveal absent lessons');
assert.equal(curriculum.promotionStatus(1,full,hist(29,full.slice(0,5))).eligible,false);
assert.equal(curriculum.promotionStatus(1,full,hist(30,full.slice(0,5))).nextTier,2);
assert.equal(curriculum.promotionStatus(1,full,hist(200,[full[1]])).eligible,false,
  'Repeating a single easy note cannot open the next lesson');
assert.equal(curriculum.promotionStatus(2,full,hist(100,full.slice(0,8))).eligible,false);
assert.equal(curriculum.promotionStatus(2,full,hist(110,full.slice(0,8))).nextTier,3);
assert.equal(curriculum.promotionStatus(2,full,hist(110,full.slice(0,5))).eligible,false,'New notes must be learned before the upper tier');
const lowAccuracy=hist(110,full.slice(0,8));for(let i=70;i<110;i+=3)lowAccuracy[i].correct=false;
assert.equal(curriculum.promotionStatus(2,full,lowAccuracy).eligible,false,'High first-try error rate prevents promotion');
assert.equal(curriculum.promotionStatus(3,full,hist(1000)).eligible,false,'No fourth shortcut level');
assert.equal(curriculum.promotionStatus(1,full.slice(0,5),hist(150,full.slice(0,5))).eligible,false,'Release-only mode cannot invent paid notes');
const weak=hist(60,full.slice(0,8),1400);
for(let i=0;i<weak.length;i++) {
  if(weak[i].note==='F4')weak[i].correct=false;
  if(weak[i].note==='A4')weak[i].ms=5500;
}
const summary=curriculum.hardestNotes(weak,full.slice(0,8));
assert.equal(summary[0].note.code,'F4','Errors must be more salient than slower correct answers');
assert(summary.some(x=>x.note.code==='A4'),'Slow correct notes also need more practice');
assert.equal(curriculum.hardestNotes(hist(60,full.slice(0,8)),full.slice(0,8)).length,0,'Do not stigmatize correctly recognized notes');
assert(html.includes('showUpcomingMilestone()')&&html.includes('id="learningMilestoneStaff"'),'Milestone must show actual difficult notes on music staff');
assert(html.includes('getActiveTrebleNotes()'),'Question engine must use only currently active notes');
assert(html.includes('TermehNoteCurriculum.activeNotes'),'Tier selector must use independently tested module');
assert(html.includes('state.trebleNoteTier'),'Unlock state must persist without wiping history');
assert(html.includes('loadNewStaffQuestion()'),'Previous lessons continue in same game');
console.log('PASS: stepwise note tiers, all past notes retained, weak-note ranking, honest free APK separation.');
