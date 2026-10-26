package com.termeh.piano;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.app.AlertDialog;
import androidx.activity.ComponentActivity;
import ir.cafebazaar.poolakey.request.PurchaseRequest;
import java.util.Collections;

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
 * Native Bazaar lifetime-purchase bridge with explicit BUILD-TIME safeties.
 * By default (including ALL QA builds), checkout is off. A signed APK can
 * enable it ONLY after RSA verification, AES paid-lesson pack provisioning and
 * explicit opt-in. The real Cafe Bazaar catalog must also return this SKU.
 *
 * The UI receives only constant statuses, a public price string and lesson
 * DATA on a verified native entitlement; never receipt, token or developer key.
 * Without our own trusted backend, sophisticated APK patching is still possible.
 */
final class BazaarBillingBridge {
    static final String PACKAGE_ID = "com.termeh.piano";
    static final String LIFETIME_SKU = "termeh_premium_lifetime";

    private final ComponentActivity activity;
    private final WebView web;
    private Payment payment;
    private Connection connection;
    private volatile boolean connected;
    private volatile boolean destroyed;
    private final AtomicBoolean restoreInProgress = new AtomicBoolean(false);
    private final AtomicBoolean purchaseInProgress = new AtomicBoolean(false);
    private volatile boolean catalogReady;

    BazaarBillingBridge(ComponentActivity activity, WebView web) {
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
                    if (VerifiedPremiumLessons.enabled()) {
                        checkProductCatalog();
                        // A successful online query will revoke a refunded offline
                        // license. If Bazaar is offline, the prior genuine license
                        // stays cached for legitimate offline use.
                        restoreVerifiedPurchase();
                    }
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
    public boolean isLiveCheckoutEnabled() {
        return BuildConfig.BAZAAR_CHECKOUT_ENABLED && VerifiedPremiumLessons.enabled();
    }

    @JavascriptInterface
    public boolean canRestoreOwnedLessons() {
        // An already-paid customer can recover lessons when sales are paused.
        return VerifiedPremiumLessons.enabled();
    }

    @JavascriptInterface
    public String status() {
        if (BuildConfig.BAZAAR_RSA_PUBLIC_KEY.isEmpty()) return "not_configured";
        return connected ? "ready" : "unavailable";
    }


    private boolean checkoutConfigured() {
        // A valid previously purchased course can be RESTORED even when this
        // signed build deliberately disables any new monetary transaction.
        // Only this gate authorizes opening a new Bazaar checkout.
        return !destroyed && connected && payment != null
                && BuildConfig.BAZAAR_CHECKOUT_ENABLED
                && VerifiedPremiumLessons.enabled();
    }

    /**
     * Browse one product's PUBLIC store price and confirm SKU provisioning.
     * Never initiate a payment just by opening the parent section.
     */
    @JavascriptInterface
    public void checkProductCatalog() {
        activity.runOnUiThread(() -> {
            if (!checkoutConfigured()) {
                catalogReady = false;
                publishOffer("offer_unavailable", "");
                return;
            }
            try {
                payment.getInAppSkuDetails(Collections.singletonList(LIFETIME_SKU), callback -> {
                    callback.getSkuDetailsSucceed(details -> {
                        boolean found = false;
                        String price = "";
                        if (details != null) {
                            for (ir.cafebazaar.poolakey.entity.SkuDetails item : details) {
                                if (item != null && LIFETIME_SKU.equals(item.getSku())
                                        && item.getPrice() != null && !item.getPrice().trim().isEmpty()) {
                                    found = true;
                                    price = item.getPrice();
                                    break;
                                }
                            }
                        }
                        catalogReady = found;
                        publishOffer(found ? "offer_ready" : "offer_missing", found ? price : "");
                        return Unit.INSTANCE;
                    });
                    callback.getSkuDetailsFailed(error -> {
                        catalogReady = false;
                        publishOffer("offer_unavailable", "");
                        return Unit.INSTANCE;
                    });
                    return Unit.INSTANCE;
                });
            } catch (RuntimeException ignored) {
                catalogReady = false;
                publishOffer("offer_unavailable", "");
            }
        });
    }

    /** Called only by a deliberate tap in the parent math-gated screen. */
    @JavascriptInterface
    public void beginLifetimePurchase(String requestedLanguage) {
        activity.runOnUiThread(() -> {
            if (!checkoutConfigured() || !catalogReady) {
                publishStatus("purchase_unavailable");
                return;
            }
            if (!purchaseInProgress.compareAndSet(false, true)) {
                publishStatus("purchase_busy");
                return;
            }
            boolean en = "en".equals(requestedLanguage);
            new AlertDialog.Builder(activity)
                    .setTitle(en ? "One-time Termeh Piano upgrade" : "ارتقای دائمی پیانوی ترمه")
                    .setMessage(en ?
                        "You are leaving the game for Cafe Bazaar's official checkout. The store shows the final price. No subscriptions." :
                        "برای پرداخت به صفحهٔ رسمی کافه‌بازار می‌روید. قیمت نهایی در خود بازار نشان داده می‌شود. این خرید اشتراکی نیست.")
                    .setNegativeButton(en ? "Cancel" : "انصراف", (dialog, which) -> {
                        purchaseInProgress.set(false);
                        publishStatus("purchase_cancelled");
                    })
                    .setOnCancelListener(dialog -> {
                        purchaseInProgress.set(false);
                        publishStatus("purchase_cancelled");
                    })
                    .setPositiveButton(en ? "Continue in Bazaar" : "ادامه در کافه‌بازار", (dialog, which) -> {
                        if (!checkoutConfigured() || !catalogReady) {
                            purchaseInProgress.set(false);
                            publishStatus("purchase_unavailable");
                            return;
                        }
                        try {
                            // Do not consume a lifetime/non-consumable purchase.
                            payment.purchaseProduct(activity.getActivityResultRegistry(),
                                new PurchaseRequest(LIFETIME_SKU, "termeh_lifetime", null),
                                callback -> {
                                    callback.purchaseFlowBegan(() -> {
                                        publishStatus("purchase_started");
                                        return Unit.INSTANCE;
                                    });
                                    callback.failedToBeginFlow(error -> {
                                        purchaseInProgress.set(false);
                                        publishStatus("purchase_failed");
                                        return Unit.INSTANCE;
                                    });
                                    callback.purchaseSucceed(purchase -> {
                                        purchaseInProgress.set(false);
                                        if (purchase != null
                                                && PACKAGE_ID.equals(purchase.getPackageName())
                                                && LIFETIME_SKU.equals(purchase.getProductId())
                                                && purchase.getPurchaseState() == PurchaseState.PURCHASED) {
                                            publishStatus("purchase_verifying");
                                            // Query CURRENT inventory again; never unlock on
                                            // a purchase callback or receipt from JavaScript.
                                            restoreVerifiedPurchase();
                                        } else publishStatus("purchase_failed");
                                        return Unit.INSTANCE;
                                    });
                                    callback.purchaseCanceled(() -> {
                                        purchaseInProgress.set(false);
                                        publishStatus("purchase_cancelled");
                                        return Unit.INSTANCE;
                                    });
                                    callback.purchaseFailed(error -> {
                                        purchaseInProgress.set(false);
                                        publishStatus("purchase_failed");
                                        return Unit.INSTANCE;
                                    });
                                    return Unit.INSTANCE;
                                });
                        } catch (RuntimeException ignored) {
                            purchaseInProgress.set(false);
                            publishStatus("purchase_failed");
                        }
                    }).show();
        });
    }

    private void publishOffer(String status, String publicPrice) {
        activity.runOnUiThread(() -> {
            if (destroyed) return;
            String cleaned = publicPrice == null ? "" : publicPrice.replaceAll("[\\p{Cntrl}]", "");
            String safePrice = cleaned.substring(0, Math.min(80, cleaned.length()));
            web.evaluateJavascript("window.termehBazaarOffer && window.termehBazaarOffer("
                    + JSONObject.quote(status) + "," + JSONObject.quote(safePrice) + ");", null);
        });
    }

    /** A LOCAL offline license only; no JS flag can call this accessor. */
    void deliverCachedContent() {
        if (!VerifiedPremiumLessons.enabled() || destroyed) return;
        new Thread(() -> {
            JSONObject result = VerifiedPremiumLessons.loadOwnedContent(activity);
            if (result != null) publishPremiumContent(result);
        }, "termeh-offline-paid-content").start();
    }

    private void publishPremiumContent(JSONObject content) {
        if (content == null) return;
        activity.runOnUiThread(() -> {
            if (destroyed || !VerifiedPremiumLessons.enabled()) return;
            // JSON DATA, never receipt/token. Quote as JS string before parsing.
            web.evaluateJavascript("window.termehNativePremiumLoaded && window.termehNativePremiumLoaded(JSON.parse("
                    + JSONObject.quote(content.toString()) + "));", null);
        });
    }

    private void revokePremiumContent() {
        activity.runOnUiThread(() -> {
            if (destroyed) return;
            web.evaluateJavascript("window.termehNativePremiumRevoked && window.termehNativePremiumRevoked();", null);
        });
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
                                        // The pack decrypts ONLY after the native
                                        // signature-checked ownership is cached.
                                        JSONObject lessons = VerifiedPremiumLessons.loadOwnedContent(activity);
                                        if (lessons != null) {
                                            publishPremiumContent(lessons);
                                            result = "restore_active";
                                        } else {
                                            result = "restore_cached_no_unlock";
                                        }
                                    }
                                } else if (vault.clearAfterConfirmedNotOwned()) {
                                    // Clear only on a SUCCESSFUL Bazaar query with no
                                    // valid ownership, never for offline/network errors.
                                    revokePremiumContent();
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

    // Restoring a genuinely purchased SKU is harmless offline; the QA
    // manual restore action and automatic catalog check share this path.
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
        catalogReady = false;
        purchaseInProgress.set(false);
        if (connection != null) connection.disconnect();
        connection = null;
        payment = null;
    }
}
