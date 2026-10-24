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
function array(name){
  const rx=new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n        \\]);');
  const m=html.match(rx);
  assert(m,'Missing '+name);
  return vm.runInNewContext('('+m[1]+')');
}
const treble=array('TREBLE_NOTES');
const bass=array('BASS_NOTES');
const durations=array('NOTE_DURATIONS');
assert.equal(treble.length,11);
assert.equal(bass.length,10);
const trebleExpected=['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5'];
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
assert(!html.includes('rhythmQuizApples\').textContent = `کشش به اندازه: ${target.apples}'),'Quiz must not show correct beat count');
assert(html.includes('function beginFinalAssessment()'),'Independent final assessment required');
assert(html.includes('e.correct>=18'),'Final assessment pass threshold must be 18/20');
assert(html.includes('state.mastery[mode].examPassed===true'),'Cannot use last 20 practice results as final exam');
console.log('PASS: JS syntax, 21 clef-note definitions, pitch frequency, staff positions, rhythm values, permissions, answer leakage and independent exam.');
