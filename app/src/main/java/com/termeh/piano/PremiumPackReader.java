package com.termeh.piano;

import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Native-only authenticated JSON data-pack decoder.
 *
 * This has NO JavaScript interface, purchase status, embedded commercial key,
 * file-write operation or checkout path. A future billing entitlement controller
 * must supply the key ONLY after an appropriate Bazaar ownership verification.
 *
 * AES-GCM protects against tampering. In the chosen no-host architecture a
 * production key embedded in the APK could still be extracted by reverse engineers.
 */
final class PremiumPackReader {
    private static final int MAX_PLAINTEXT_BYTES = 2 * 1024 * 1024;
    private static final int MAX_ENVELOPE_BYTES = 3 * 1024 * 1024;
    private static final byte[] AAD = (
            BazaarBillingBridge.PACKAGE_ID + "|"
            + BazaarBillingBridge.LIFETIME_SKU + "|TPK1"
    ).getBytes(StandardCharsets.UTF_8);

    private PremiumPackReader() { }

    static JSONObject decrypt(InputStream stream, byte[] aesKey) throws Exception {
        if (aesKey == null || aesKey.length != 32) {
            throw new GeneralSecurityException("Invalid AES-256 key");
        }
        JSONObject pack = new JSONObject(new String(readLimited(stream), StandardCharsets.UTF_8));
        if (!"TPK1".equals(pack.getString("format"))
                || !BazaarBillingBridge.PACKAGE_ID.equals(pack.getString("packageName"))
                || !BazaarBillingBridge.LIFETIME_SKU.equals(pack.getString("productId"))) {
            throw new GeneralSecurityException("Wrong pack identity");
        }

        byte[] nonce = Base64.decode(pack.getString("nonce"), Base64.DEFAULT);
        byte[] tag = Base64.decode(pack.getString("tag"), Base64.DEFAULT);
        byte[] ciphertext = Base64.decode(pack.getString("ciphertext"), Base64.DEFAULT);
        if (nonce.length != 12 || tag.length != 16
                || ciphertext.length == 0 || ciphertext.length > MAX_PLAINTEXT_BYTES + 16) {
            throw new GeneralSecurityException("Malformed encrypted content");
        }
        byte[] ciphertextWithTag = Arrays.copyOf(ciphertext, ciphertext.length + tag.length);
        System.arraycopy(tag, 0, ciphertextWithTag, ciphertext.length, tag.length);

        byte[] plaintext = null;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(aesKey, "AES"),
                    new GCMParameterSpec(128, nonce));
            cipher.updateAAD(AAD);
            plaintext = cipher.doFinal(ciphertextWithTag); // Reject any tampered content.
            if (plaintext.length == 0 || plaintext.length > MAX_PLAINTEXT_BYTES) {
                throw new GeneralSecurityException("Invalid content size");
            }
            JSONObject lessons = new JSONObject(new String(plaintext, StandardCharsets.UTF_8));
            if (lessons.optInt("schema", -1) != 1
                    || !BazaarBillingBridge.LIFETIME_SKU.equals(lessons.optString("productId"))) {
                throw new GeneralSecurityException("Wrong lesson schema or product");
            }
            // JSON is DATA, never executable JavaScript.
            return lessons;
        } finally {
            if (plaintext != null) Arrays.fill(plaintext, (byte) 0);
            Arrays.fill(ciphertextWithTag, (byte) 0);
        }
    }

    private static byte[] readLimited(InputStream source) throws Exception {
        try (InputStream input = source; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (out.size() + count > MAX_ENVELOPE_BYTES) {
                    throw new GeneralSecurityException("Pack exceeds size limit");
                }
                out.write(buffer, 0, count);
            }
            return out.toByteArray();
        }
    }
}
