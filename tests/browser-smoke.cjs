// Headless smoke test for the bundled offline app.
// CI installs playwright-core; no external service or device permissions are used.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const { chromium }=require('playwright-core');

(async()=>{
  const bins=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean);
  const executablePath=bins.find(f=>fs.existsSync(f));
  assert(executablePath,'Chrome/Chromium required for UI smoke test');
  const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
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
    await page.goto('file://'+path.resolve('app/src/main/assets/index.html'));
    await page.locator("button[onclick=\"chooseLanguage('en')\"]").click();
    await page.waitForTimeout(300);
    // A parent must acknowledge once, after choosing the language, before the child can play.
    assert(await page.locator('#parentWelcome').isVisible(),'First-launch parent notice missing');
    assert(await page.locator('#welcomeContinue').isDisabled(),'Notice must not auto-accept');
    assert((await page.locator('#welcomePrivacy').getAttribute('href')).includes('/en/privacy.html'),'Wrong privacy policy language');
    await assertEnglishScreen('first-launch parent notice');
    await page.locator('#welcomeAccepted').check();
    assert(await page.locator('#welcomeContinue').isEnabled(),'Parent confirmation should enable continue');
    await page.locator('#welcomeContinue').click();
    assert(!(await page.locator('#parentWelcome').isVisible()),'Parent notice should close after explicit confirmation');
    await page.reload();
    await page.waitForTimeout(200);
    assert(!(await page.locator('#parentWelcome').isVisible()),'Parent notice must not reappear after acceptance');
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
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
    // Simulate previous legitimate practice history to exercise assessment UI.
    await page.evaluate(()=>{
      state.mastery.treble.attempts=Array.from({length:80},(_,i)=>({correct:true,note:TREBLE_NOTES[i%TREBLE_NOTES.length].code,ms:1200,at:Date.now()}));
      updateExamButton();
    });
    assert(await page.locator('#examStartBtn').isEnabled(),'Assessment should be available after mastery');
    await page.locator('#examStartBtn').click();
    assert(await page.evaluate(()=>state.exam&&state.exam.active),'Exam did not begin');
    await page.evaluate(()=>{for(let i=0;i<20;i++)submitExamAnswer(state.currentStaffNote.keyId)});
    assert(await page.evaluate(()=>state.mastery.treble.examPassed),'Independent assessment did not pass');
    await page.locator('#modeTab-bass').click();
    assert.equal(await page.evaluate(()=>state.mode),'bass','Bass did not unlock after assessment');
    await assertEnglishScreen('bass clef');
    await page.evaluate(()=>{
      state.mastery.bass.attempts=Array.from({length:80},(_,i)=>({correct:true,note:BASS_NOTES[i%BASS_NOTES.length].code,ms:1200,at:Date.now()}));
      updateExamButton();
    });
    await page.locator('#examStartBtn').click();
    await page.evaluate(()=>{for(let i=0;i<20;i++)submitExamAnswer(state.currentStaffNote.keyId)});
    assert(await page.evaluate(()=>state.mastery.bass.examPassed),'Bass assessment failed to save');
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
    assert(!errors.length,'Browser JavaScript errors: '+errors.join(' | '));
    console.log('PASS: English flow, correct/wrong note, parent gate, independent exams, bass/rhythm unlock and persistence.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
