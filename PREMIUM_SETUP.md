# Termeh Piano — one-time premium purchase (commercial implementation plan)

**Approved business model:** free download + a one-time, lifetime in-app purchase for **99,000 toman**, no subscription. The price is a proposed storefront price, not an in-app authority and not yet configured in Cafe Bazaar.

## Current 1.3.6-beta behavior
- The **debug** APK contains test-only preview fixtures for advanced treble, bass and rhythm lessons, preserving the educational beta for testing.
- The **release** APK contains only five introductory treble notes (C4–G4). The package has no paid lesson data; paid levels stay locked until future real billing, verified entitlement and encrypted content delivery are working. A signed release APK is therefore NOT ready for store publication.
- The parent hub (behind an arithmetic challenge) displays a non-interactive preview of the lifetime upgrade. The purchase/restore buttons are deliberately disabled.
- **No real billing SDK, sale, payment receipt, entitlement, or purchase restore exists yet**. Beta progress unlocks are training achievements only. The beta must not be published as a monetized production version.

## Proposed store product
- Developer-facing product ID (SKU): `termeh_premium_lifetime`.
- Type: **non-consumable / durable, one-time in-app product** — NOT a subscription and NOT consumable.
- Proposed price: **99,000 toman**, entered in the unit and format required by the Cafe Bazaar developer console; validate the storefront display.
- Description: unlock all premium piano-learning lessons after a single payment. Purchases are completed solely through the official Cafe Bazaar billing UI.
- Purchase and restore controls: **parent-only**, behind the existing parent challenge.

## Free versus premium content (proposal for public release)
- Free for all: starter note-reading in treble clef, audio exercises, selected educational rewards and a preview of note values/rhythm theory.
- After verified lifetime purchase: full advanced note banks, bass clef, rhythm quiz and hold challenges, and all premium education stages. Progress-based assessments remain instructional, not payment entitlements.
- **Do not lock existing customers out by a silent change:** finalize trial content and store description, decide preservation policy for beta progress, and notify testers before enabling premium gates.
- A parent must be able to restore a genuine purchase after reinstalling or moving devices (via the same Bazaar account) without buying again.

## Encryption groundwork (prototype; not yet enforced)

- A development-only Node.js tool `tools/secure-premium-pack.cjs` can encrypt a JSON data pack with AES-256-GCM using a fresh key that stays **outside** the APK and public repository.
- The roundtrip and tamper-resistance checks live in `tests/secure-premium-pack.test.cjs`; the build runs this test.
- The lesson definitions have been split by Android build variant: `app/src/debug/assets/premium-preview.js` contains **public test fixtures**, while `app/src/release/assets/premium-preview.js` contains no premium lessons. Neither the official Bazaar receipt verifier nor secure content-key delivery has yet been deployed. The debug fixtures and historical repo content are public and must not be treated as proprietary paid material.
- Real deployment requires the work described in [SECURE_PREMIUM_DESIGN.md](SECURE_PREMIUM_DESIGN.md), including keeping **new private** premium lessons outside the free APK, native Keystore offline activation, backend purchase verification and online restoration.

## Required implementation milestones
1. Finish creating Termeh Piano in the Cafe Bazaar developer dashboard under Android application ID `com.termeh.piano` and upload a **properly signed candidate APK**, not the current CI debug APK. Keep the permanent release keystore secure for all later updates.
2. Create the product `termeh_premium_lifetime` as a non-consumable purchase; set price and final copy. Do not create the same SKU as a consumable.
3. Read the official Cafe Bazaar Poolakey SDK documentation and integrate its pinned version into the Android app, with native parent-confirmed checkout only. The official sample has Java guidance.
4. Supply the **RSA public verification key** to the app, or use a controlled HTTPS backend with Bazaar's purchase verification API. A public key is public, but **private API/merchant keys, keystore passwords and signing secrets must stay private and never enter chat/repo**.
5. **Verify** purchase signature/token and exact package/product ID before unlocking premium; handle cancellation, pending/failed, refunds and revocations. Never unlock because JavaScript, a localStorage flag, a callback without verification, or a demo purchase button says so.
6. Query owned **non-consumable** purchases on app launch and via a restore button; DO NOT consume the lifetime product. Support offline access only to previously validated entitlements, using a defined expiry/reverification policy, so legitimate users aren't permanently stranded.
7. Gate premium content in the native/verified entitlement layer, not only HTML; keep the free experience fully usable without login; no payment UI in children's lesson screens.
8. Test with official Bazaar purchase sandbox/test accounts and real-device releases; verify first purchase, repeat purchase prevention, app upgrade, reinstall, failed payments, refunds, offline usage, canceled payments and restored purchases.
9. Update store listing and privacy policy before any real sale. Confirm children/families and local platform policy requirements.

## Why payments remain disabled in this beta
No SKU, official test purchase, proof of ownership, store-signed release APK, or suitable verified entitlement path has yet been provided. Activating a fake checkout would risk taking money without guaranteed access. The release candidate is **not** ready for public sale.

## Sources
- Official SDK: https://github.com/cafebazaar/Poolakey
- Official Java sample: https://github.com/cafebazaar/Poolakey-Sample/wiki/Java-Implementation
