'use strict';
/** Static safety checks for parent-opt-in OFFLINE WorkManager notifications.
 * Actual permission UI, battery timing and reminder delivery require Android device QA.
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const java=read('app/src/main/java/com/termeh/piano/DailyPracticeReminder.java');
const activity=read('app/src/main/java/com/termeh/piano/MainActivity.java');
const manifest=read('app/src/main/AndroidManifest.xml');
const gradle=read('app/build.gradle');
const html=read('app/src/main/assets/index.html');
const preview=read('app/src/release/assets/premium-preview.js');
assert.match(manifest,/android.permission.POST_NOTIFICATIONS/,'Android 13+ runtime notification permission must be declared');
assert.doesNotMatch(manifest,/SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM|READ_CONTACTS|READ_PHONE_STATE/,
  'No exact alarms or sensitive child data permissions are needed');
assert(gradle.includes("androidx.work:work-runtime:2.10.5"),
  'WorkManager must run locally without a push server');
assert(java.includes('SharedPreferences')&&java.includes('LocalDate.now().toString()'),
  'Reminder saves only day-level exercise state, with no answers or child identity');
assert(java.includes('SUGGESTED_HOUR = 18')&&java.includes('PeriodicWorkRequest.Builder'),
  'Opted-in daily reminder should be scheduled in local early evening');
assert(java.includes('24L, TimeUnit.HOURS'),'Do not send more than one daily reminder cycle');
assert(java.includes('KEY_LAST_PRACTICE_DAY')&&java.includes('KEY_LAST_REMINDER_DAY'),
  'Skip reminders on practiced days and suppress duplicates');
assert(java.includes('now.isBefore(LocalTime.of(16, 0))')
  && java.includes('!now.isBefore(LocalTime.of(21, 0))'),
  'Do not notify outside afternoon/evening when background tasks drift');
assert(java.includes('ExistingPeriodicWorkPolicy.REPLACE')&&java.includes('cancelUniqueWork'),
  'Parent re-enabling must align schedule and opt-out must stop work');
assert(java.includes('ExistingPeriodicWorkPolicy.KEEP'),
  'Reopening the app must not postpone already scheduled 6 PM reminders');
assert(java.includes('schedule(context, ExistingPeriodicWorkPolicy.KEEP);'),
  'Keep existing reminder schedule across app restarts');
assert(java.includes('schedule(context, ExistingPeriodicWorkPolicy.REPLACE);'),
  'Only explicit parent opt-in can re-align a reminder to the next evening');
assert(java.includes('private static final String KEY_LANGUAGE = "ui_language"'),
  'The native notification language preference must stay local on device');
assert(java.includes('english ? "🎹 Time for a little piano?"'),
  'English reminder notifications must not contain Persian');
assert(java.includes('"🎹 وقت یک تمرین کوتاه پیانوست!"'),
  'Persian reminder notifications must not contain English');
assert(activity.includes('DailyPracticeReminder.setLanguage(MainActivity.this, language);'),
  'Language selection must update native notification messages');
assert(html.includes('window.TermehPractice.setLanguage(l);'),
  'WebView language must be passed to the native local reminder bridge');
assert(java.includes('if (!optedIn(context) || !permissionGranted(context))'),
  'Fail closed when parent opted out or system blocked notifications');
assert(java.includes('NotificationManager.IMPORTANCE_DEFAULT'));
assert(java.includes('manager.cancel(NOTICE_ID)'),'Opt-out must clear outstanding reminder');
assert(!java.includes('HttpURLConnection')&&!java.includes('Firebase'),'No push service or internet required');
assert(activity.includes('new PracticeBridge()')&&activity.includes('"TermehPractice"'),
  'Local JS bridge must be available to record completed exercises');
assert(activity.includes('requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}'),
  'Request runtime permission only in response to enabling');
assert(activity.includes('PRACTICE_NOTIFICATION_REQUEST'));
assert(activity.includes('DailyPracticeReminder.ensureScheduled(this);'));
assert(html.includes('id="dailyReminderPanel"')&&html.includes('id="dailyReminderEnable"')
  &&html.includes('id="dailyReminderDisable"'),
  'Parent controls must provide clear opt-in and opt-out buttons');
assert(html.includes('window.termehChangePracticeReminder=function(enable)'));
assert(html.includes("el('parentHubOptions').hidden"),'Only verified parent screen may toggle reminders');
assert(html.includes('window.TermehPractice.recordExercise();'),
  'Correctly completed exercises suppress same-day reminders');
assert(html.includes('window.termehRefreshPracticeReminder();'),
  'Show real setting once parent arithmetic gate passes');
assert(html.includes("const KEY='termeh_parent_welcome_v4',REVISION=4"),
  'Parent must acknowledge revised permissions and purchase model without resetting learning');
assert(preview.includes('release-free')&&preview.includes('TERMEH_DEBUG_PREMIUM = null'),
  'The public preview must NOT expose full paid content for sideload sharing');
assert(!preview.includes('trebleExtra')&&!preview.includes('"code": "G5"'),
  'Premium lesson definitions must not ship in free public APK');
assert(activity.includes('if (BuildConfig.DEBUG || !BuildConfig.BAZAAR_RSA_PUBLIC_KEY.isEmpty())')
    && activity.includes('new BazaarBillingBridge(this, web)'),
  'Native billing available only in debug or when actual merchant public key is configured');
assert(gradle.includes("System.getenv('TERMEH_ENABLE_LIVE_CHECKOUT') == '1'"),
  'Release checkout remains disabled until the owner explicitly approves payment QA');
console.log('PASS: explicit parent opt-in, Android permission, one daily local reminder, quiet hours, no-data practice detection, safe free release.');
