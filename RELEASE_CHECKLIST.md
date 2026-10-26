# Termeh Piano — release readiness

## مسیر فعال پروژه: فقط کافه‌بازار

- [x] توسعهٔ خروجی جداگانه Family متوقف شد؛ ساخت و انتشار فایل Family از GitHub Actions حذف شد.
- [x] ابزارهای آزمایشیِ خرید، قفل نمونه و حساب‌های غیرفعال از رابط **Release** پنهان شده‌اند؛ در debug برای بررسی توسعه باقی می‌مانند.
- [x] متن و چک‌لیست عملی بازار در [BAZAAR_LAUNCH_PACKET_FA.md](BAZAAR_LAUNCH_PACKET_FA.md) آماده شد.
- [ ] **تصمیم پرداخت نهایی:** همان خرید یک‌بارهٔ درون‌برنامه‌ایِ از قبل انتخاب‌شده یا (فقط با تصمیم صاحب محصول) برنامهٔ کاملاً پولی قبل از دانلود.
- [ ] مهم: فایل Release فعلی تنها پنج نت رایگان دارد و **هنوز نسخهٔ قابل فروش نیست**. فعال‌سازی واقعی خرید، دروس پیشرفته و تست برگشت وجه مانده‌اند.

## آزمون اعلان روزانه (جدید)

- [ ] آزمایش روی اندروید ۱۳ به بالا: پس از اجازهٔ اختیاری والدین مجوز اعلان درخواست شود، در حالت ردِ مجوز هیچ اعلان و درخواست خودکار تکراری نباشد.
- [ ] آزمایش روی اندروید ۸ تا ۱۲: بدون درخواست مجوز runtime، روشن/خاموش‌شدن در بخش والدین درست کار کند؛ تنظیمات سراسری اعلان باید رعایت شود.
- [ ] با حداقل یک تمرین کامل در همان روز، اعلان آن روز ارسال نشود؛ در غیر این صورت حداکثر روزی یک بار حوالی ۱۸ (نه لزوماً دقیقاً ۱۸) باشد؛ مزاحم خواب نباشد.
- [ ] بعد از لغو والدین، ادامهٔ پیام‌ها متوقف و اعلان نمایش‌داده‌شده پاک شود؛ بدون حساب کودک، تبلیغ یا شبکه.
- [ ] امضای اصلی APK و پیشرفت قبلی هنگام نصب به‌روزرسانی حفظ شود؛ نسخهٔ رایگان نت‌های پولی را در APK نداشته باشد.

## قبل از انتشار رسمی: ممیزی متن‌های آزمایشی داخل اپ (الزامی)

**این موارد باید پیش از ثبت نسخهٔ تجاری بررسی و از متنِ قابل‌دیدن خریدار حذف/با متن واقعی جایگزین شوند.** داشتن این چک‌لیست به معنی آماده‌بودن نسخهٔ فعلی برای فروش نیست.

- [ ] همهٔ اشاره‌های قابل‌مشاهده به `beta`، `QA`، «آزمایشی»، «هنوز فعال نیست»، «به‌زودی»، «پیشنهادی/برنامه‌ریزی‌شده» و پیام‌های تست داخلی از منو، «دربارهٔ برنامه»، اطلاعیهٔ اولین اجرا، پنل والدین و صفحهٔ قفل حذف یا با وضعیت واقعی محصول جایگزین شوند؛ **اما محدودیت‌های واقعیِ باقی‌مانده صادقانه اعلام شوند.**
- [ ] اطلاعیهٔ نخستین اجرا دقیقاً با **قیمت نهایی، نحوهٔ خرید، بازیابی خرید و محتوای واقعاً عرضه‌شده** مطابقت داشته باشد. هر تغییر مهم در شرایط/اطلاعیه، نسخهٔ `termeh_parent_welcome_v4` و `REVISION` را برای درخواست تأیید مجدد افزایش دهد؛ تاریخچهٔ تمرین حذف نشود.
- [ ] متن مرتبط با «قفل آموزشی» و «قفل خرید» را در همهٔ حالت‌های قفل‌شده قابل‌فهم کنیم و فقط دربارهٔ مرحله‌بندی‌هایی ادعا کنیم که واقعاً در نرم‌افزار پیاده شده‌اند.
- [ ] تمام دکمه‌های مرتبط با آزمایش رمزنگاری، کلید عمومی، بررسی فنیِ مالکیت و پرداختِ غیرفعال از تجربهٔ عادی خانواده پنهان یا به ابزار QA غیرتجاری منتقل شوند.
- [ ] به‌جای ادعای «استاندارد جهانی تأیید کرد» از توضیحات دقیقِ «طراحی‌شده با الهام از شواهد پژوهشی» استفاده شود؛ حق استفاده از لوگوها/مراجع حفظ گردد.
- [ ] سیاست حریم خصوصی، شرایط استفاده، اطلاعات سازنده، حق‌تألیف، مجوزهای اجزای شخص ثالث، ایمیل پشتیبانی و توضیحات فروشگاه به‌روز و هماهنگ باشند.
- [ ] بررسی حقوقی متن اولین اجرا و شرایط خرید طبق قوانین قابل‌اجرا و قواعد کافه‌بازار انجام شود. **تیک والدین سلب مسئولیت کامل یا اثبات هویت قانونی نیست**؛ ثبت صرفاً روی گوشی برای تجربهٔ کاربری و نسخهٔ اطلاعیه است.
- [ ] فارسی/انگلیسی، خوانایی و پیمایش متن اولین اجرا روی گوشی واقعی، قطع اینترنت، تغییر زبان، تکرار پس از تغییر متن و ذخیرهٔ پیشرفت قبلی تست شود.
- [ ] روی گوشی ترمه فقط APK دارای **امضای پایدار اصلی** به‌روزرسانی شود؛ هرگز برای تست اطلاعیه داده‌ها پاک یا برنامه حذف نشود.

**Current status: beta/QA. Do not submit this build as a paid production app yet.**

## Changes already in the application
- Offline practice, optional parent hub, parent verification UI (math challenge).
- Independent 20-question final assessments, 18/20 required, in addition to 150 practice attempts and mastery thresholds.
- No microphone, camera, or location permissions. WebView denies permission prompts.
- Bilingual work underway; music databases and note frequencies are checked by automatic tests.
- Debug APK generated automatically by `.github/workflows/android.yml`.
- A **manual** workflow `.github/workflows/release.yml` exists for a **signed release candidate**, using GitHub Actions secrets only.

## New: parent support reports and minimum-version policy (version 1.3.1-beta)

- Parent hub now offers **Email error report** after the parent challenge. Error categories, line numbers, app version and Android API are collected locally. An Android mail composer opens; **the parent must review and tap Send**. No reports are auto-sent. The parent-review email composer is configured with the owner's provided support mailbox.
- The prefilled parent-reviewed recipient is configured in `SupportTools.java`. Never embed mailbox credentials or SMTP passwords in the APK.
- **Automatic crash alert emails are NOT active.** For production, provision a service such as Firebase Crashlytics with parent-consent design and child privacy disclosure; configure email alerts in its dashboard, and test fatal, non-fatal and ANR reporting. Ensure no personal data or children's answers enter diagnostic events.
- Android native startup performs an HTTPS fetch of `config/android-update.json` from GitHub raw, at most once per six hours on success; the WebView remains offline-only. This sends a standard network request (including the device's network IP) to GitHub; disclose it in the privacy policy. If GitHub is unreachable (or the repository isn't publicly readable) no new update policy can be received; choose a reliable production endpoint before launch.
- JSON keys: `schema: 1`, `minimumVersionCode`, `latestVersionCode`, `storeUrl`. Only a valid HTTPS `https://cafebazaar.ir/app/com.termeh.piano` URL can trigger an update gate. Current beta has an empty URL, so **forced updates are not active**.
- Once a new version is verified **live** in Cafe Bazaar, set both version codes appropriately and fill in the verified store listing URL. NEVER increase the minimum version before store availability has been confirmed; doing so can trap legitimate buyers.
- Last received mandatory version is cached and enforced while offline, but devices that have never contacted the update endpoint can still run offline indefinitely. Also, APKs released before this checker was introduced can **never** be remotely blocked retroactively.
- Update gates can be bypassed by modified APKs, rooted devices or clearing data: do not use this client-side mechanism to secure paid entitlements or sensitive data. Maintain the original app signing key across releases.
- Mandatory updates have a user-experience tradeoff: they may interrupt children's offline learning. Prefer reserving them for incompatible releases or urgent security repairs, with an accessible and functioning store link.

## Blockers before public commercial release
1. **Cafe Bazaar billing**: Create a permanent/non-consumable SKU in the developer console, implement purchase via the supported Bazaar Android billing SDK, server-verify receipts and entitlement ownership, handle pending/canceled/refunded purchases, restore purchase without requiring in-app registration. The current HTML must never be trusted as proof of payment.
2. **Optional parent account**: Choose a verified HTTPS identity and backup provider, integrate real sign-in / sign-out / registration, opt-in cloud sync, session invalidation, rate limiting, account deletion, and privacy controls. The current buttons are deliberately disabled. Do not request child names, ages, photographs, contacts, location, or audio.
3. **Signing**: Create/secure a long-lived developer-owned release keystore using the private [SIGNING_SETUP_FA.md](SIGNING_SETUP_FA.md) instructions, not ephemeral test keys. Configure repository Actions secrets:
   - `TERMEH_KEYSTORE_BASE64`
   - `TERMEH_KEYSTORE_PASSWORD`
   - `TERMEH_KEY_ALIAS`
   - `TERMEH_KEY_PASSWORD`
   Never commit the keystore or passwords and never paste them into chat. Also pin public `TERMEH_RELEASE_CERT_SHA256` under **Repository variables**. CI builds the production variant with a disposable key to check packaging, then deletes that artifact without uploading; only the manual `release.yml` workflow can use the user's permanent keystore.
4. **Store listing and child privacy**: Approved privacy policy, support contact, transparent feature/price descriptions, store declarations for apps intended for children, parent review of purchase prompts, and Bazaar policy review.
5. **Device testing**: Signed APK installation/upgrade, Play Protect scans, offline/airplane mode, Persian/English switching, long lessons, font and screen sizes, Android back navigation, accessibility, restore after reinstall, purchases with official test transactions, refunds, and performance on real devices.
6. **Music review**: Independent review by a qualified teacher, including staff positioning, treble and bass clefs, pitch/octaves, metronome timing, note-duration representation, and terminology in Persian/English. Automated music tests are necessary but not sufficient.

## Verification
- `node tests/quality.test.cjs` — JavaScript syntax, staff notes, reference pitches, rhythm values, permissions, exam logic.
- `node tests/browser-smoke.cjs` — requires playwright-core and a local Chrome/Chromium; simulated user UI and quiz progression.
- Debug GitHub Actions build checks APK permissions and posts an artifact link.
- Manual signed release-candidate build checks APK signature, target API 35, and privacy permissions before uploading artifact.

## Security limitations
- R8 obfuscates native Java release code; **bundled HTML/JavaScript is inspectable**.
- Offline training progress and unlocks can be modified on a rooted/tampered device. They are **not purchase entitlements**.
- Server-issued, cryptographically verified purchase entitlement is mandatory for commercially restricted content, balanced against legitimate offline access.
- A multiplication question is only a parent-directed friction step; it does **not** verify adult identity or meet all child-safety obligations on its own.
