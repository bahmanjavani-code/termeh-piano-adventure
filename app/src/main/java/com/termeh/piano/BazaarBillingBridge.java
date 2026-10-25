package com.termeh.piano;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.app.Activity;

import org.json.JSONObject;

import ir.cafebazaar.poolakey.Payment;
import ir.cafebazaar.poolakey.Connection;
import ir.cafebazaar.poolakey.config.PaymentConfiguration;
import ir.cafebazaar.poolakey.config.SecurityCheck;
import ir.cafebazaar.poolakey.entity.PurchaseInfo;
import ir.cafebazaar.poolakey.entity.PurchaseState;
import kotlin.Unit;

/**
 * Safe phase-one integration with Cafe Bazaar's official Poolakey SDK.
 *
 * This bridge only checks locally verified ownership in a parent-only area.
 * It NEVER starts checkout, consumes the lifetime SKU, unlocks content,
 * stores purchase tokens, or hands purchase receipts to WebView JavaScript.
 *
 * No paid functionality may be enabled until server-side Bazaar verification,
 * authenticated premium data delivery and cross-device restore are implemented.
 */
final class BazaarBillingBridge {
    static final String PACKAGE_ID = "com.termeh.piano";
    static final String LIFETIME_SKU = "termeh_premium_lifetime";

    private final Activity activity;
    private final WebView web;
    private Payment payment;
    private Connection connection;
    private volatile boolean connected;
    private volatile boolean destroyed;

    BazaarBillingBridge(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
    }

    void start() {
        String key = BuildConfig.BAZAAR_RSA_PUBLIC_KEY;
        if (key == null || key.isEmpty()) return; // Fail closed until Bazaar public RSA key provided.
        try {
            PaymentConfiguration config = new PaymentConfiguration(new SecurityCheck.Enable(key), false);
            payment = new Payment(activity, config);
            connection = payment.connect(callback -> {
                callback.connectionSucceed(() -> {
                    connected = true;
                    publishStatus("ready");
                    return Unit.INSTANCE;
                });
                callback.connectionFailed(error -> {
                    connected = false;
                    publishStatus("unavailable");
                    return Unit.INSTANCE;
                });
                callback.disconnected(() -> {
                    connected = false;
                    publishStatus("unavailable");
                    return Unit.INSTANCE;
                });
                return Unit.INSTANCE;
            });
        } catch (RuntimeException ignored) {
            // Never surface raw SDK exceptions or receipts in child-accessible UI.
            connected = false;
            publishStatus("unavailable");
        }
    }

    @JavascriptInterface
    public String status() {
        if (BuildConfig.BAZAAR_RSA_PUBLIC_KEY.isEmpty()) return "not_configured";
        return connected ? "ready" : "unavailable";
    }

    /** Read-only query. Results are NOT an entitlement until verified by our future backend. */
    @JavascriptInterface
    public void checkOwnedPurchase() {
        activity.runOnUiThread(() -> {
            if (destroyed) return;
            if (!connected || payment == null) {
                publishStatus("unavailable");
                return;
            }
            publishStatus("checking");
            try {
                payment.getPurchasedProducts(callback -> {
                    callback.querySucceed(purchases -> {
                        boolean ownsSku = false;
                        for (PurchaseInfo purchase : purchases) {
                            if (PACKAGE_ID.equals(purchase.getPackageName())
                                    && LIFETIME_SKU.equals(purchase.getProductId())
                                    && purchase.getPurchaseState() == PurchaseState.PURCHASED) {
                                ownsSku = true;
                                break;
                            }
                        }
                        // Local RSA signature checking is enabled above, but a real entitlement
                        // still requires private-server receipt verification and content delivery.
                        publishStatus(ownsSku ? "owned_unverified" : "not_found");
                        return Unit.INSTANCE;
                    });
                    callback.queryFailed(error -> {
                        publishStatus("query_failed");
                        return Unit.INSTANCE;
                    });
                    return Unit.INSTANCE;
                });
            } catch (RuntimeException ignored) {
                publishStatus("query_failed");
            }
        });
    }

    /**
     * Parent-screen only cryptographic self-test; works OFFLINE and never unlocks.
     * PUBLIC dummy AES key + dummy encrypted content are only for QA, not sales.
     */
    @JavascriptInterface
    public void checkEncryptedDemoPack() {
        activity.runOnUiThread(() -> {
            if (destroyed) return;
            publishStatus(PremiumPackDemo.verify(activity.getAssets())
                    ? "demo_pack_ok" : "demo_pack_failed");
        });
    }

    private void publishStatus(String status) {
        activity.runOnUiThread(() -> {
            if (destroyed) return;
            // Only constant status strings cross into JavaScript; never receipts or identifiers.
            web.evaluateJavascript("window.termehBazaarStatus && window.termehBazaarStatus("
                    + JSONObject.quote(status) + ");", null);
        });
    }

    void shutdown() {
        destroyed = true;
        connected = false;
        if (connection != null) connection.disconnect();
        connection = null;
        payment = null;
    }
}
