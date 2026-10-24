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
    await page.goto('file://'+path.resolve('app/src/main/assets/index.html'));
    await page.locator("button[onclick=\"chooseLanguage('en')\"]").click();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
    assert(await page.locator('#musicStaffSvg ellipse').count()>0,'Staff note not rendered');
    let key=await page.evaluate(()=>state.currentStaffNote.keyId);
    await page.locator('#pianoKey-'+key).click();
    assert(await page.evaluate(()=>state.staffQuestionSolved),'Correct key not accepted');
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
    await page.locator('#parentLaunch').click();
    assert(await page.locator('#parentHub').evaluate(x=>x.classList.contains('open')));
    const math=await page.locator('#hubMath').innerText();
    const nums=math.match(/\d+/g).map(Number);
    await page.locator('#hubAnswer').fill(String(nums[0]*nums[1]+nums[2]));
    await page.locator('#parentHubGate button').click();
    assert(await page.locator('#parentHubOptions').isVisible(),'Parent gate not passable');
    assert(await page.locator('#parentHubOptions button').first().isDisabled(),'Fake sign in must be disabled');
    await page.locator('#parentHub .close').click();
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
    const beatHint=await page.locator('#rhythmQuizApples').innerText();
    assert(!beatHint.includes('🍎'),'Rhythm quiz leaked beat count');
    await page.reload();
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'en','English preference not persisted');
    assert(!errors.length,'Browser JavaScript errors: '+errors.join(' | '));
    console.log('PASS: English flow, correct/wrong note, parent gate, independent exams, bass/rhythm unlock and persistence.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
