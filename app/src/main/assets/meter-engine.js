/*
 * Termeh Piano: time-signature and note-value logic, independent from rewards.
 * All calculations are exact integers in units of one sixteenth note.
 * 6/8 has SIX eighth-note subdivisions but usually TWO dotted-quarter beats.
 * This is not a paid-ownership, identity or signing module.
 */
(function (root, make) {
  const api=make();
  if (typeof module==='object' && module.exports) module.exports=api;
  if (root) root.TermehMeterEngine=api;
})(typeof window!=='undefined'?window:globalThis, function () {
  'use strict';
  const VALUES=Object.freeze({
    whole:        Object.freeze({units:16,symbol:'𝅝',fa:'گرد',en:'Whole note'}),
    half:         Object.freeze({units:8,symbol:'𝅗𝅥',fa:'سفید',en:'Half note'}),
    quarter:      Object.freeze({units:4,symbol:'♩',fa:'سیاه',en:'Quarter note'}),
    eighth:       Object.freeze({units:2,symbol:'♪',fa:'چنگ',en:'Eighth note'}),
    sixteenth:    Object.freeze({units:1,symbol:'♬',fa:'دولاچنگ',en:'Sixteenth note'}),
    dottedQuarter:Object.freeze({units:6,symbol:'♩.',fa:'سیاه نقطه‌دار',en:'Dotted quarter'})
  });
  const METERS=Object.freeze({
    '2/4':Object.freeze({numerator:2,denominator:4,capacity:8,beats:2,beatUnits:4,compound:false}),
    '3/4':Object.freeze({numerator:3,denominator:4,capacity:12,beats:3,beatUnits:4,compound:false}),
    '4/4':Object.freeze({numerator:4,denominator:4,capacity:16,beats:4,beatUnits:4,compound:false}),
    '6/8':Object.freeze({numerator:6,denominator:8,capacity:12,beats:2,beatUnits:6,compound:true})
  });
  const SCENARIOS=Object.freeze([
    Object.freeze({meter:'2/4',prefix:Object.freeze(['quarter']),minCleared:0}),
    Object.freeze({meter:'3/4',prefix:Object.freeze(['half']),minCleared:1}),
    Object.freeze({meter:'4/4',prefix:Object.freeze(['quarter','half']),minCleared:2}),
    Object.freeze({meter:'2/4',prefix:Object.freeze(['eighth','eighth']),minCleared:3}),
    Object.freeze({meter:'3/4',prefix:Object.freeze(['quarter','eighth','eighth']),minCleared:4}),
    Object.freeze({meter:'6/8',prefix:Object.freeze(['dottedQuarter']),minCleared:5}),
    Object.freeze({meter:'6/8',prefix:Object.freeze(['sixteenth','sixteenth','sixteenth']),minCleared:6}),
    Object.freeze({meter:'4/4',prefix:Object.freeze(['quarter','quarter']),minCleared:7})
  ]);
  function unitsOf(notes) {
    if (!Array.isArray(notes)) return NaN;
    let sum=0;
    for (const id of notes) {
      if (typeof id!=='string'||!Object.prototype.hasOwnProperty.call(VALUES,id))return NaN;
      sum+=VALUES[id].units;
    }
    return sum;
  }
  function remaining(meterId,notes) {
    const meter=METERS[meterId];
    if (!meter)return NaN;
    const filled=unitsOf(notes);
    return Number.isFinite(filled)?meter.capacity-filled:NaN;
  }
  function canAdd(meterId,notes,nextId) {
    return Object.prototype.hasOwnProperty.call(VALUES,nextId)
      && Number.isFinite(remaining(meterId,notes))
      && remaining(meterId,notes)>=VALUES[nextId].units;
  }
  function completed(meterId,notes) {
    return remaining(meterId,notes)===0;
  }
  function availableScenarios(cleared) {
    const n=Number.isSafeInteger(cleared)?Math.max(0,cleared):0;
    return SCENARIOS.filter(x=>x.minCleared<=n);
  }
  function scenarioAt(cleared) {
    // Chosen difficulty follows completed bars; after lesson eight all
    // earlier scenarios return in cyclic mixed practice.
    const n=Number.isSafeInteger(cleared)?Math.max(0,cleared):0;
    if(n<SCENARIOS.length)return SCENARIOS[n];
    const previous=availableScenarios(n);
    return previous[(n*5+3)%previous.length];
  }
  function formatUnits(units,lang) {
    if(!Number.isInteger(units)||units<0)return '—';
    if(units===0)return lang==='en'?'0 sixteenths':'۰ دولاچنگ';
    const whole=Math.floor(units/4),rem=units%4;
    const number=whole===0?(rem===1?'¼':rem===2?'½':'¾') :
      rem===0?String(whole):String(whole)+' '+(rem===1?'¼':rem===2?'½':'¾');
    return lang==='en'?number+' quarter-note units':number+' واحد سیاه';
  }
  return Object.freeze({VALUES,METERS,SCENARIOS,unitsOf,remaining,canAdd,completed,availableScenarios,scenarioAt,formatUnits});
});
