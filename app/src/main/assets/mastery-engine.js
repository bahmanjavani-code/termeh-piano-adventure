/* Termeh's skill-based note-reading curriculum.
 * Pure, offline, intentionally NOT a payment or entitlement check.
 * Same file is tested in Node and used in the Android WebView.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TermehMasteryEngine=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const POLICY_VERSION=2;
  const INTRO_ATTEMPTS=30;
  const ACCURACY_ATTEMPTS=80;
  const FLUENCY_ATTEMPTS=150;
  const ACCURACY_WINDOW=40;
  const FLUENCY_WINDOW=60;
  const FLUENCY_MEDIAN_MS=4200;
  const GOOD_ROUND_CORRECT=17;
  const EXAM_COUNT=20;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const median=(samples)=>{
    if(!samples.length)return Infinity;
    const ordered=samples.slice().sort((a,b)=>a-b);
    const middle=Math.floor(ordered.length/2);
    return ordered.length%2?ordered[middle]:(ordered[middle-1]+ordered[middle])/2;
  };
  const percent=(n,denominator)=>denominator?Math.round(100*n/denominator):0;
  const accuracy=(items)=>items.length?items.filter(x=>x.correct===true).length/items.length:0;
  const validAttempts=(history,codes)=>Array.isArray(history)?history.filter(x=>
    x&&codes.includes(x.note)&&typeof x.correct==='boolean'&&Number.isFinite(x.ms)&&x.ms>=0
  ).slice(-240):[];

  function evaluate(history,poolCodes,examPassed=false,certifiedVersion=0){
    const codes=[...new Set((poolCodes||[]).filter(x=>typeof x==='string'&&x.length))];
    if(!codes.length)return {stage:1,ready:false,passed:false,score:0,total:0,
      accuracy40:0,accuracy60:0,medianMs:null,masteredNotes:0,noteCount:0,
      weakNote:null,roundsPassed:0,hasEveryRecentNote:false,goal:INTRO_ATTEMPTS,done:0};
    const h=validAttempts(history,codes);
    const last40=h.slice(-ACCURACY_WINDOW);
    const last60=h.slice(-FLUENCY_WINDOW);
    const countByNote=Object.fromEntries(codes.map(code=>[code,0]));
    const correctByNote=Object.fromEntries(codes.map(code=>[code,0]));
    for(const item of h){
      countByNote[item.note]++;
      if(item.correct)correctByNote[item.note]++;
    }
    const minCorrect=Math.min(...Object.values(correctByNote));
    const recentCodes=new Set(last60.map(x=>x.note));
    const hasEveryRecentNote=codes.every(x=>recentCodes.has(x));
    const accuracy40=accuracy(last40);
    const accuracy60=accuracy(last60);
    const correctFast=last60.filter(x=>x.correct).map(x=>x.ms);
    const medianMs=median(correctFast);
    const rounds=[];
    if(last60.length===FLUENCY_WINDOW){
      for(let i=0;i<FLUENCY_WINDOW;i+=20)rounds.push(last60.slice(i,i+20).filter(x=>x.correct).length);
    }
    const roundsPassed=rounds.filter(n=>n>=GOOD_ROUND_CORRECT).length;
    const intro=h.length>=INTRO_ATTEMPTS&&minCorrect>=2;
    const accurate=intro&&h.length>=ACCURACY_ATTEMPTS&&last40.length===ACCURACY_WINDOW
      &&accuracy40>=.85&&minCorrect>=5;
    const fluent=accurate&&h.length>=FLUENCY_ATTEMPTS&&last60.length===FLUENCY_WINDOW
      &&accuracy60>=.90&&medianMs<=FLUENCY_MEDIAN_MS&&roundsPassed===3
      &&minCorrect>=9&&hasEveryRecentNote;
    const stage=fluent?4:accurate?3:intro?2:1;
    let goal=INTRO_ATTEMPTS,done=Math.min(h.length,INTRO_ATTEMPTS),stageFraction=0;
    if(stage===1){
      stageFraction=Math.min(1,h.length/INTRO_ATTEMPTS,minCorrect/2);
    }else if(stage===2){
      goal=ACCURACY_ATTEMPTS;done=Math.min(h.length,ACCURACY_ATTEMPTS);
      stageFraction=Math.min(1,h.length/ACCURACY_ATTEMPTS,accuracy40/.85,minCorrect/5);
    }else if(stage===3){
      goal=FLUENCY_ATTEMPTS;done=Math.min(h.length,FLUENCY_ATTEMPTS);
      stageFraction=Math.min(1,h.length/FLUENCY_ATTEMPTS,accuracy60/.90,
        FLUENCY_MEDIAN_MS/Math.max(1,medianMs),minCorrect/9,roundsPassed/3,
        hasEveryRecentNote?1:.95);
    }else{
      goal=FLUENCY_ATTEMPTS;done=FLUENCY_ATTEMPTS;stageFraction=1;
    }
    const score=stage===4?100:Math.min(99,Math.round(
      (stage===1?0:stage===2?25:60)+(stage===1?25:stage===2?35:39)*clamp(stageFraction,0,1)
    ));
    const weakest=codes.slice().sort((a,b)=>{
      const countDiff=correctByNote[a]-correctByNote[b];
      if(countDiff)return countDiff;
      return countByNote[a]-countByNote[b];
    })[0];
    return {
      stage,ready:fluent,passed:fluent&&examPassed===true&&certifiedVersion>=POLICY_VERSION,
      score,total:h.length,accuracy40:percent(last40.filter(x=>x.correct).length,last40.length),
      accuracy60:percent(last60.filter(x=>x.correct).length,last60.length),
      medianMs:Number.isFinite(medianMs)?Math.round(medianMs):null,
      masteredNotes:codes.filter(c=>correctByNote[c]>=9).length,noteCount:codes.length,
      minCorrect,weakNote:weakest,roundsPassed,hasEveryRecentNote,goal,done,
      correctByNote,policyVersion:POLICY_VERSION
    };
  }

  function chooseNextNote(pool,history,previousCode,random=Math.random){
    if(!Array.isArray(pool)||!pool.length)return null;
    const candidates=pool.filter(n=>n&&n.code&&n.code!==previousCode);
    const available=candidates.length?candidates:pool.filter(n=>n&&n.code);
    if(!available.length)return null;
    const recent=Array.isArray(history)?history.slice(-100):[];
    const measures=available.map(note=>{
      const hits=recent.filter(x=>x&&x.note===note.code);
      const successes=hits.filter(x=>x.correct);
      const missRate=hits.length?1-successes.length/hits.length:.5;
      const slowRate=successes.length?successes.filter(x=>x.ms>4200).length/successes.length:.4;
      const scarce=Math.max(0,5-hits.length);
      return {note,weight:1+4*missRate+2*slowRate+1.2*scarce};
    });
    const sum=measures.reduce((n,item)=>n+item.weight,0);
    const coin=clamp(Number(random())||0,0,.999999999)*sum;
    let cursor=0;
    for(const item of measures){cursor+=item.weight;if(coin<cursor)return item.note;}
    return measures[measures.length-1].note;
  }

  function buildBalancedExam(pool,count=EXAM_COUNT,random=Math.random){
    if(!Array.isArray(pool)||!pool.length||!Number.isInteger(count)||count<1)return [];
    const result=[];
    const shuffle=(source)=>{
      const a=source.slice();
      for(let i=a.length-1;i>0;i--){
        const j=Math.floor(clamp(Number(random())||0,0,.999999999)*(i+1));
        [a[i],a[j]]=[a[j],a[i]];
      }
      return a;
    };
    while(result.length<count){
      const round=shuffle(pool);
      if(result.length&&round.length>1&&result[result.length-1].code===round[0].code){
        const different=round.findIndex(n=>n.code!==result[result.length-1].code);
        if(different>0)[round[0],round[different]]=[round[different],round[0]];
      }
      result.push(...round.slice(0,count-result.length));
    }
    return result;
  }

  return Object.freeze({POLICY_VERSION,INTRO_ATTEMPTS,ACCURACY_ATTEMPTS,
    FLUENCY_ATTEMPTS,FLUENCY_MEDIAN_MS,EXAM_COUNT,evaluate,chooseNextNote,buildBalancedExam});
});
