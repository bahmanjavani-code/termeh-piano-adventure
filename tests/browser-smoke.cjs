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
    fs.copyFileSync('app/src/main/assets/note-curriculum.js',path.join(dir,'note-curriculum.js'));
    fs.copyFileSync('app/src/main/assets/rewards-engine.js',path.join(dir,'rewards-engine.js'));
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
    // Upgrading from the original notice must require acknowledgment of its revised scope,
    // without touching any previously stored learning progress.
    await page.evaluate(()=>{localStorage.setItem('termeh_parent_welcome_v1','accepted');localStorage.setItem('termeh_keep_progress_probe','preserve-me')});
    await page.locator("button[onclick=\"chooseLanguage('en')\"]").click();
    await page.waitForTimeout(300);
    // A parent must acknowledge once, after choosing the language, before the child can play.
    assert(await page.locator('#parentWelcome').isVisible(),'First-launch parent notice missing');
    assert(await page.locator('#welcomeContinue').isDisabled(),'Notice must not auto-accept');
    assert((await page.locator('#parentWelcome').innerText()).includes('not the primary source of music education'),'Educational scope must be conspicuous before play');
    assert((await page.locator('#parentWelcome').innerText()).includes('No specific learning or playing outcome is guaranteed'),'No-guaranteed-results notice missing');
    assert((await page.locator('#parentWelcome').innerText()).includes('Real checkout is disabled in this beta'),'Purchase limitations must be clear');
    // The parent cannot bypass the notice by reloading or invoking the handler directly.
    await page.evaluate(()=>confirmParentWelcome());
    assert(await page.locator('#parentWelcome').isVisible(),'Missing checkbox must block acknowledgment');
    await page.reload();
    assert(await page.locator('#parentWelcome').isVisible(),'Unaccepted revised notice must reappear');
    assert(await page.locator('#welcomeContinue').isDisabled(),'Reload must not auto-enable acceptance');
    assert((await page.locator('#welcomePrivacy').getAttribute('href')).includes('/en/privacy.html'),'Wrong privacy policy language');
    assert((await page.locator('#welcomeTerms').getAttribute('href')).includes('/en/terms.html'),'Wrong Terms of Use language');
    await assertEnglishScreen('first-launch parent notice');
    await page.locator('#welcomeAccepted').check();
    assert(await page.locator('#welcomeContinue').isEnabled(),'Parent confirmation should enable continue');
    await page.locator('#welcomeAccepted').uncheck();
    assert(await page.locator('#welcomeContinue').isDisabled(),'Unticking should lock continue again');
    await page.locator('#welcomeAccepted').check();
    await page.locator('#welcomeContinue').click();
    const noticeRecord=await page.evaluate(()=>JSON.parse(localStorage.getItem('termeh_parent_welcome_v2')));
    assert.equal(noticeRecord.revision,2);
    assert.equal(noticeRecord.acknowledged,true);
    assert.equal(noticeRecord.language,'en');
    assert(!Number.isNaN(Date.parse(noticeRecord.acknowledgedAt)),'Acknowledgment date missing');
    assert.equal(await page.evaluate(()=>localStorage.getItem('termeh_keep_progress_probe')),'preserve-me','Onboarding must not wipe local progress');
    assert(!(await page.locator('#parentWelcome').isVisible()),'Parent notice should close after explicit confirmation');
    await page.reload();
    await page.waitForTimeout(200);
    assert(!(await page.locator('#parentWelcome').isVisible()),'Parent notice must not reappear after acceptance');
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
    assert.equal(await page.evaluate(()=>TREBLE_NOTES.length),12,'Debug-only upper G5 practice expected');
    assert.equal(await page.evaluate(()=>getActiveTrebleNotes().length),5,'First lesson should start with five beginner notes');
    assert.equal(await page.evaluate(()=>BASS_NOTES.length),10,'Debug preview should include bass');
    assert.equal(await page.evaluate(()=>NOTE_DURATIONS.length),4,'Debug preview should include rhythm');
    await assertEnglishScreen('initial staff');
    assert(await page.locator('#masteryDock').isVisible(),'Compact progress strip must be visible under the music game');
    assert(!(await page.locator('#masteryDashboard').isVisible()),'Progress explanation should not clutter the game');
    for(const id of ['masteryProgressTrack','masteryAccuracyTrack','masterySpeedTrack']){
      assert(await page.locator('#'+id).isVisible(),'Missing colored progress meter: '+id);
    }
    assert.equal(await page.locator('#masteryBarsButton').getAttribute('aria-expanded'),'false');
    await page.locator('#masteryBarsButton').click();
    assert(await page.locator('#masteryDashboard').isVisible(),'Tapping bars must reveal explanations');
    assert((await page.locator('#masteryDashboard').innerText()).includes('Purple: Stage and assessment readiness'));
    await assertEnglishScreen('progress explanations');
    await page.locator('#masteryBarsButton').click();
    assert(!(await page.locator('#masteryDashboard').isVisible()),'Second tap should fold the explanation back');
    await page.locator('#masteryBarsButton').click();
    await page.waitForTimeout(7200);
    assert(!(await page.locator('#masteryDashboard').isVisible()),'Progress explanation must close after a few seconds');
    // Compact menu must not obscure the piano; science and legal notices remain readable.
    assert(await page.locator('#appMenuToggle').isVisible(),'Settings menu button missing');
    assert(!(await page.locator('#appMenu').isVisible()),'Menu must start closed');
    assert((await page.locator('#termehCopyright').innerText()).includes('All rights reserved'));
    await page.locator('#appMenuToggle').click();
    assert(await page.locator('#appMenu').isVisible(),'Settings menu did not open');
    await assertEnglishScreen('menu');
    await page.locator('button[onclick="showTermehInfo(\'science\')"]').click();
    assert(await page.locator('#appInfoDialog').isVisible(),'Evidence information missing');
    assert((await page.locator('[data-termeh-info="science"]').innerText()).includes('not been established'));
    await assertEnglishScreen('science explanation');
    await page.locator('#appInfoDialog .termehMenuClose').click();
    await page.locator('#appMenuToggle').click();
    await page.locator('button[onclick="showTermehInfo(\'limits\')"]').click();
    assert((await page.locator('[data-termeh-info="limits"]').innerText()).includes('supplementary educational game'));
    await assertEnglishScreen('educational limitations');
    await page.locator('#appInfoDialog .termehMenuClose').click();
    await page.locator('#appMenuToggle').click();
    await page.locator('[data-termeh-theme-choice="dark"]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('data-termeh-theme')),'dark');
    assert.equal(await page.evaluate(()=>localStorage.getItem('termeh_theme_v1')),'dark');
    await assertEnglishScreen('dark theme settings');
    await page.locator('#appMenu .termehMenuClose').click();
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
    await page.locator('#appMenuToggle').click();
    await page.locator('#parentLaunch').click();
    assert(!(await page.locator('#appMenu').isVisible()),'Parent entry must close settings menu');
    assert(await page.locator('#parentHub').evaluate(x=>x.classList.contains('open')));
    await assertEnglishScreen('parent gate');
    const math=await page.locator('#hubMath').innerText();
    const parsed=math.match(/^(\d+)\s*([×+−])\s*(\d+)\s*([+−])\s*(\d+)\s*=\s*\?$/);
    assert(parsed,'Unexpected parent puzzle format: '+math);
    const calc=(a,op,b)=>op==='×'?a*b:op==='+'?a+b:a-b;
    await page.locator('#hubAnswer').fill(String(calc(calc(Number(parsed[1]),parsed[2],Number(parsed[3])),parsed[4],Number(parsed[5]))));
    await page.locator('#parentHubGate button').click();
    assert(await page.locator('#parentHubOptions').isVisible(),'Parent gate not passable');
    await assertEnglishScreen('parent account panel');
    assert(await page.locator('#parentHubOptions button:has-text("Sign in")').isDisabled(),'Fake sign in must be disabled');
    assert(await page.locator('#premiumOffer').isVisible(),'One-time premium offer missing in parent hub');
    assert(await page.locator('#buyPremiumBtn').isDisabled(),'Payment MUST stay disabled until Bazaar billing integration');
    assert(await page.locator('#restorePremiumBtn').isDisabled(),'Restore MUST stay disabled until verified purchases are possible');
    assert((await page.locator('#premiumOffer').innerText()).includes('99,000'),'Expected planned price inside parent area');
    assert(await page.locator('button[onclick="termehReportErrors()"]').isVisible(),'Parent report button missing');
    assert(await page.locator('button[onclick="termehCheckUpdates()"]').isVisible(),'Parent update button missing');
    assert((await page.locator('#parentReportCount').innerText()).length>0,'Local diagnostic status missing');
    assert(await page.locator('#sendParentFeedback').isVisible(),'Parent feedback entry missing');
    assert(!(await page.locator('#buyPremiumBtn').isEnabled()),'Menu must not enable checkout');
    assert((await page.locator('#parentPrivacyPolicy').getAttribute('href')).includes('/en/privacy.html'));
    assert((await page.locator('#parentTerms').getAttribute('href')).includes('/en/terms.html'));
    assert(await page.locator('#parentReviewNotice').isVisible(),'Parents must be able to review the notice later');
    await page.locator('#parentReviewNotice').click();
    assert(!(await page.locator('#parentHub').isVisible()),'Parent options should close before reviewing notice');
    assert(await page.locator('#parentWelcome').isVisible(),'Reread button must reopen notice');
    assert(await page.locator('#welcomeContinue').isDisabled(),'Rereading must also start with unchecked confirmation');
    await assertEnglishScreen('parent reread');
    await page.locator('#welcomeAccepted').check();
    await page.locator('#welcomeContinue').click();
    assert(!(await page.locator('#parentWelcome').isVisible()),'Reread should return to game');
    await page.evaluate(()=>openMascotModal());
    await assertEnglishScreen('buddy picker');
    await page.evaluate(()=>closeMascotModal());
    await page.evaluate(()=>openTrophyModal());
    await assertEnglishScreen('trophies');
    // Legacy coins are preserved, but an unearned badge still needs real practice stars.
    await page.evaluate(()=>{
      state.coins=1000;state.stars=39;state.unlockedBadges=['starter_star'];state.equippedBadgeId='starter_star';
      renderTrophyModalContent();
    });
    assert(await page.locator('button[onclick="buyTrophy(\'golden_piano\')"]').isDisabled(),'A large legacy wallet cannot skip practice');
    await page.evaluate(()=>{state.stars=40;renderTrophyModalContent()});
    assert(await page.locator('button[onclick="buyTrophy(\'golden_piano\')"]').isEnabled(),'Practice gate and coins should unlock a badge');
    await page.locator('button[onclick="buyTrophy(\'golden_piano\')"]').click();
    assert(!(await page.locator('#trophyModal').isVisible()),'Buying badge should reveal the newly equipped reward');
    assert.equal(await page.locator('#equippedTrophyPiano').innerText(),'🎹');
    assert.equal(await page.locator('#equippedTrophyStaff').innerText(),'🎹');
    assert.equal(await page.evaluate(()=>state.equippedBadgeId),'golden_piano');
    assert(await page.evaluate(()=>state.unlockedBadges.includes('golden_piano')),'Bought trophy must be kept');
    await page.evaluate(()=>{const prev=state.coins;equipTrophy('rainbow_trophy');if(state.coins!==prev)throw Error('Unearned trophy equip affected wallet')});
    await page.evaluate(()=>{state.rewardPendingQuestions=3;rewardCompletedExercise();saveState()});
    assert.equal(await page.evaluate(()=>state.rewardPendingQuestions),0,'Milestone must roll over after four exercises');
    await page.reload();
    assert.equal(await page.evaluate(()=>state.equippedBadgeId),'golden_piano','Equipped trophy must survive reload');
    assert.equal(await page.locator('#equippedTrophyPiano').innerText(),'🎹','Equipped sticker must remain visible after relaunch');
    // An easy two-minute run must never make the child 'finish' treble.
    await page.evaluate(()=>{
      state.mastery.treble.attempts=Array.from({length:20},(_,i)=>({correct:true,note:TREBLE_NOTES[i%5].code,ms:500,at:Date.now()}));
      updateExamButton();
    });
    assert(await page.locator('#examStartBtn').isDisabled(),'20 perfect fast responses must NOT unlock exam');
    assert.equal(await page.evaluate(()=>getMastery('treble').stage),1,'Short session must still be practice stage 1');
    await page.locator('#masteryBarsButton').click();
    assert((await page.locator('#masteryStats').innerText()).includes('20 questions'),'Progress explanation must report true practice count');
    assert.equal(Number(await page.locator('#masteryProgressTrack').getAttribute('aria-valuenow')),await page.evaluate(()=>getMastery('treble').score));
    assert.equal(Number(await page.locator('#masteryAccuracyTrack').getAttribute('aria-valuenow')),await page.evaluate(()=>getMastery('treble').accuracy60));
    await page.locator('#masteryBarsButton').click();
    // An honest first tier requires varied mastery of ALL five starter notes.
    // Pretend a previous child session has already trained all five: no progress reset.
    await page.evaluate(()=>{
      state.mastery.treble.attempts=Array.from({length:80},(_,i)=>({correct:true,note:TREBLE_NOTES[i%5].code,ms:1200,at:Date.now()}));
      state.staffQuestionSolved=true;
      updateExamButton();
      goToNextStaffQuestion();
    });
    assert(await page.locator('#learningMilestone').isVisible(),'End of starter lesson should explain newly unlocked notes');
    assert((await page.locator('#learningMilestoneDescription').innerText()).includes('A4'),'Unlock announcement must list genuinely new notes');
    assert.equal(await page.evaluate(()=>state.trebleNoteTier),2,'Starter mastery must unlock exactly one tier');
    assert.deepEqual(await page.evaluate(()=>getActiveTrebleNotes().map(n=>n.code)),['C4','D4','E4','F4','G4','A4','B4','C5'],'Earlier notes must never be removed');
    await assertEnglishScreen('first treble lesson completion');
    await page.locator('#learningMilestoneContinue').click();
    assert(!(await page.locator('#learningMilestone').isVisible()),'Lesson recap should close to reveal practice');
    assert(await page.locator('#examStartBtn').isDisabled(),'Middle lesson is not the final exam');
    await page.reload();
    assert.equal(await page.evaluate(()=>state.trebleNoteTier),2,'Unlocked notes must survive app restart');
    await page.evaluate(()=>{
      state.mastery.treble.attempts=Array.from({length:110},(_,i)=>({
        correct:i===99||i===107?false:true,
        note:TREBLE_NOTES[i%8].code,ms:TREBLE_NOTES[i%8].code==='A4'?6500:1600,at:Date.now()+i*1000
      }));
      state.staffQuestionSolved=true;
      goToNextStaffQuestion();
    });
    assert(await page.locator('#learningMilestone').isVisible(),'Middle lesson should show review of difficult notes');
    assert((await page.locator('#learningMilestoneDescription').innerText()).includes('D5'),'Final tier must introduce truly higher notes');
    assert((await page.locator('#learningMilestoneStaff ellipse').count())>0,'Hard notes must be drawn on the musical staff');
    assert((await page.locator('#learningMilestoneNoteNames').innerText()).includes('Mistakes and slow answers'));
    assert.equal(await page.evaluate(()=>state.trebleNoteTier),3);
    assert.deepEqual(await page.evaluate(()=>getActiveTrebleNotes().map(n=>n.code)),['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5']);
    await assertEnglishScreen('upper treble lesson completion');
    await page.locator('#learningMilestoneContinue').click();
    await page.reload();
    assert.equal(await page.evaluate(()=>state.trebleNoteTier),3,'Full preview tier must persist across reload');
    // Manual review from the menu should not jump questions or reveal an exam answer.
    const earlierNote=await page.evaluate(()=>state.currentStaffNote.code);
    await page.locator('#appMenuToggle').click();
    await page.locator("button[onclick=\"closeTermehMenu();showWeakNoteReview()\"]").click();
    assert(await page.locator('#learningMilestone').isVisible(),'Parent/child can revisit hard-note report');
    await page.locator('#learningMilestoneContinue').click();
    assert.equal(await page.evaluate(()=>state.currentStaffNote.code),earlierNote,'Opening review must not skip unsolved question');
    assert(await page.locator('#examStartBtn').isDisabled(),'110 practice questions cannot finish the 150-question requirement');
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
    assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('data-termeh-theme')),'dark','Dark theme preference must persist');
    // A different release asset is packaged for paying/non-paying production users.
    // The release must remain free and must NOT embed premium lesson definitions.
    // Confirm the same parental briefing works in Persian without automatically consenting.
    const faPage=await browser.newPage({viewport:{width:390,height:844}});
    faPage.on('pageerror',e=>errors.push('fa '+e.message));
    await faPage.goto(debugUrl);
    await faPage.locator("button[onclick=\"chooseLanguage('fa')\"]").click();
    assert(await faPage.locator('#parentWelcome').isVisible(),'Persian first-launch briefing must appear');
    assert((await faPage.locator('#welcomeHeading').innerText()).includes('سخنی مهم با والدین'));
    assert((await faPage.locator('#parentWelcome').innerText()).includes('مرجع اصلی یادگیری موسیقی نیست'));
    assert(await faPage.locator('#welcomeContinue').isDisabled());
    await faPage.locator('#welcomeAccepted').check();
    await faPage.locator('#welcomeContinue').click();
    assert.equal(await faPage.evaluate(()=>JSON.parse(localStorage.getItem('termeh_parent_welcome_v2')).language),'fa');
    await faPage.close();
    const freePage=await browser.newPage({viewport:{width:390,height:844}});
    freePage.on('pageerror',e=>errors.push('release '+e.message));
    await freePage.goto(releaseUrl);
    await freePage.locator("button[onclick=\"chooseLanguage('en')\"]").click();
    await freePage.locator('#welcomeAccepted').check();
    await freePage.locator('#welcomeContinue').click();
    assert.equal(await freePage.evaluate(()=>document.documentElement.getAttribute('data-termeh-edition')),'store','Store-specific polish must be applied');
    await freePage.locator('#appMenuToggle').click();
    await freePage.locator('#parentLaunch').click();
    const parentMath=await freePage.locator('#hubMath').innerText();
    const m=parentMath.match(/^(\d+)\s*([×+−])\s*(\d+)\s*([+−])\s*(\d+)\s*=\s*\?$/);
    assert(m,'Parent math challenge must still be required for store users');
    const arithmetic=(x,op,y)=>op==='×'?x*y:op==='+'?x+y:x-y;
    await freePage.locator('#hubAnswer').fill(String(arithmetic(arithmetic(+m[1],m[2],+m[3]),m[4],+m[5])));
    await freePage.locator('button[onclick="verifyParentHub()"]').click();
    assert(await freePage.locator('#parentHubOptions').isVisible(),'Release parent gate must open');
    for(const id of ['checkBazaarBtn','checkEncryptedPackBtn','checkOfflineVaultBtn','restoreExistingBazaarBtn','buyPremiumBtn','restorePremiumBtn']){
      assert(!(await freePage.locator('#'+id).isVisible()),'Do not show inaccessible QA/checkout button to release parents: '+id);
    }
    assert(await freePage.locator('#sendParentFeedback').isVisible(),'Parent feedback should remain accessible');
    assert(await freePage.locator('.termehStoreOnly').first().isVisible(),'Honest current product scope must be shown');
    await freePage.locator('#parentHub .close').click();
    assert.equal(await freePage.evaluate(()=>TREBLE_NOTES.length),5,'Free release must have five starter notes only');
    assert.equal(await freePage.evaluate(()=>TermehNoteCurriculum.maxTier(TREBLE_NOTES)),1,'Free release must not unlock absent premium note tiers');
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
