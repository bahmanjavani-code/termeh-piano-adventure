package com.termeh.piano;

import android.content.Context;
import android.content.res.AssetManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * No-host, offline-first delivery of an AUTHENTICATED lesson data pack.
 *
 * Native code checks the current signed Bazaar purchase via Poolakey and
 * stores a minimal Keystore-encrypted ownership record. Only that native
 * entitlement permits this AES-GCM pack to be opened for the WebView.
 *
 * CRITICAL SECURITY LIMIT: the key is embedded in an APK for offline use,
 * so advanced attackers can reverse-engineer or patch the app. The goal is
 * to stop unmodified APK sharing (e.g. SHAREit) from granting ownership.
 * Do not claim this is unbreakable DRM or that public QA fixtures are secret.
 */
final class VerifiedPremiumLessons {
    private static final String PACK_ASSET = "premium-lessons.tpk";
    private static final String[] TREBLE_CODES =
            {"A4","B4","C5","D5","E5","F5","G5"};
    private static final String[] BASS_CODES =
            {"G2","A2","B2","C3","D3","E3","F3","G3","A3","C4"};
    private static final String[] RHYTHM_CODES =
            {"whole","half","quarter","eighth"};

    private VerifiedPremiumLessons() {}

    static boolean enabled() {
        // Previously purchased content must still restore while sales are
        // temporarily paused for merchant QA. This does NOT authorize new
        // charges: checkoutConfigured() has a separate explicit sale flag.
        return !BuildConfig.DEBUG
                && BuildConfig.PAID_PACK_STAGED
                && BuildConfig.PREMIUM_CONTENT_KEY_HEX.length() == 64
                && !BuildConfig.BAZAAR_RSA_PUBLIC_KEY.isEmpty();
    }

    static JSONObject loadOwnedContent(Context context) {
        if (!enabled() || !new OfflineLicenseVault(context).isOwnedOffline()) return null;
        byte[] key = new byte[32];
        try {
            String hex = BuildConfig.PREMIUM_CONTENT_KEY_HEX;
            if (!hex.matches("[a-fA-F0-9]{64}")) return null;
            for (int i = 0; i < key.length; ++i) {
                key[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
            }
            AssetManager assets = context.getAssets();
            JSONObject pack = PremiumPackReader.decrypt(assets.open(PACK_ASSET), key);
            if (!BazaarBillingBridge.PACKAGE_ID.equals(pack.optString("packageName"))
                    || !BazaarBillingBridge.LIFETIME_SKU.equals(pack.optString("productId"))
                    || pack.optInt("schema") != 1) return null;
            if (!exactList(pack.optJSONArray("trebleExtra"), TREBLE_CODES, "code")
                    || !exactList(pack.optJSONArray("bass"), BASS_CODES, "code")
                    || !exactList(pack.optJSONArray("durations"), RHYTHM_CODES, "id")) {
                return null;
            }
            // No executable JS is ever decrypted: JSON arrays only.
            return pack;
        } catch (Exception ignored) {
            return null; // Missing pack, wrong key, tampering, or no ownership.
        } finally {
            Arrays.fill(key, (byte) 0);
        }
    }

    private static boolean exactList(JSONArray values, String[] expected, String codeField) {
        if (values == null || values.length() != expected.length) return false;
        Set<String> allowed = new HashSet<>(Arrays.asList(expected));
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < values.length(); i++) {
            JSONObject item = values.optJSONObject(i);
            if (item == null) return false;
            String code = item.optString(codeField);
            if (!allowed.contains(code) || !seen.add(code)) return false;
            if ("code".equals(codeField)) {
                // Enforce the octave-aware keyboard and plausible piano pitches.
                if (!code.equals(item.optString("keyId"))
                        || !Double.isFinite(item.optDouble("freq"))
                        || item.optDouble("freq") < 40 || item.optDouble("freq") > 2000) {
                    return false;
                }
            } else if (!(item.optDouble("beats") > 0)
                    || item.optDouble("beats") > 4) {
                return false;
            }
        }
        return seen.size() == expected.length;
    }
}
