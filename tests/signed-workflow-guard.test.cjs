'use strict';
// Dependency-free safety check for our SIGNED release pipeline. GitHub does not
// execute a malformed workflow, so pull-request CI must validate its structure.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const text=fs.readFileSync('.github/workflows/release.yml','utf8');

function once(value,label){
  const parts=text.split(value);
  assert.equal(parts.length,2,label+' must appear exactly once');
  return text.indexOf(value);
}
const steps=[
  'Configure secret signing material',
  'Verify original release key and certificate identity',
  'Package authenticated paid lessons if owner provisioned an AES build key',
  'Build release APK using signed keystore',
  'Verify APK signature, Android target, and privacy',
  'Upload signed APK for controlled review',
  'Display artifact link',
  'Remove temporary signing and paid-content material'
];
let prev=-1;
for(const name of steps){
  const at=once('      - name: '+name+'\n',name);
  assert(at>prev,'Signed release step order is important: '+name);
  prev=at;
}
assert(text.includes('allow_controlled_real_checkout:'),'Explicit per-run controlled charge confirmation missing');
assert(text.includes('default: false'),'Real charging MUST be OFF by default');
assert(text.includes("inputs.allow_controlled_real_checkout && vars.TERMEH_ENABLE_LIVE_CHECKOUT || '0'"),
  'Even an accidentally enabled repository variable must NOT start real charge without per-run approval');
assert(text.includes("TERMEH_BAZAAR_CONTROLLED_TEST_AUTHORIZED:"),
  'Real controlled checkout must ALSO require the merchant owner approval variable');
assert(text.includes('TERMEH_KEYSTORE_BASE64'),'Never publish using an ephemeral QA keystore');
assert(text.includes('CONTENT_KEY="$(openssl rand -hex 32)"'),
  'Signed candidate must auto-generate a unique paid-lesson AES key when no secret has been set');
assert(text.includes('echo "::add-mask::$CONTENT_KEY"'),
  'Ephemeral AES build key must be redacted from all CI logs');
assert(text.includes("printf 'TERMEH_PREMIUM_CONTENT_KEY_HEX=%s\\n' \"$CONTENT_KEY\" >> \"$GITHUB_ENV\""),
  'Signed build and encrypted pack must share one ephemeral key inside the same CI job');
assert(!text.includes('Premium content key not provisioned: no paid lesson pack'),
  'Owner should not have to manually create yet another secret just to test the encrypted content');

assert(text.includes('TERMEH_RELEASE_CERT_SHA256'),'Verify same permanent release cert');
assert(text.includes('assets/premium-lessons[.]tpk$'), 'Optional full lesson asset must be identified precisely');
assert(text.includes('unzip -p "$APK" assets/premium-lessons.tpk | grep -q'), 'Signed APK must verify encrypted lesson artifact');
assert(text.includes('rm -f app/src/release/assets/premium-lessons.tpk'),
  'Encrypted build output must be removed even when CI fails');
assert(!/^; then$/m.test(text),'Corrupted trailing shell fragment must never reappear');
assert(!/\n      - name: Upload signed APK[^\n]*[\s\S]*\n      - name: Upload signed APK/m.test(text),
  'Never upload the same signed candidate from duplicate steps');

// Extract every inline GitHub Actions bash block with exactly YAML's
// 10-space script indentation and use the shell parser, not a string guess.
const lines=text.split('\n');let scripts=0;
for(let i=0;i<lines.length;i++){
  if(lines[i].trim()!=='run: |')continue;
  let j=i+1;
  const block=[];
  for(;j<lines.length;j++){
    const line=lines[j];
    if(!line.trim()){block.push('');continue}
    if(!line.startsWith('          '))break;
    block.push(line.slice(10));
  }
  assert(block.length>0,'Missing script after YAML run: | at line '+(i+1));
  const sh=block.join('\n');
  const process=spawnSync('bash',['-n'],{input:sh,encoding:'utf8'});
  assert.equal(process.status,0,
    'Malformed Bash in signed workflow after line '+(i+1)+': '+process.stderr);
  scripts++;
}
assert(scripts>=6,'Expected full signing, staging, verification and cleanup shell blocks');
console.log('PASS: signed workflow has one upload/cleanup, valid shell, no accidental checkout and persistent certificate pinning.');
