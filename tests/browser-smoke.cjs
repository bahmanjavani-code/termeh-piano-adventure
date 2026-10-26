// Headless smoke test for the bundled offline app.
// CI installs playwright-core; no external service or device permissions are used.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const { chromium }=require('playwright-core');

(async()=>{
  const bins=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean);
  const executablePath=bins.find(f=>fs.existsSync(f));
  assert(executablePath,'Chrome/Chromium required for UI smoke test');
  const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
  // Reconstruct each variant's bundled assets exactly as Gradle packages them.
  const dirs=[];
  function createAssets(variant) {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'termeh-'+variant+'-'));
    dirs.push(dir);
    fs.copyFileSync('app/src/main/assets/index.html',path.join(dir,'index.html'));
    fs.copyFileSync('app/src/main/assets/offline.css',path.join(dir,'offline.css'));
    fs.copyFileSync('app/src/main/assets/mastery-engine.js',path.join(dir,'mastery-engine.js'));
    fs.copyFileSync('app/src/'+variant+'/assets/premium-preview.js',path.join(dir,'premium-preview.js'));
    return 'file://'+path.join(dir,'index.html');
  }
  const debugUrl=createAssets('debug');
  const releaseUrl=createAssets('release');
  const errors=[];
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    page.on('pageerror',e=>errors.push(e.message));
    // Protect all visible child and parent screens against mixed Persian/English.
    async function assertEnglishScreen(stage) {
      const leaks=await page.evaluate(()=>{
        const result=[];
        const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()){
          const node=walker.currentNode, value=node.nodeValue.trim();
          if(!/[\u0600-\u06ff]/.test(value))continue;
          const el=node.parentElement;
          if(!el||el.closest('script,style,.only-fa,#languageGate'))continue;
          let parent=el,visible=true;
          while(parent&&parent!==document.body){
            const style=getComputedStyle(parent);
            if(style.display==='none'||style.visibility==='hidden'||style.opacity==='0'){visible=false;break}
            parent=parent.parentElement;
          }
          if(visible&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0)
            result.push((el.id||el.tagName)+': '+value.slice(0,120));
        }
        return result;
      });
      assert.deepEqual(leaks,[],'Persian text in English UI ('+stage+'): '+leaks.join(' | '));
    }
    await page.goto(debugUrl);
    await page.locator("button[onclick=\"chooseLanguage('en')\"]").click();
    await page.waitForTimeout(300);
    // A parent must acknowledge once, after choosing the language, before the child can play.
    assert(await page.locator('#parentWelcome').isVisible(),'First-launch parent notice missing');
    assert(await page.locator('#welcomeContinue').isDisabled(),'Notice must not auto-accept');
    assert((await page.locator('#welcomePrivacy').getAttribute('href')).includes('/en/privacy.html'),'Wrong privacy policy language');
    assert((await page.locator('#welcomeTerms').getAttribute('href')).includes('/en/terms.html'),'Wrong Terms of Use language');
    await assertEnglishScreen('first-launch parent notice');
    await page.locator('#welcomeAccepted').check();
    assert(await page.locator('#welcomeContinue').isEnabled(),'Parent confirmation should enable continue');
    await page.locator('#welcomeContinue').click();
    assert(!(await page.locator('#parentWelcome').isVisible()),'Parent notice should close after explicit confirmation');
    await page.reload();
    await page.waitForTimeout(200);
    assert(!(await page.locator('#parentWelcome').isVisible()),'Parent notice must not reappear after acceptance');
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
    assert.equal(await page.evaluate(()=>TREBLE_NOTES.length),11,'Debug preview should include advanced treble');
    assert.equal(await page.evaluate(()=>BASS_NOTES.length),10,'Debug preview should include bass');
    assert.equal(await page.evaluate(()=>NOTE_DURATIONS.length),4,'Debug preview should include rhythm');
    await assertEnglishScreen('initial staff');
    assert(await page.locator('#musicStaffSvg ellipse').count()>0,'Staff note not rendered');
    let key=await page.evaluate(()=>state.currentStaffNote.keyId);
    await page.locator('#pianoKey-'+key).click();
    assert(await page.evaluate(()=>state.staffQuestionSolved),'Correct key not accepted');
    await assertEnglishScreen('correct note');
    for(const id of ['headerMascotName','mascotSpeech','staffPositionLabel']){
      const txt=await page.locator('#'+id).innerText();
      assert(!/[\u0600-\u06ff]/.test(txt),'Persian leaked in English '+id+': '+txt);
    }
    await page.locator('#nextQuestionBtn').click();
    const wrong=await page.evaluate(()=>['A','B','C','D','E','F','G'].find(x=>x!==state.currentStaffNote.keyId));
    await page.locator('#pianoKey-'+wrong).click();
    const wrongText=await page.locator('#mascotSpeech').innerText();
    assert(!/[\u0600-\u06ff]/.test(wrongText),'Wrong-answer guidance not translated: '+wrongText);
    assert(!wrongText.includes('«'),'Answer revealed in wrong-answer guidance');
    await assertEnglishScreen('wrong note');
    // The price and checkout controls are inside the parent gate, never on the child view.
    assert(!(await page.locator('#premiumOffer').isVisible()),'Child should not see purchase prompt');
    await page.locator('#parentLaunch').click();
    assert(await page.locator('#parentHub').evaluate(x=>x.classList.contains('open')));
    await assertEnglishScreen('parent gate');
    const math=await page.locator('#hubMath').innerText();
    const nums=math.match(/\d+/g).map(Number);
    await page.locator('#hubAnswer').fill(String(nums[0]*nums[1]+nums[2]));
    await page.locator('#parentHubGate button').click();
    assert(await page.locator('#parentHubOptions').isVisible(),'Parent gate not passable');
    await assertEnglishScreen('parent account panel');
    assert(await page.locator('#parentHubOptions button').first().isDisabled(),'Fake sign in must be disabled');
    assert(await page.locator('#premiumOffer').isVisible(),'One-time premium offer missing in parent hub');
    assert(await page.locator('#buyPremiumBtn').isDisabled(),'Payment MUST stay disabled until Bazaar billing integration');
    assert(await page.locator('#restorePremiumBtn').isDisabled(),'Restore MUST stay disabled until verified purchases are possible');
    assert((await page.locator('#premiumOffer').innerText()).includes('99,000'),'Expected planned price inside parent area');
    assert(await page.locator('button[onclick="termehReportErrors()"]').isVisible(),'Parent report button missing');
    assert(await page.locator('button[onclick="termehCheckUpdates()"]').isVisible(),'Parent update button missing');
    assert((await page.locator('#parentReportCount').innerText()).length>0,'Local diagnostic status missing');
    await page.locator('#parentHub .close').click();
    await page.evaluate(()=>openMascotModal());
    await assertEnglishScreen('buddy picker');
    await page.evaluate(()=>closeMascotModal());
    await page.evaluate(()=>openTrophyModal());
    await assertEnglishScreen('trophies');
    await page.evaluate(()=>closeTrophyModal());
    // An easy two-minute run must never make the child 'finish' treble.
    await page.evaluate(()=>{
      state.mastery.treble.attempts=Array.from({length:20},(_,i)=>({correct:true,note:TREBLE_NOTES[i%TREBLE_NOTES.length].code,ms:500,at:Date.now()}));
      updateExamButton();
    });
    assert(await page.locator('#examStartBtn').isDisabled(),'20 perfect fast responses must NOT unlock exam');
    assert.equal(await page.evaluate(()=>getMastery('treble').stage),1,'Short session must still be practice stage 1');
    assert((await page.locator('#masteryStats').innerText()).includes('20 questions'),'Mastery dashboard must report real practice, not fake levels');
    // Even 80 flawless questions are NOT enough for the new 150-question fluency gate.
    await page.evaluate(()=>{
      state.mastery.treble.attempts=Array.from({length:80},(_,i)=>({correct:true,note:TREBLE_NOTES[i%TREBLE_NOTES.length].code,ms:1200,at:Date.now()}));
      updateExamButton();
    });
    assert(await page.locator('#examStartBtn').isDisabled(),'80 easy answers must NOT complete the new curriculum');
    // Simulate sustained balanced practice (not a purchase or an entitlement).
    await page.evaluate(()=>{
      state.mastery.treble.attempts=Array.from({length:150},(_,i)=>({correct:true,note:TREBLE_NOTES[i%TREBLE_NOTES.length].code,ms:1600,at:Date.now()}));
      updateExamButton();
    });
    assert(await page.locator('#examStartBtn').isEnabled(),'Assessment should be available after mastery');
    await page.locator('#examStartBtn').click();
    assert(await page.evaluate(()=>state.exam&&state.exam.active),'Exam did not begin');
    await page.evaluate(()=>{for(let i=0;i<20;i++)submitExamAnswer(state.currentStaffNote.keyId)});
    assert(await page.evaluate(()=>state.mastery.treble.examPassed&&state.mastery.treble.certifiedVersion===2),'New independent assessment did not grant version-2 skill certification');
    await page.locator('#modeTab-bass').click();
    assert.equal(await page.evaluate(()=>state.mode),'bass','Bass did not unlock after assessment');
    await assertEnglishScreen('bass clef');
    await page.evaluate(()=>{
      state.mastery.bass.attempts=Array.from({length:150},(_,i)=>({correct:true,note:BASS_NOTES[i%BASS_NOTES.length].code,ms:1200,at:Date.now()}));
      updateExamButton();
    });
    await page.locator('#examStartBtn').click();
    await page.evaluate(()=>{for(let i=0;i<20;i++)submitExamAnswer(state.currentStaffNote.keyId)});
    assert(await page.evaluate(()=>state.mastery.bass.examPassed&&state.mastery.bass.certifiedVersion===2),'Bass assessment failed to save version-2 certification');
    await page.locator('#modeTab-rhythm').click();
    assert.equal(await page.evaluate(()=>state.mode),'rhythm');
    await page.evaluate(()=>switchRhythmSubMode('quiz'));
    await assertEnglishScreen('rhythm quiz');
    const beatHint=await page.locator('#rhythmQuizApples').innerText();
    assert(!beatHint.includes('🍎'),'Rhythm quiz leaked beat count');
    await page.evaluate(()=>switchRhythmSubMode('learn'));
    await assertEnglishScreen('rhythm lesson');
    await page.evaluate(()=>switchRhythmSubMode('hold'));
    await assertEnglishScreen('rhythm hold');
    await page.reload();
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'en','English preference not persisted');
    // A different release asset is packaged for paying/non-paying production users.
    // The release must remain free and must NOT embed premium lesson definitions.
    const freePage=await browser.newPage({viewport:{width:390,height:844}});
    freePage.on('pageerror',e=>errors.push('release '+e.message));
    await freePage.goto(releaseUrl);
    await freePage.locator("button[onclick=\"chooseLanguage('en')\"]").click();
    await freePage.locator('#welcomeAccepted').check();
    await freePage.locator('#welcomeContinue').click();
    assert.equal(await freePage.evaluate(()=>TREBLE_NOTES.length),5,'Free release must have five starter notes only');
    assert.equal(await freePage.evaluate(()=>BASS_NOTES.length),0,'Bass lessons leaked into release build');
    assert.equal(await freePage.evaluate(()=>NOTE_DURATIONS.length),0,'Rhythm lessons leaked into release build');
    await freePage.evaluate(()=>{
      state.mastery.treble.attempts=Array.from({length:80},()=>({correct:true,note:'G4',ms:800,at:Date.now()}));
      state.mastery.treble.examPassed=true;
    });
    assert(!(await freePage.evaluate(()=>isModeUnlocked('bass'))),'Local progress must not unlock missing paid lessons');
    await freePage.locator('#modeTab-bass').click();
    assert(await freePage.locator('#unlockOverlay').evaluate(x=>x.classList.contains('open')),'Free release must show locked premium lesson notice');
    assert(!errors.length,'Browser JavaScript errors: '+errors.join(' | '));
    console.log('PASS: English flow, parent gate, 20/80-question false-completion regression, 150-question fluency and independent treble/bass exams.');
  }finally{await browser.close();for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exit(1)});
