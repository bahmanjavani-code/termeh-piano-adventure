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
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Safe phase-one integration with Cafe Bazaar's official Poolakey SDK.
 *
 * This bridge only queries locally verified ownership from Poolakey.
 * Parent-only restore checks can cache a native Android Keystore entitlement
 * for ALREADY-OWNED purchases. They NEVER initiate a charge or unlock content.
 * No purchase token or receipt is stored or sent to WebView JavaScript.
 * Two self-tests verify noncommercial AES content and disposable Keystore
 * storage without creating any purchase entitlement.
 *
 * The owner selected local Poolakey verification without a server; this has
 * limited resistance to patched APKs. No paid functionality may be enabled
 * until authenticated lesson decoding, offline ownership and restore are tested.
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
    private final AtomicBoolean restoreInProgress = new AtomicBoolean(false);

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

    /** Read-only query. Results are NOT an entitlement until the native ownership gate is complete. */
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
                        // Local RSA signature checking is enabled. Still no entitlement:
                        // checkout, encrypted real lessons and offline restore are unfinished.
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

    /**
     * Parent-only Android Keystore health check. Tests a disposable AES-GCM
     * encrypted record and clears its separate key/prefs afterwards.
     * Does NOT create, modify, or unlock a premium purchase entitlement.
     */
    @JavascriptInterface
    public void checkOfflineVaultDemo() {
        activity.runOnUiThread(() -> {
            if (destroyed) return;
            publishStatus("vault_checking");
            new Thread(() -> {
                boolean passed = new OfflineLicenseVault(activity).disposableSelfTest();
                publishStatus(passed ? "vault_demo_ok" : "vault_demo_failed");
            }, "termeh-disposable-keystore-test").start();
        });
    }

    /**
     * Check and restore an ALREADY-OWNED lifetime purchase. No checkout starts.
     *
     * Only the Poolakey callback is allowed to supply PurchaseInfo. Poolakey's
     * signature checking is enabled at connection creation. JavaScript can
     * request a check, but cannot submit a purchase, receipt or owned flag.
     *
     * This is deliberately NOT a premium unlock: no content key is returned
     * and no lesson is made available. The native Keystore record is a first
     * prerequisite for a future tested, serverless purchase/restore flow.
     */
    @JavascriptInterface
    public void restoreVerifiedPurchase() {
        activity.runOnUiThread(() -> {
            if (destroyed) return;
            if (!connected || payment == null) {
                publishStatus("restore_unavailable");
                return;
            }
            if (!restoreInProgress.compareAndSet(false, true)) {
                publishStatus("restore_busy");
                return;
            }
            publishStatus("restore_checking");
            try {
                payment.getPurchasedProducts(callback -> {
                    callback.querySucceed(purchases -> {
                        if (purchases == null) {
                            restoreInProgress.set(false);
                            publishStatus("restore_failed");
                            return Unit.INSTANCE;
                        }

                        PurchaseInfo validOwned = null;
                        for (PurchaseInfo purchase : purchases) {
                            if (purchase != null
                                    && PACKAGE_ID.equals(purchase.getPackageName())
                                    && LIFETIME_SKU.equals(purchase.getProductId())
                                    && purchase.getPurchaseState() == PurchaseState.PURCHASED) {
                                validOwned = purchase;
                                break;
                            }
                        }
                        final PurchaseInfo owned = validOwned;
                        // AndroidKeyStore may block; do not use the UI callback thread.
                        new Thread(() -> {
                            String result = "restore_failed";
                            try {
                                OfflineLicenseVault vault = new OfflineLicenseVault(activity);
                                if (owned != null) {
                                    if (vault.recordVerifiedPurchase(owned)
                                            && vault.isOwnedOffline()) {
                                        result = "restore_cached_no_unlock";
                                    }
                                } else if (vault.clearAfterConfirmedNotOwned()) {
                                    // Clear only on a SUCCESSFUL Bazaar query with no
                                    // valid ownership, never for offline/network errors.
                                    result = "restore_no_purchase";
                                }
                            } catch (Exception ignored) {
                                // No tokens, account data or SDK errors leave native code.
                            } finally {
                                restoreInProgress.set(false);
                                publishStatus(result);
                            }
                        }, "termeh-native-restore-qa").start();
                        return Unit.INSTANCE;
                    });
                    callback.queryFailed(error -> {
                        restoreInProgress.set(false);
                        // Preserve any offline entitlement on a failed query.
                        publishStatus("restore_failed");
                        return Unit.INSTANCE;
                    });
                    return Unit.INSTANCE;
                });
            } catch (RuntimeException ignored) {
                restoreInProgress.set(false);
                publishStatus("restore_failed");
            }
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
