'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const meter=require('../app/src/main/assets/meter-engine.js');
const V=meter.VALUES, M=meter.METERS;
assert.equal(V.whole.units,4*V.quarter.units,'Four quarters are as long as one whole note');
assert.equal(V.whole.units,2*V.half.units);
assert.equal(V.whole.units,8*V.eighth.units);
assert.equal(V.whole.units,16*V.sixteenth.units);
assert.equal(V.dottedQuarter.units,3*V.eighth.units,'Compound beat is three eighth notes');
assert.equal(V.eighth.units,2*V.sixteenth.units);
for(const [signature,numer,denom,capacity,beats,beatUnits,compound] of [
  ['2/4',2,4,8,2,4,false],
  ['3/4',3,4,12,3,4,false],
  ['4/4',4,4,16,4,4,false],
  ['6/8',6,8,12,2,6,true]
]) {
  const x=M[signature];
  assert.deepEqual([x.numerator,x.denominator,x.capacity,x.beats,x.beatUnits,x.compound],
    [numer,denom,capacity,beats,beatUnits,compound],signature+' definition incorrect');
  assert.equal(x.beats*x.beatUnits,x.capacity);
}
assert.equal(meter.unitsOf(['quarter','eighth','sixteenth']),7);
assert(Number.isNaN(meter.unitsOf(['quarter','fake-note'])),'Unknown notes may never count as silence');
assert(Number.isNaN(meter.remaining('7/4',[])),'Unknown signatures must fail closed');
assert.equal(meter.remaining('6/8',['sixteenth','sixteenth','sixteenth']),9,
  'Three sixteenths in 6/8 leave NINE sixteenths (not three main beats)');
assert.equal(meter.remaining('6/8',['eighth','eighth','eighth']),6,
  'Three eighth notes are only ONE of the TWO main beats in 6/8');
assert(meter.completed('6/8',['dottedQuarter','dottedQuarter']));
assert(meter.completed('6/8',Array(12).fill('sixteenth')));
assert(meter.completed('4/4',Array(4).fill('quarter')));
assert(!meter.completed('2/4',['whole']),'A whole note is too long for a 2/4 measure');
assert(!meter.canAdd('2/4',[], 'whole'),'Oversized notes must be blocked before adding');
assert(!meter.canAdd('2/4',['quarter','quarter'],'sixteenth'),'A complete measure cannot be overfilled');
assert(meter.canAdd('2/4',['quarter'],'quarter'));
assert(meter.canAdd('6/8',['sixteenth','sixteenth','sixteenth'],'half'),
  'A half note (8 sixteenths) can fit after three sixteenths, leaving one');
assert.equal(meter.remaining('6/8',['sixteenth','sixteenth','sixteenth','half','sixteenth']),0);
assert.equal(meter.SCENARIOS.length,8);
for(let completed=0;completed<meter.SCENARIOS.length;completed++) {
  const scenario=meter.scenarioAt(completed);
  assert.equal(scenario.minCleared,completed);
  assert(meter.remaining(scenario.meter,scenario.prefix)>0,
    'Scenarios must have room for the child to complete the bar');
}
for(let completed=8;completed<28;completed++){
  const scenario=meter.scenarioAt(completed);
  assert(meter.SCENARIOS.includes(scenario),'Advanced practice must revisit previous measures');
}
assert(meter.availableScenarios(0).length===1);
assert(meter.availableScenarios(100).length===meter.SCENARIOS.length);
assert.equal(meter.formatUnits(3,'en'),'¾ quarter-note units');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert(html.includes('<script src="meter-engine.js"></script>'),'Bundled offline meter engine missing');
assert(html.includes('id="rhythmSub-meter"')&&html.includes('id="rhythmMeterSection"'),
  'Meter feature must be navigable in Rhythm mode');
assert(html.includes('id="meterStaffSvg"')&&html.includes('data-meter-note='),
  'Rhythm choices must appear on a real music staff and as interactive values');
assert(html.includes('state.meterRoundIndex=state.meterBarsCompleted'),
  'Never swap to the next challenge before completed bar is acknowledged');
assert(html.includes('meterBarsCompleted: state.meterBarsCompleted'),'Completed measures must persist');
assert(html.includes('if(state.meterBarSolved||state.meterBuiltNotes.length===0)return;'),
  'Undo must not retract already rewarded questions');
assert(html.includes('rewardCompletedExercise();'),'Meter exercise rewards must use existing slow coin economy');
assert(html.includes('۲ ضربِ سیاه نقطه‌دار'),'App must explicitly teach the correct 6/8 beat grouping');
assert(html.includes('چهار نت سیاه'),'App must explicitly teach whole/quarter duration equivalence');
console.log('PASS: exact time signatures, 6/8 compound beat subdivisions, no overfilling, progressive mixed measures, safe state and rewards.');
