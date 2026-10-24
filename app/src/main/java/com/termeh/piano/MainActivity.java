package com.termeh.piano;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.graphics.Bitmap;

public class MainActivity extends Activity {
    private static final String START_PAGE = "file:///android_asset/index.html";
    private WebView web;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true); // Required for bundled offline HTML.
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);

        // Do not let local asset links turn into external navigation or file access.
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !START_PAGE.equals(url);
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (!START_PAGE.equals(url)) view.stopLoading();
            }
        });
        // The child-facing app never requests microphone, camera, or geolocation.
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(request::deny);
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin,
                    android.webkit.GeolocationPermissions.Callback callback) {
                callback.invoke(origin, false, false);
            }
        });
        setContentView(web);
        web.loadUrl(START_PAGE);
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){var p=document.getElementById('parentHub');if(p&&p.classList.contains('open')){closeParentHub();return true;}var u=document.getElementById('unlockOverlay');if(u&&u.classList.contains('open')){closeUnlock();return true;}return false;})()",
            handled -> {
                if (!"true".equals(handled)) {
                    if (web.canGoBack()) web.goBack();
                    else MainActivity.super.onBackPressed();
                }
            });
    }

    @Override protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
