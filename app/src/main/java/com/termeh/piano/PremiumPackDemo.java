package com.termeh.piano;

import android.content.res.AssetManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;

/**
 * PUBLIC, NONCOMMERCIAL AES-256-GCM DEMO ONLY.
 *
 * The key below protects ONLY the dummy lesson in premium-demo-pack.json.
 * It is deliberately public in Git history and MUST NOT be reused for sale.
 * A future production key needs a separate controlled build procedure.
 */
final class PremiumPackDemo {
    private static final String PUBLIC_TEST_KEY_HEX =
            "332efb9ee9245d29452bc48e4e012c187a974db8fa7bbba6ecd605f752065e72";

    private PremiumPackDemo() { }

    static boolean verify(AssetManager assets) {
        byte[] key = new byte[32];
        try {
            for (int i = 0; i < key.length; i++) {
                key[i] = (byte) Integer.parseInt(
                        PUBLIC_TEST_KEY_HEX.substring(i * 2, i * 2 + 2), 16);
            }
            JSONObject plain = PremiumPackReader.decrypt(
                    assets.open("premium-demo-pack.json"), key);
            JSONArray lessons = plain.getJSONArray("lessons");
            return plain.optBoolean("demo", false)
                    && lessons.length() == 1
                    && "encrypted_demo_only".equals(lessons.getJSONObject(0).optString("id"));
        } catch (Exception ignored) {
            // A failed decrypt/invalid tag must NEVER yield a premium entitlement.
            return false;
        } finally {
            Arrays.fill(key, (byte) 0);
        }
    }
}
