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
  'Stage AES-GCM paid curriculum using private or ephemeral build key',
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
assert(text.includes('  push:') && text.includes('    branches: [main]'),
  'Latest main must automatically generate a signed nonchargeable APK candidate');
const confirmGate="github.event_name == 'workflow_dispatch' && inputs.allow_controlled_real_checkout && inputs.owner_payment_acknowledgement == 'I_AUTHORIZE_REAL_BAZAAR_TEST_CHARGES'";
assert.equal(text.split(confirmGate).length-1,7,
  'Every checkout trigger, summary, package name and build check must require manual checkbox AND exact typed acknowledgement');
assert(text.includes('owner_payment_acknowledgement:') && text.includes("default: ''"),
  'A blank acknowledgement is required by default');
// A single named user-approved main transition can create a payable 1.0.1
// candidate; it cannot authorize later pushes or any public marketplace launch.
const pinnedPaidBuild="github.event_name == 'push' && github.ref == 'refs/heads/main' && github.event.before == '9713768080ebd8dc5f0a431aa076c54d3c6e40ae' && startsWith(github.event.head_commit.message, 'owner-approved-1.0.1-payable-candidate')";
assert.equal(text.split(pinnedPaidBuild).length-1,7,
 'Owner approved 1.0.1 paid test must be pinned to one exact preceding main SHA and all seven checkout gates');
assert(!text.includes('vars.TERMEH_ENABLE_LIVE_CHECKOUT') &&
       !text.includes('vars.TERMEH_BAZAAR_CONTROLLED_TEST_AUTHORIZED'),
  'Sticky repository variables must never authorize real money');
assert(text.includes('BAZAAR_CHECKOUT_ENABLED = false;') &&
       text.includes('BAZAAR_CHECKOUT_ENABLED = true;'),
  'Signed build must fail if compiled checkout mode disagrees with the requested one-time setting');
assert(text.includes('Termeh-Piano-CONTROLLED-REAL-PAYMENT-TEST-DO-NOT-PUBLISH'),
  'A money-enabled test artifact must be clearly distinguished from nonchargeable QA');
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
