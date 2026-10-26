/*
 * Termeh Piano's LOCAL cosmetic reward economy.
 * Never authorize commercial lessons, purchases, tests, or mastery with this.
 * Completed questions grant a small steady reward independent of speed,
 * error count, and payment; no penalty for needing more tries.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TermehRewards=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const QUESTIONS_PER_COIN=4;
  function validWhole(value){
    return Number.isSafeInteger(value)&&value>=0?value:0;
  }
  function finishQuestion(pending){
    const next=(validWhole(pending)%QUESTIONS_PER_COIN)+1;
    return {
      pending:next===QUESTIONS_PER_COIN?0:next,
      coins:next===QUESTIONS_PER_COIN?1:0
    };
  }
  function canBuy(trophy,balance,stars,unlocked){
    return !!(trophy&&typeof trophy.id==='string'&&trophy.id!=='starter_star'
      &&Array.isArray(unlocked)&&!unlocked.includes(trophy.id)
      &&validWhole(balance)>=trophy.cost
      &&validWhole(stars)>=trophy.minStars);
  }
  return Object.freeze({QUESTIONS_PER_COIN,finishQuestion,canBuy});
});
