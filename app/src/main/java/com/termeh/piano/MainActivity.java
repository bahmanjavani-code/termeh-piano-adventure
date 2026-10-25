package com.termeh.piano;

import androidx.activity.ComponentActivity;
import android.content.Intent;
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

        // Packaged offline page only; read-only billing status, no checkout through JS.
        billing = new BazaarBillingBridge(this, web);
        web.addJavascriptInterface(billing, "TermehBazaar");

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
        billing.start();
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
