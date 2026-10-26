package com.termeh.piano;

import androidx.activity.ComponentActivity;
import android.content.Intent;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import android.content.ActivityNotFoundException;
import android.app.AlertDialog;
import android.content.Context;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.RenderProcessGoneDetail;
import android.net.Uri;

public class MainActivity extends ComponentActivity {
    private static final String START_PAGE = "file:///android_asset/index.html";
    private static final int PRACTICE_NOTIFICATION_REQUEST = 3141;
    private WebView web;
    private SupportTools support;
    private BazaarBillingBridge billing;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        SupportTools.installNativeCrashRecorder(this);
        support = new SupportTools(this);

        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true); // Bundled offline HTML.
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setBlockNetworkLoads(true); // WebView never loads Internet resources.

        // Bazaar's official library uses a PUBLIC RSA verification key.
        // QA keeps read-only diagnostics; a signed release registers its native
        // bridge only when the merchant key is configured. Real purchases
        // require a separate compile-time opt-in AND encrypted paid lessons.
        if (BuildConfig.DEBUG || !BuildConfig.BAZAAR_RSA_PUBLIC_KEY.isEmpty()) {
            billing = new BazaarBillingBridge(this, web);
            web.addJavascriptInterface(billing, "TermehBazaar");
        }

        // Practice completion is tracked as today's date only, on this device.
        // A reminder can be enabled/disabled only by an explicit parent action.
        web.addJavascriptInterface(new PracticeBridge(), "TermehPractice");

        web.setWebViewClient(new WebViewClient() {
            private boolean handleLink(String link) {
                if (link == null) return true;
                Uri uri;
                try { uri = Uri.parse(link); }
                catch (Exception ignored) { return true; }
                if ("termeh-support".equals(uri.getScheme())) {
                    if ("report".equals(uri.getHost())) {
                        support.composeEmail(uri.getQueryParameter("events"));
                    } else if ("updates".equals(uri.getHost())) {
                        support.checkUpdates(true);
                    } else if ("feedback".equals(uri.getHost())) {
                        support.composeFeedback();
                    }
                    return true;
                }
                if ("https".equals(uri.getScheme()) && "bahmanjavani-code.github.io".equals(uri.getHost())) {
                    String page = uri.getPath();
                    if ("/termeh-piano-adventure/privacy.html".equals(page)
                            || "/termeh-piano-adventure/en/privacy.html".equals(page)
                            || "/termeh-piano-adventure/terms.html".equals(page)
                            || "/termeh-piano-adventure/en/terms.html".equals(page)) {
                        try {
                            startActivity(Intent.createChooser(new Intent(Intent.ACTION_VIEW, uri), "Open policy / نمایش شرایط"));
                        } catch (ActivityNotFoundException ignored) { }
                        return true;
                    }
                }
                // No navigation outside the packaged home page.
                return !START_PAGE.equals(link);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleLink(url);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleLink(request.getUrl().toString());
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                if (!START_PAGE.equals(url)) view.stopLoading();
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (START_PAGE.equals(url) && billing != null) {
                    // Genuine previously purchased content becomes accessible
                    // offline on relaunch; do not ask for another payment.
                    billing.deliverCachedContent();
                }
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                support.recordRendererCrash();
                view.destroy();
                web = null;
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Termeh Piano")
                        .setMessage("برنامه دچار خطا شد. لطفاً دوباره اجرا کنید. / The app needs to restart.")
                        .setCancelable(false)
                        .setPositiveButton("Restart / راه‌اندازی مجدد", (d, w) -> recreate())
                        .show();
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(request::deny);
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin,
                    android.webkit.GeolocationPermissions.Callback callback) {
                callback.invoke(origin, false, false);
            }
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    // Record only the line number, never raw messages or child's answers.
                    support.recordWebError(message.lineNumber());
                }
                return false;
            }
        });

        setContentView(web);
        web.loadUrl(START_PAGE);
        support.enforceCachedPolicy();
        support.checkUpdates(false);
        DailyPracticeReminder.ensureScheduled(this);
        if (billing != null) billing.start();
    }

    public final class PracticeBridge {
        @JavascriptInterface public void setLanguage(String language) {
            // Only a two-letter UI preference is stored on-device; no identity.
            DailyPracticeReminder.setLanguage(MainActivity.this, language);
        }

        @JavascriptInterface public void recordExercise() {
            DailyPracticeReminder.recordCompletedExercise(MainActivity.this);
        }

        @JavascriptInterface public String reminderStatus() {
            return DailyPracticeReminder.status(MainActivity.this);
        }

        @JavascriptInterface public void enableReminder() {
            runOnUiThread(() -> {
                // The button lives behind the existing parent arithmetic gate;
                // even parental opt-in never bypasses Android's system permission.
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},
                            PRACTICE_NOTIFICATION_REQUEST);
                } else {
                    DailyPracticeReminder.enable(MainActivity.this);
                    sendReminderStatus();
                }
            });
        }

        @JavascriptInterface public void disableReminder() {
            runOnUiThread(() -> {
                DailyPracticeReminder.disable(MainActivity.this);
                sendReminderStatus();
            });
        }
    }

    private void sendReminderStatus() {
        if (web == null) return;
        String status = DailyPracticeReminder.status(this);
        web.evaluateJavascript("window.termehReminderStatus && window.termehReminderStatus("
                + JSONObject.quote(status) + ");", null);
    }

    @Override public void onRequestPermissionsResult(int requestCode,
            String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != PRACTICE_NOTIFICATION_REQUEST) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            DailyPracticeReminder.enable(this);
        }
        // Denial is not re-prompted automatically; parent can retry in Settings.
        sendReminderStatus();
    }

    @Override protected void onResume() {
        super.onResume();
        if (support != null) support.enforceCachedPolicy();
    }

    @Override public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("(function(){var p=document.getElementById('parentHub');if(p&&p.classList.contains('open')){closeParentHub();return true;}var u=document.getElementById('unlockOverlay');if(u&&u.classList.contains('open')){closeUnlock();return true;}return false;})()",
                handled -> {
                    if (!"true".equals(handled)) {
                        if (web != null && web.canGoBack()) web.goBack();
                        else MainActivity.super.onBackPressed();
                    }
                });
    }

    @Override protected void onDestroy() {
        if (billing != null) { billing.shutdown(); billing = null; }
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
