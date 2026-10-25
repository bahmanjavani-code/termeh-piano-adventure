#!/usr/bin/env node
'use strict';

/**
 * Developer-only exporter for PUBLIC beta lesson fixtures.
 * This helps test the encrypted pack schema but these exact lessons already
 * exist in repository history and MUST NOT be considered secret paid assets.
 * Future original premium lessons should come from PRIVATE source storage.
 *
 * node tools/export-beta-lesson-fixture.cjs premium_private/demo-lessons.json
 */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {SKU,PACKAGE_NAME}=require('./secure-premium-pack.cjs');
const source='app/src/debug/assets/premium-preview.js';

function getBetaLessonFixture(){
  const code=fs.readFileSync(source,'utf8');
  const context={window:{}};
  vm.runInNewContext(code,context,{filename:source,timeout:1000});
  const data=context.window.TERMEH_DEBUG_PREMIUM;
  if(!data||!Array.isArray(data.trebleExtra)||!Array.isArray(data.bass)||!Array.isArray(data.durations))
    throw Error('Missing debug premium fixture data');
  const fixture=JSON.parse(JSON.stringify({
    schema:1,
    packageName:PACKAGE_NAME,
    productId:SKU,
    trebleExtra:data.trebleExtra,
    bass:data.bass,
    durations:data.durations
  }));
  if(fixture.trebleExtra.length!==6||fixture.bass.length!==10||fixture.durations.length!==4)
    throw Error('Unexpected beta fixture structure');
  const allCodes=[...fixture.trebleExtra,...fixture.bass].map(n=>n.code);
  if(allCodes.some(x=>!/^[A-G][2-5]$/.test(x)))throw Error('Invalid note code');
  return fixture;
}

if(require.main===module){
  const args=process.argv.slice(2);
  if(args.length!==1)throw Error('Usage: node tools/export-beta-lesson-fixture.cjs premium_private/demo-lessons.json');
  const destination=path.resolve(args[0]);
  fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
  fs.writeFileSync(destination,JSON.stringify(getBetaLessonFixture(),null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('Public BETA fixture exported for LOCAL encryption testing. Do NOT sell it as secret content.');
}
module.exports={getBetaLessonFixture};
