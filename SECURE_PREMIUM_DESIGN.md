# Secure premium content: architecture and implementation boundary

Status: **design + isolated developer encryption prototype only**, NOT a working purchase system. Current beta still bundles existing treble, bass and rhythm code and lesson data in `app/src/main/assets/index.html`. The application is **not yet protected against repackaging**. The new tooling below is intentionally **not invoked by the Android app**.

## Product requirements

- Free Android app distributed on Cafe Bazaar. Public SKU: `termeh_premium_lifetime`, lifetime non-consumable in-app product. Planned price 99,000 toman.
- All children can use introductory lessons without account or continuous Internet.
- Purchases, verification and downloading a protected premium content pack happen **only in the parent section**, requiring Internet for initial activation.
- After successful activation, premium content remains playable offline; a fresh device/reinstall restores ownership with the Bazaar account when online. A purchase must never be paid again on the same Bazaar account to restore access.
- No login, GPS, microphone, camera, device tracking ID, advertising SDK or forced background networking is needed for lessons.
- Update checks and purchase ownership rechecks must not make free learning unusable when offline.

## Security model: deliver CONTENT, not an installable APK

1. **Split content:** free APK contains game engine and intro lessons only; unique advanced note banks, rhythm lessons and premium content live outside the distributed free APK. Move them out of `index.html` as **data**, not untrusted executable JavaScript. Existing beta code does *not* yet satisfy this condition.
2. **Prepare pack:** encrypt the private JSON lesson pack using a fresh 256-bit AES key in **AES-256-GCM**. Use a unique 96-bit nonce. Authenticate package name, SKU and pack format as additional authenticated data. The encrypted `.tpk` can be placed on a CDN.
3. **Parent buys:** the Android-native host calls Bazaar's official Poolakey billing flow for the non-consumable SKU. Do not consume the purchase. Never rely on WebView JavaScript/localStorage to claim a paid entitlement.
4. **Server verifies:** client sends the purchase token through an HTTPS connection to a backend. The backend uses Bazaar's purchase-verification API, verifies ownership status, package name and product ID, checks refunds or cancellation, applies anti-replay/abuse controls and stores any private API credentials exclusively on the backend.
5. **Device-bound activation:** Android creates a non-exportable asymmetric key pair in **Android Keystore** and supplies the *public key* during purchase verification. After verifying the Bazaar receipt, the server delivers an authenticated pack download and a copy of the AES content key **wrapped specifically for that device public key** (for example RSA-OAEP with SHA-256). Never hard-code the content key inside the free APK; keep raw keys, payment credentials and private server signing keys out of Git, logs and telemetry.
6. **Device caches offline:** store the encrypted premium pack and the *wrapped* content key in private app storage. Use the Android Keystore *private key* to unwrap the content key only when needed; decrypt the pack into memory and validate GCM integrity. Do not expose the raw content key or decrypted lesson data as a general-purpose JavaScript bridge. A copied license/cache alone should not unlock another phone without its non-exportable private key. Where hardware-backed Keystore is unavailable, security will be weaker.
7. **Restore:** after uninstall/reinstall or switching phones, the original Keystore key will not automatically restore. The app reconnects to Bazaar/backend to verify the same lifetime purchase and securely re-downloads/re-enables the pack; this is NOT a second purchase.
8. **Recheck ownership:** verify ownership on next available legitimate network opportunity; define a proportional refund/revocation strategy. Offline operation necessarily delays observing refunds or revocations, and cannot guarantee immediate revocation.
9. **Release only after testing:** verify paid content is absent from the APK and from any public site/repo, purchase cannot be faked using local flags, wrong product/account doesn't unlock, modified/tampered pack fails, key isn't shared with unpurchased devices, and backup/restore works on real phones.

### Why no separate installer?

Uploading a second APK or downloading executable code raises security, trust, store-policy, versioning and installation issues. A **small encrypted JSON/data pack** is easier for a native WebView app to read and does not require granting unknown-app installation permissions. A single persistent **encryption key inside every APK is NOT secure**: it can be extracted and circulated. The key must first come from a verified transaction.

### Cryptographic licenses vs encrypted packs

- Signed offline entitlement (server Ed25519/RSA private key only on backend, verification public key in app) prevents *simple* local flag edits but does **not** hide premium code/data already included in a free APK.
- Encrypted pack **absent from free APK**, with its AES content key delivered only after a verified purchase, adds meaningful friction because patching a boolean does not provide missing premium content.
- Android Keystore protects stored keys at rest but cannot stop a sufficiently privileged attacker observing plaintext in a running app. Modified APKs and rooted devices can eventually bypass local gating; there is no 100% unmodifiable offline app.
- Developers must keep the *app signing key* stable across versions. It is different from the *content encryption key* and the *server receipt-verification credentials*.

## Developer-only pack encryption prototype

The repository includes `tools/secure-premium-pack.cjs`; it uses Node.js built-in crypto, and is **not packaged in the Android APK**:

```sh
# Example: private input file and key file MUST NOT be added to Git.
node tools/secure-premium-pack.cjs seal premium_private/lessons.json premium_private/lessons.tpk premium_private/lessons.key
# For development testing only:
node tools/secure-premium-pack.cjs open premium_private/lessons.tpk premium_private/lessons.key premium_private/restored.json

node tests/secure-premium-pack.test.cjs
```

The CLI outputs a random content key to a mode-0600 file and writes an encrypted pack. **This is not a license, does not call Bazaar and does not authenticate purchasers.** Keep production keys in a proper secrets manager and preferably generate them under backend control. Its purpose is to validate pack format and rejection of tampering before a server exists. The test creates temporary private sample content and destroys it afterward.

## What is still missing before charging customers

- Bazaar app registration, published signing identity and real permanent product SKU.
- Real Poolakey integration and verified purchase/restore testing on Android.
- Backend API with purchase verification, encrypted pack delivery and key management.
- Extract actual premium content from `index.html` into a private pack; ensure free APK contains no premium assets.
- Android Keystore key wrapping, validated offline pack loading and native entitlement bridge.
- QA for offline return, fresh installs, refunds, lost devices, reinstall, and in-app privacy.
- Clear privacy/store policy and support commitments.

Do not change the currently functional beta's lesson locks to paid-only until **all the above** are working and a genuinely tested restore path is available.

References:
- https://github.com/cafebazaar/Poolakey
- https://developer.android.com/privacy-and-security/cryptography
- https://developer.android.com/privacy-and-security/security-tips
