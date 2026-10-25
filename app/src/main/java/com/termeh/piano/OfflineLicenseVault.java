package com.termeh.piano;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

import ir.cafebazaar.poolakey.entity.PurchaseInfo;
import ir.cafebazaar.poolakey.entity.PurchaseState;

/**
 * Device-local, Android-Keystore-protected ownership RECORD for future
 * serverless Bazaar billing. This is NOT the premium content key, a purchase
 * receipt, a checkout API, or a substitute for Poolakey's signature checks.
 *
 * The current beta NEVER calls recordVerifiedPurchase or uses isOwnedOffline to
 * unlock lessons. The sole active entry point is an isolated, disposable QA
 * round-trip. Production wiring requires purchase/restore/refund tests first.
 *
 * A patched APK can bypass local checks. Keystore encryption protects the
 * at-rest record against simple file modification; it is NOT an unbreakable DRM.
 */
final class OfflineLicenseVault {
    private static final String ALIAS = "termeh_offline_bazaar_lifetime_v1";
    private static final String PREFS = "termeh_native_entitlements_v1";
    private static final String RECORD = "encrypted_lifetime_record";
    private static final String DEMO_ALIAS = "termeh_disposable_keystore_qa_v1";
    private static final String DEMO_PREFS = "termeh_disposable_keystore_qa_prefs";
    private static final String DEMO_RECORD = "disposable_canary";

    private static final String IDENTITY = BazaarBillingBridge.PACKAGE_ID + "|"
            + BazaarBillingBridge.LIFETIME_SKU + "|vault-v1";
    private static final byte[] AAD = IDENTITY.getBytes(StandardCharsets.UTF_8);
    private static final long MIN_TIMESTAMP = 1577836800000L; // Jan 1 2020 UTC

    private final Context app;

    OfflineLicenseVault(Context context) {
        app = context.getApplicationContext();
    }

    private static SecretKey secretKey(String alias, boolean allowCreate) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(alias)) {
            java.security.Key existing = store.getKey(alias, null);
            if (!(existing instanceof SecretKey)) throw new SecurityException("Invalid key type");
            return (SecretKey) existing;
        }
        if (!allowCreate) return null;

        KeyGenerator generator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(alias,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }

    private static String seal(String alias, String plaintext) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey(alias, true));
        cipher.updateAAD(AAD);
        byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        try {
            JSONObject wrapped = new JSONObject();
            wrapped.put("schema", 1);
            wrapped.put("nonce", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
            wrapped.put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP));
            return wrapped.toString();
        } finally {
            Arrays.fill(ciphertext, (byte) 0);
        }
    }

    private static String unseal(String alias, String document) throws Exception {
        if (document == null || document.length() > 4096) return null;
        JSONObject wrapped = new JSONObject(document);
        if (wrapped.getInt("schema") != 1) return null;
        byte[] nonce = Base64.decode(wrapped.getString("nonce"), Base64.NO_WRAP);
        byte[] ciphertext = Base64.decode(wrapped.getString("ciphertext"), Base64.NO_WRAP);
        if (nonce.length != 12 || ciphertext.length < 17 || ciphertext.length > 2048) return null;
        SecretKey key = secretKey(alias, false);
        if (key == null) return null; // Reinstall/lost Keystore key: restore via Bazaar.
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, nonce));
        cipher.updateAAD(AAD);
        byte[] plain = cipher.doFinal(ciphertext); // Invalid tag = no entitlement.
        try {
            return new String(plain, StandardCharsets.UTF_8);
        } finally {
            Arrays.fill(plain, (byte) 0);
        }
    }

    /**
     * Future use ONLY inside a successful locally signature-checked Poolakey
     * getPurchasedProducts callback. Never accept ownership from JavaScript.
     */
    boolean recordVerifiedPurchase(PurchaseInfo purchase) {
        if (purchase == null
                || !BazaarBillingBridge.PACKAGE_ID.equals(purchase.getPackageName())
                || !BazaarBillingBridge.LIFETIME_SKU.equals(purchase.getProductId())
                || purchase.getPurchaseState() != PurchaseState.PURCHASED) return false;
        try {
            JSONObject record = new JSONObject();
            record.put("schema", 1);
            record.put("packageName", BazaarBillingBridge.PACKAGE_ID);
            record.put("productId", BazaarBillingBridge.LIFETIME_SKU);
            record.put("purchaseState", "PURCHASED");
            record.put("verifiedAt", System.currentTimeMillis());
            // No purchase token, receipt, account details or child identifiers.
            return app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putString(RECORD, seal(ALIAS, record.toString())).commit();
        } catch (Exception ignored) {
            return false; // Storage failure never grants an entitlement.
        }
    }

    /** Native-only local status for a future OFFLINE lesson gate; not used yet. */
    boolean isOwnedOffline() {
        try {
            String encrypted = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .getString(RECORD, null);
            String decoded = unseal(ALIAS, encrypted);
            if (decoded == null) return false;
            JSONObject record = new JSONObject(decoded);
            long at = record.getLong("verifiedAt");
            return record.getInt("schema") == 1
                    && BazaarBillingBridge.PACKAGE_ID.equals(record.getString("packageName"))
                    && BazaarBillingBridge.LIFETIME_SKU.equals(record.getString("productId"))
                    && "PURCHASED".equals(record.getString("purchaseState"))
                    && at >= MIN_TIMESTAMP
                    && at <= System.currentTimeMillis() + 86400000L;
        } catch (Exception ignored) {
            return false; // No Keystore key, tampered data, invalid tag, corrupt record.
        }
    }

    /** Future use after a successful current Bazaar query CONFIRMS no purchase. */
    boolean clearAfterConfirmedNotOwned() {
        return app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().remove(RECORD).commit();
    }

    /**
     * QA ONLY: create a separate disposable key and local encrypted sample,
     * prove it round-trips from app-private storage, then delete both.
     * No purchased flag or commercial entitlement is created or modified.
     */
    boolean disposableSelfTest() {
        SharedPreferences scratch = app.getSharedPreferences(DEMO_PREFS, Context.MODE_PRIVATE);
        try {
            scratch.edit().remove(DEMO_RECORD).commit();
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            if (store.containsAlias(DEMO_ALIAS)) store.deleteEntry(DEMO_ALIAS);
            String canary = "noncommercial_keystore_diagnostic_v1";
            String encrypted = seal(DEMO_ALIAS, canary);
            if (encrypted.contains(canary)) return false;
            if (!scratch.edit().putString(DEMO_RECORD, encrypted).commit()) return false;
            String reloaded = scratch.getString(DEMO_RECORD, null);
            return canary.equals(unseal(DEMO_ALIAS, reloaded));
        } catch (Exception ignored) {
            return false;
        } finally {
            scratch.edit().remove(DEMO_RECORD).commit();
            try {
                KeyStore store = KeyStore.getInstance("AndroidKeyStore");
                store.load(null);
                if (store.containsAlias(DEMO_ALIAS)) store.deleteEntry(DEMO_ALIAS);
            } catch (Exception ignored) {
                // Never modify the production alias or entitlement preferences.
            }
        }
    }
}
