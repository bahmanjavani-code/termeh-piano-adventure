#!/usr/bin/env node
'use strict';

/**
 * Developer-only encrypted content pack prototype.
 *
 * Seal: node tools/secure-premium-pack.cjs seal <premium-content.json> <output.tpk> <output.key>
 * Open: node tools/secure-premium-pack.cjs open <output.tpk> <output.key> <restored.json>
 *
 * The key file is SECRET: never bundle it in the APK or commit it to the repo.
 * The production server must release it ONLY after successful Bazaar receipt
 * verification. This CLI never talks to a payment gateway.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const PACKAGE_NAME='com.termeh.piano';
const SKU='termeh_premium_lifetime';
const FORMAT='TPK1';
const MAX_BYTES=2*1024*1024;
const AAD=Buffer.from(PACKAGE_NAME+'|'+SKU+'|'+FORMAT,'utf8');

function die(message) {console.error(message); process.exitCode=1;}
function loadKey(filename) {
  const encoded=fs.readFileSync(filename,'utf8').trim();
  if(!/^[a-f0-9]{64}$/i.test(encoded))throw Error('Expected 32-byte hex key');
  return Buffer.from(encoded,'hex');
}
function writePrivate(filename, contents){
  const fd=fs.openSync(filename,'wx',0o600); // no accidental overwrite or world-readable key file
  try{fs.writeFileSync(fd,contents)}finally{fs.closeSync(fd)}
}
function seal(input, output, keyfile){
  if(path.resolve(output)===path.resolve(keyfile))throw Error('Key and pack paths must differ');
  const data=fs.readFileSync(input);
  if(data.length===0||data.length>MAX_BYTES)throw Error('Content size out of range');
  // This format is a data pack, not a dex/APK or executable installer.
  const parsed=JSON.parse(data.toString('utf8'));
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Content must be JSON object');
  const key=crypto.randomBytes(32);
  const iv=crypto.randomBytes(12);
  const enc=crypto.createCipheriv('aes-256-gcm',key,iv);
  enc.setAAD(AAD);
  const ciphertext=Buffer.concat([enc.update(data),enc.final()]);
  const document={
    format:FORMAT,
    packageName:PACKAGE_NAME,
    productId:SKU,
    nonce:iv.toString('base64'),
    ciphertext:ciphertext.toString('base64'),
    tag:enc.getAuthTag().toString('base64')
  };
  // Reserve private key first and fail closed if files already exist.
  writePrivate(keyfile,key.toString('hex')+'\n');
  try{fs.writeFileSync(output,JSON.stringify(document)+'\n',{flag:'wx',mode:0o644})}
  catch(e){try{fs.unlinkSync(keyfile)}catch(ignored){}throw e}
  console.log('Encrypted premium DATA pack created. Keep key OUTSIDE the APK and repository.');
}
function open(input,keyfile,output){
  const envelope=JSON.parse(fs.readFileSync(input,'utf8'));
  if(envelope.format!==FORMAT||envelope.packageName!==PACKAGE_NAME||envelope.productId!==SKU)
    throw Error('Invalid content format, package or product');
  const iv=Buffer.from(envelope.nonce,'base64');
  const tag=Buffer.from(envelope.tag,'base64');
  const ciphertext=Buffer.from(envelope.ciphertext,'base64');
  if(iv.length!==12||tag.length!==16||ciphertext.length>MAX_BYTES+16||ciphertext.length===0)
    throw Error('Malformed content pack');
  const dec=crypto.createDecipheriv('aes-256-gcm',loadKey(keyfile),iv);
  dec.setAAD(AAD);
  dec.setAuthTag(tag);
  const plaintext=Buffer.concat([dec.update(ciphertext),dec.final()]); // rejects corruption
  if(plaintext.length>MAX_BYTES)throw Error('Decrypted content too large');
  JSON.parse(plaintext.toString('utf8')); // expected JSON, not code
  fs.writeFileSync(output,plaintext,{flag:'wx',mode:0o600});
  console.log('Decrypted developer test data pack.');
}
if(require.main===module){
  const [command,input,output,secretOrOutput,...extra]=process.argv.slice(2);
  if(extra.length||!['seal','open'].includes(command)||!input||!output||!secretOrOutput){
    die('Usage: seal <input.json> <pack.tpk> <secret.key> | open <pack.tpk> <secret.key> <output.json>');
  }else{
    try{
      if(command==='seal')seal(input,output,secretOrOutput);
      else open(input,output,secretOrOutput);
    }catch(error){die('Content-pack operation failed: '+error.message)}
  }
}
module.exports={seal,open,FORMAT,SKU,PACKAGE_NAME};
