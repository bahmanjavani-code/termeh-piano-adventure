'use strict';
// Pure engine QA: short lucky streaks cannot finish, first-try errors matter,
// speed/coverage/consistency matter, exam asks ALL notes without repetitions bias.
// Education stats are local and NEVER certify a paid purchase.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../app/src/main/assets/mastery-engine.js');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const expected=['C4','D4','E4','F4','G4'];
const debugNotes=['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5'];
const createHistory=(n,codes=expected,ms=1700)=>Array.from({length:n},(_,i)=>({
  correct:true,note:codes[i%codes.length],ms,at:Date.now()-n*2000+i*2000
}));
assert.equal(engine.POLICY_VERSION,2);
assert.equal(engine.FLUENCY_ATTEMPTS,150);
const empty=engine.evaluate([],expected);
assert.equal(empty.stage,1);
assert.equal(empty.ready,false);
assert.equal(empty.score,0);

for(const count of [1,5,10,20,29,30,40,80,99,149]){
  const result=engine.evaluate(createHistory(count),expected);
  assert(!result.ready,'An easy '+count+'-question session must not enable final exam');
  assert(!result.passed);
  assert(result.score<100);
}
assert.equal(engine.evaluate(createHistory(20),expected).stage,1);

assert.equal(engine.evaluate(createHistory(20),expected).trend,null,
  'Need two fair 20-question windows before showing a trend');
const improving=createHistory(60,expected,1600);
for(let i=20;i<27;i++)improving[i].correct=false; // older comparison window
for(let i=40;i<42;i++)improving[i].correct=false; // latest comparison window
const trend=engine.evaluate(improving,expected).trend;
assert.deepEqual([trend.earlierErrors,trend.latestErrors],[7,2],
  'Parent should see falling first-try mistakes, not only a vague completion score');
assert(Number.isFinite(trend.latestMedianMs));

assert(engine.evaluate(createHistory(20,['G4']),expected).score>0,
  'Practice bar must advance for effort even before all notes are familiar');
assert(engine.evaluate(createHistory(20,['G4']),expected).score<25,
  'Partial effort never completes stage 1 without per-note competency');
assert.equal(engine.evaluate(createHistory(80),expected).stage,3);
const full=engine.evaluate(createHistory(150),expected);
assert.equal(full.stage,4);
assert.equal(full.ready,true);
assert.equal(full.passed,false,'Finishing practice must not replace independent exam');
assert.equal(full.score,100);
assert.equal(full.roundsPassed,3);
assert.equal(full.accuracy60,100);
assert(full.medianMs<=4200);
assert.equal(full.masteredNotes,5);
assert.equal(full.hasEveryRecentNote,true);
assert.equal(engine.evaluate(createHistory(150),expected,true,0).passed,false,
  'Old easy exam must not bypass tightened mastery rules');
assert.equal(engine.evaluate(createHistory(150),expected,true,2).passed,true,
  'A proper version-2 exam plus fluency may unlock the next debug practice');

const singleNote=createHistory(200,['G4']);
assert(!engine.evaluate(singleNote,expected).ready,'Hammering one note is not mastery');
assert.equal(engine.evaluate(singleNote,expected).stage,1);
const slow=engine.evaluate(createHistory(170,expected,10000),expected);
assert(!slow.ready,'Poor recognition speed must not unlock exam');
assert.equal(slow.stage,3);

const tooManyMistakes=createHistory(170);
for(let i=110;i<170;i+=4)tooManyMistakes[i].correct=false;
const inaccurate=engine.evaluate(tooManyMistakes,expected);
assert.equal(inaccurate.ready,false,'25% recent mistakes must block progress');
assert(inaccurate.accuracy60<=80);

const badRound=createHistory(170);
for(let i=110;i<114;i++)badRound[i].correct=false;
const inconsistent=engine.evaluate(badRound,expected);
assert(inconsistent.accuracy60>=90,'Regression requires overall 90% accuracy');
assert.equal(inconsistent.roundsPassed,2,'One 16/20 round must not count');
assert(!inconsistent.ready,'Three reliable practice rounds are required');

const starved=createHistory(170,debugNotes);
assert(engine.evaluate(starved,debugNotes).ready,
  'Extended preview should support varied notes without a fixed five-note assumption');
const spoiled=createHistory(170,debugNotes);
for(let i=110;i<170;i++)spoiled[i].note='A4';
assert(!engine.evaluate(spoiled,debugNotes).ready,'Recent fluent round must revisit every available note');

const corrupted=[{correct:'true',ms:30,note:'C4'},{correct:true,note:'other',ms:20},{correct:true,note:'C4',ms:NaN}];
assert.equal(engine.evaluate(corrupted,expected).total,0,'Malformed saved records cannot increase readiness');

const pool=expected.map(code=>({code}));
for(const variant of [pool,debugNotes.map(code=>({code}))]){
  const questions=engine.buildBalancedExam(variant,20,()=>.57);
  assert.equal(questions.length,20);
  const tally={};for(const note of questions)tally[note.code]=(tally[note.code]||0)+1;
  assert.equal(Object.keys(tally).length,variant.length);
  assert(Math.max(...Object.values(tally))-Math.min(...Object.values(tally))<=1,
    'Exam must cover note varieties equally');
  for(let i=1;i<questions.length;i++){
    assert.notEqual(questions[i].code,questions[i-1].code,'Exam must avoid obvious repeats');
  }
}

const previous='C4';
const next=engine.chooseNextNote(pool,[],previous,()=>.01);
assert(next&&next.code!==previous,'Adaptive drill cannot repeat the same note immediately');
assert.equal(engine.chooseNextNote(pool,[],null,()=>0).code,'C4');
const weakHistory=createHistory(100,expected);
for(let i=0;i<weakHistory.length;i++)if(weakHistory[i].note==='D4')weakHistory[i].correct=false;
const choices=Array.from({length:100},(_,i)=>engine.chooseNextNote(pool,weakHistory,null,()=>i/100).code);
const frequencies=choices.reduce((memo,code)=>(memo[code]=(memo[code]||0)+1,memo),{});
assert(frequencies.D4>frequencies.C4,'Weak notes should appear more often, not less');
assert(/mastery-engine\.js/.test(html),'The exact audited engine must be used by game');
assert(/recordMasteryAttempt\(state\.mode, false/.test(html),'First mistake must count as an incorrect first try');
assert(/if\(correct && !firstTry\) return/.test(html),'Late correction cannot count twice as correct first try');
assert(/certifiedVersion=TermehMasteryEngine\.POLICY_VERSION/.test(html));
assert(/fastCorrect>=15/.test(html),'Final exam must also test recognition speed');
assert(/id="masteryDashboard"/.test(html),'Progress goals must be visible to kids and parents');
assert(/id="masteryTrend"/.test(html),'Display objective progress in mistakes and response time');
assert(/TermehMasteryEngine\.chooseNextNote\(/.test(html));
assert(/TermehMasteryEngine\.buildBalancedExam\(/.test(html));
assert(/state\.levelTreble \+= 1/.test(html)===false,'Every tap must not advance a fake level');
assert(/state\.levelBass \+= 1/.test(html)===false,'Every tap must not advance a fake level');
const scriptMatches=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
for(const [i,script] of scriptMatches.entries())new vm.Script(script[1],{filename:'index inline '+i});
console.log('PASS: staged skill mastery requires 150 varied first tries, 3 good rounds, 90% accuracy and fast responses; 20/80 quick taps cannot graduate.');
