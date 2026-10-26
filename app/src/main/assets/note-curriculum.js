/* Step-by-step treble curriculum; pure, offline, testable.
 * Skills and thresholds are product design choices, NOT clinical or scientific certification.
 * Note definitions for unreleased commercial lessons stay out of production release assets.
 * This module never grants purchase ownership, never writes storage and never gates billing.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TermehNoteCurriculum=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const LEVEL_SIZES=Object.freeze([5,8,12]); // C4..G4 | +A4,B4,C5 | +D5,E5,F5,G5
  const clampTier=(tier,max)=>Number.isInteger(tier)&&tier>=1?Math.min(tier,max):1;
  function maxTier(notes){
    const count=Array.isArray(notes)?notes.length:0;
    return count>=9?3:count>=8?2:1;
  }
  function activeNotes(notes,tier){
    if(!Array.isArray(notes))return [];
    const max=maxTier(notes);
    const normalized=clampTier(tier,max);
    return notes.slice(0,Math.min(notes.length,LEVEL_SIZES[normalized-1]));
  }
  function safeHistory(history,notes){
    const codes=new Set(notes.map(n=>n.code));
    return (Array.isArray(history)?history:[]).filter(x=>x&&codes.has(x.note)&&typeof x.correct==='boolean'&&Number.isFinite(x.ms)&&x.ms>=0);
  }
  function firstTryCounts(history,notes){
    const counts=Object.fromEntries(notes.map(n=>[n.code,0]));
    for(const row of safeHistory(history,notes))if(row.correct)counts[row.note]++;
    return counts;
  }
  function promotionStatus(tier,notes,history){
    const max=maxTier(notes);
    const now=clampTier(tier,max);
    if(now>=max)return {tier:now,nextTier:now,eligible:false,reason:'max'};
    const seen=safeHistory(history,activeNotes(notes,now));
    const count=firstTryCounts(seen,activeNotes(notes,now));
    const minCorrect=Math.min(...Object.values(count));
    if(now===1){
      const eligible=seen.length>=30&&minCorrect>=2;
      return {tier:now,nextTier:eligible?2:now,eligible,reason:eligible?'ready':'practice'};
    }
    const recent=seen.slice(-40);
    const acc=recent.length===40?recent.filter(x=>x.correct).length/recent.length:0;
    const eligible=seen.length>=110&&minCorrect>=5&&acc>=.85;
    return {tier:now,nextTier:eligible?3:now,eligible,reason:eligible?'ready':'practice'};
  }
  function hardestNotes(history,notes,limit=3){
    const recent=safeHistory(history,notes).slice(-60);
    const stats=notes.map(note=>{
      const rows=recent.filter(x=>x.note===note.code);
      const misses=rows.filter(x=>!x.correct).length;
      const slow=rows.filter(x=>x.correct&&x.ms>4200).length;
      // Mistakes count more than hesitation. No forced negative labels for mastered notes.
      return {note,misses,slow,score:misses*3+slow,samples:rows.length};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||b.misses-a.misses||b.samples-a.samples);
    return stats.slice(0,Math.max(0,Math.min(3,Math.floor(limit)||0)));
  }
  return Object.freeze({LEVEL_SIZES,maxTier,activeNotes,promotionStatus,hardestNotes,firstTryCounts});
});
