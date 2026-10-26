'use strict';
// Full paid-curriculum encryption staging test: ZERO real merchant keys/payments.
// Uses a disposable random AES key, never an input/output secret committed here.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {stage,AAD}=require('../tools/stage-bazaar-premium.cjs');
const {getBetaLessonFixture}=require('../tools/export-beta-lesson-fixture.cjs');
const original=getBetaLessonFixture();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'termeh-staged-pack-'));
try{
 const target=path.join(dir,'premium-lessons.tpk');
 assert.throws(()=>stage(target,''),/32-byte/,'Never make a pack without a key');
 assert(!fs.existsSync(target),'Failed packaging cannot leave stale output');
 const key=crypto.randomBytes(32);
 const result=stage(target,key.toString('hex'));
 assert.equal(result.lessons,7+10+4,'Full preview must be encrypted before sale');
 const raw=fs.readFileSync(target,'utf8'),doc=JSON.parse(raw);
 assert.equal(doc.format,'TPK1');
 assert.equal(doc.productId,'termeh_premium_lifetime');
 assert.equal(doc.packageName,'com.termeh.piano');
 for(const text of ['hintText','beatsLabel','"C5"','"G2"','"duration"','tehran','من']){
   assert(!raw.includes(text),'No premium plaintext in app asset: '+text);
 }
 assert(!raw.includes(key.toString('hex')),'Never embed AES key inside ciphertext envelope');
 function decode(pack,secret){
   const cipher=crypto.createDecipheriv('aes-256-gcm',secret,Buffer.from(pack.nonce,'base64'));
   cipher.setAAD(AAD);cipher.setAuthTag(Buffer.from(pack.tag,'base64'));
   return JSON.parse(Buffer.concat([cipher.update(Buffer.from(pack.ciphertext,'base64')),cipher.final()]).toString('utf8'));
 }
 assert.deepEqual(decode(doc,key),original);
 assert.throws(()=>decode({...doc,productId:'bad_product'},crypto.randomBytes(32)));
 assert.throws(()=>decode(doc,crypto.randomBytes(32)),'Another AES key may not decrypt paid lessons');
 const flipped=Buffer.from(doc.ciphertext,'base64');flipped[0]^=1;
 assert.throws(()=>decode({...doc,ciphertext:flipped.toString('base64')},key),
   'Authenticated encryption must detect modified pack');
 assert.throws(()=>stage(target,crypto.randomBytes(32).toString('hex')),/Refusing to overwrite/,
   'Production staging cannot silently overwrite a different ciphertext');
 // The checked-in free source must not include the ciphertext or real pack key.
 assert(!fs.existsSync('app/src/release/assets/premium-lessons.tpk'),
    'Do NOT commit paid packs: create them only during ephemeral signed CI builds');
 const gradle=fs.readFileSync('app/build.gradle','utf8');
 assert(gradle.includes("System.getenv('TERMEH_ENABLE_LIVE_CHECKOUT') == '1'"),
   'Actual checkout requires explicit opt-in; a build MUST NOT begin charging by default');
 assert(gradle.includes("if (liveRequested && !paidReady)"),
   'No checkout without RSA and paid lesson pack');
 const native=fs.readFileSync('app/src/main/java/com/termeh/piano/VerifiedPremiumLessons.java','utf8');
 assert(native.includes('!BuildConfig.DEBUG')&&native.includes('BuildConfig.BAZAAR_CHECKOUT_ENABLED'));
 assert(native.includes('isOwnedOffline()'),'Paid content must be owned in native Android Keystore');
 assert(native.includes('PremiumPackReader.decrypt('),'AES tamper checks must gate lesson delivery');
 console.log('PASS: full curriculum encrypted with disposable key, never shipped in plaintext, native ownership guard; checkout opt-in OFF by default.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
