// Developer-only AES-GCM content-pack regression tests. No secrets are committed.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {seal,open,SKU,PACKAGE_NAME}=require('../tools/secure-premium-pack.cjs');
const {getBetaLessonFixture}=require('../tools/export-beta-lesson-fixture.cjs');

const root=fs.mkdtempSync(path.join(os.tmpdir(),'termeh-premium-'));
const file=name=>path.join(root,name);
try{
  const sample={
    schema:1,
    productId:SKU,
    lessons:[{id:'rhythm_private_example',title:'Private premium fixture — not real production content'}]
  };
  fs.writeFileSync(file('input.json'),JSON.stringify(sample),'utf8');
  seal(file('input.json'),file('pack.tpk'),file('license.key'));
  const envelope=JSON.parse(fs.readFileSync(file('pack.tpk'),'utf8'));
  assert.equal(envelope.productId,SKU);
  assert.equal(envelope.packageName,PACKAGE_NAME);
  assert(!fs.readFileSync(file('pack.tpk'),'utf8').includes('Private premium fixture'),
    'Premium plaintext must never be present inside encrypted pack');
  assert.equal(fs.readFileSync(file('license.key'),'utf8').trim().length,64,
    'Generated AES content key must be 32 bytes');
  if(process.platform!=='win32'){
    const mode=fs.statSync(file('license.key')).mode&0o777;
    assert.equal(mode&0o077,0,'Key must not be group/world readable');
  }
  open(file('pack.tpk'),file('license.key'),file('unpacked.json'));
  assert.deepEqual(JSON.parse(fs.readFileSync(file('unpacked.json'),'utf8')),sample);

  // An independent key must NEVER decrypt another purchase's pack.
  fs.writeFileSync(file('wrong.key'),'aa'.repeat(32));
  assert.throws(()=>open(file('pack.tpk'),file('wrong.key'),file('wrong.json')));
  assert(!fs.existsSync(file('wrong.json')),'No plaintext when authentication fails');

  // Ciphertext modification must be caught before writing content.
  const changed=structuredClone(envelope);
  const cipher=Buffer.from(changed.ciphertext,'base64');
  cipher[0]^=1;
  changed.ciphertext=cipher.toString('base64');
  fs.writeFileSync(file('tampered.tpk'),JSON.stringify(changed));
  assert.throws(()=>open(file('tampered.tpk'),file('license.key'),file('tampered.json')));
  assert(!fs.existsSync(file('tampered.json')));

  // Cannot swap a pack to another package or SKU.
  const changedSku={...envelope,productId:'other_product'};
  fs.writeFileSync(file('wrong-sku.tpk'),JSON.stringify(changedSku));
  assert.throws(()=>open(file('wrong-sku.tpk'),file('license.key'),file('wrong-sku.json')));
  assert(!fs.existsSync(file('wrong-sku.json')));

  // CLI must not accidentally overwrite an existing private key.
  assert.throws(()=>seal(file('input.json'),file('another.tpk'),file('license.key')));
  assert(!fs.existsSync(file('another.tpk')));
  // Exercise the real lesson pack schema with PUBLIC debug fixtures (NOT paid secrets).
  const beta=getBetaLessonFixture();
  assert.equal(beta.schema,1);
  assert.equal(beta.packageName,PACKAGE_NAME);
  assert.equal(beta.productId,SKU);
  assert.equal(beta.trebleExtra.length,7);
  assert.equal(beta.bass.length,10);
  assert.equal(beta.durations.length,4);
  fs.writeFileSync(file('beta-demo.json'),JSON.stringify(beta));
  seal(file('beta-demo.json'),file('beta-demo.tpk'),file('beta-demo.key'));
  const encrypted=fs.readFileSync(file('beta-demo.tpk'),'utf8');
  const packed=JSON.parse(encrypted);
  assert(!('bass' in packed)&&!('trebleExtra' in packed)&&!('durations' in packed),'Premium plaintext arrays must not be present in pack envelope');
  assert(!encrypted.includes('"hintText"')&&!encrypted.includes('"beatsLabel"'),'No plaintext lesson fields in encrypted pack');
  open(file('beta-demo.tpk'),file('beta-demo.key'),file('beta-restored.json'));
  assert.deepEqual(JSON.parse(fs.readFileSync(file('beta-restored.json'),'utf8')),beta);
  console.log('PASS: beta lesson schema and authenticated AES pack, tamper protection and safe key handling.');
}finally{
  fs.rmSync(root,{recursive:true,force:true});
}
