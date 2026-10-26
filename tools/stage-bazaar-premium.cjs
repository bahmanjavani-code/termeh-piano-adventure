#!/usr/bin/env node
'use strict';

/**
 * Build-time ONLY packaging for the Bazaar lifetime upgrade.
 * Do not commit the output, write the content key to disk, or log it.
 *
 * Usage:
 *   TERMEH_PREMIUM_CONTENT_KEY_HEX=<64 hex chars> node tools/stage-bazaar-premium.cjs
 *
 * The current source is an existing public educational QA fixture: the pack
 * provides a complete trial curriculum but cannot claim secret lesson IP.
 * Offline AES is tamper detection/obfuscation only when its decryption key
 * is also embedded in an installable APK. Signed ownership checks in native
 * code deter casual file sharing; patched APKs are not preventable offline.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {getBetaLessonFixture}=require('./export-beta-lesson-fixture.cjs');
const {PACKAGE_NAME,SKU,FORMAT}=require('./secure-premium-pack.cjs');

const DEST='app/src/release/assets/premium-lessons.tpk';
const AAD=Buffer.from(PACKAGE_NAME+'|'+SKU+'|'+FORMAT,'utf8');

function stage(output,keyString){
  if(!/^[a-fA-F0-9]{64}$/.test(keyString||''))throw Error('A 32-byte hex content key must be provisioned in the build environment');
  const fixture=getBetaLessonFixture();
  if(fixture.schema!==1||fixture.productId!==SKU||fixture.packageName!==PACKAGE_NAME)
    throw Error('Incorrect content pack identity');
  const plain=Buffer.from(JSON.stringify(fixture));
  if(plain.length===0||plain.length>2*1024*1024)throw Error('Content size out of bounds');
  const key=Buffer.from(keyString,'hex');
  const nonce=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,nonce);
  cipher.setAAD(AAD);
  const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
  const envelope={
    format:FORMAT,packageName:PACKAGE_NAME,productId:SKU,
    nonce:nonce.toString('base64'),
    ciphertext:ciphertext.toString('base64'),
    tag:cipher.getAuthTag().toString('base64')
  };
  if(fs.existsSync(output))throw Error('Refusing to overwrite pre-existing premium output');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(envelope)+'\n',{flag:'wx',mode:0o644});
  plain.fill(0);key.fill(0);
  return {bytes:fs.statSync(output).size,lessons:fixture.trebleExtra.length+fixture.bass.length+fixture.durations.length};
}
if(require.main===module){
  try {
    const result=stage(DEST,process.env.TERMEH_PREMIUM_CONTENT_KEY_HEX);
    console.log('Prepared an authenticated premium DATA asset ('+result.bytes+' encrypted bytes). No secret or lesson plaintext logged.');
  }catch(error){
    console.error('Paid-content staging FAILED: '+error.message);
    process.exitCode=1;
  }
}
module.exports={stage,DEST,AAD};
