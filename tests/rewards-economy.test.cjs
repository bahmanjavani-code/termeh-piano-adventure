// Offline reward tests. Cosmetic economy cannot authorize educational or paid content.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const rewards=require('../app/src/main/assets/rewards-engine.js');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const found=html.match(/const TROPHIES = \[([\s\S]*?)\n\s*\];/);
assert(found,'Reward definitions not found in offline UI');
const tiers=vm.runInNewContext('(['+found[1]+'])');
assert.equal(tiers.length,8);
assert.equal(tiers[0].id,'starter_star');
assert.equal(tiers[0].cost,0);
assert.equal(rewards.QUESTIONS_PER_COIN,4);
let balance=0,pending=0;
for(let i=1;i<=40;i++){
  const gain=rewards.finishQuestion(pending);
  assert(gain.coins===0||gain.coins===1);
  pending=gain.pending;
  balance+=gain.coins;
  assert.equal(balance,Math.floor(i/4),'Coins must accrue only every four finished questions');
}
assert.equal(balance,10);
assert.equal(pending,0);
assert.deepEqual(rewards.finishQuestion(3),{pending:0,coins:1},'Restart with pending progress must keep the milestone');
assert.deepEqual(rewards.finishQuestion(-100),{pending:1,coins:0},'Invalid reward counter must not mint coins');
assert(rewards.canBuy(tiers[1],12,40,['starter_star']),'First practice badge should be achievable after meaningful learning time');
assert(!rewards.canBuy(tiers[1],100000,39,['starter_star']),'Legacy wallet alone must not unlock newly locked trophies');
assert(!rewards.canBuy(tiers[1],11,1000,['starter_star']),'Practice stars alone must not skip coin price');
assert(!rewards.canBuy(tiers[1],999,999,['starter_star','golden_piano']),'Owned badge must not be charged again');
assert(!rewards.canBuy(tiers[0],999,999,[]),'Free starter badge cannot be sold');
for(let i=2;i<tiers.length;i++){
  assert(tiers[i].cost>tiers[i-1].cost,'Each rarer badge must cost more coins');
  assert(tiers[i].minStars>tiers[i-1].minStars,'Each rarer badge must require longer participation');
}
assert(tiers.at(-1).minStars>=700,'Rare final trophy should represent sustained practice across sessions');
assert(html.includes('equippedBadgeId')&&html.includes('equippedTrophyPiano')&&html.includes('equippedTrophyStaff'),'Earned trophy must be selectable and visible');
assert(html.includes('state.unlockedBadges = Array.isArray(parsed.unlockedBadges)'),'Previously owned trophies must be kept');
assert(html.includes('state.coins = parsed.coins || 0'),'Existing coins must not be confiscated');
assert(!html.includes('state.coins += 5'),'Five coins per tap encourages trivial farming');
assert(html.includes('TermehRewards.canBuy'),'Trophy purchases must enforce both cost and practice gates');
assert(html.includes('if(!TermehRewards.canBuy(trophy,state.coins,state.stars,state.unlockedBadges))'),'Serverless cosmetic guard missing');
assert(html.includes('state.equippedBadgeId=trophyId'),'New trophy must instantly appear');
console.log('PASS: four-question coin cadence, milestone persistence, rare practice tiers, legacy trophies and no paid unlock.');
