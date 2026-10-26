# Release hardening: R8 shrinks and obfuscates the native Java application.
# The HTML/JavaScript assets are not protected by R8 and must never contain secrets.

# Android creates WorkManager workers reflectively. Their constructor must
# survive R8 minification in the signed production APK.
-keep class com.termeh.piano.DailyPracticeReminder$ReminderWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}

# WebView invokes annotated methods by name, never via Java static references.
-keepclassmembers class com.termeh.piano.MainActivity$PracticeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
