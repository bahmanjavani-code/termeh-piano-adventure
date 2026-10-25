#!/usr/bin/env bash
# Verify the *developer-owned* release keystore without printing any secrets.
# Required: TERMEH_KEYSTORE_FILE, TERMEH_KEYSTORE_PASSWORD, TERMEH_KEY_ALIAS.
# Optional: TERMEH_RELEASE_CERT_SHA256 (expected public certificate fingerprint).
# Output: only the public SHA-256 fingerprint on stdout.
set -euo pipefail
: "${TERMEH_KEYSTORE_FILE:?Missing TERMEH_KEYSTORE_FILE}"
: "${TERMEH_KEYSTORE_PASSWORD:?Missing TERMEH_KEYSTORE_PASSWORD}"
: "${TERMEH_KEY_ALIAS:?Missing TERMEH_KEY_ALIAS}"
test -s "$TERMEH_KEYSTORE_FILE" || { echo 'Signing keystore not found' >&2; exit 1; }
command -v keytool >/dev/null || { echo 'JDK keytool is unavailable' >&2; exit 1; }
command -v sha256sum >/dev/null || { echo 'sha256sum is unavailable' >&2; exit 1; }
# The keystore MUST have a private-key entry rather than just an imported certificate.
detail="$(keytool -list -alias "$TERMEH_KEY_ALIAS" -keystore "$TERMEH_KEYSTORE_FILE" -storepass "$TERMEH_KEYSTORE_PASSWORD" 2>&1)" ||
  { echo 'Keystore password or alias invalid' >&2; exit 1; }
if ! grep -q 'PrivateKeyEntry' <<< "$detail"; then
  echo 'Selected alias is not a signing private-key entry' >&2
  exit 1
fi
# A DER certificate is public. Its SHA-256 fingerprint must be stable across updates.
fingerprint="$(keytool -exportcert -alias "$TERMEH_KEY_ALIAS" -keystore "$TERMEH_KEYSTORE_FILE" -storepass "$TERMEH_KEYSTORE_PASSWORD" | sha256sum | awk '{print $1}')"
if ! [[ "$fingerprint" =~ ^[0-9a-f]{64}$ ]]; then
  echo 'Invalid release certificate SHA-256 fingerprint' >&2
  exit 1
fi
expected="${TERMEH_RELEASE_CERT_SHA256:-}"
expected="$(printf '%s' "$expected" | tr 'A-F' 'a-f' | tr -d ':[:space:]')"
if [[ -n "$expected" && "$expected" != "$fingerprint" ]]; then
  echo 'Release signing certificate changed: STOP! Check the backup of the ORIGINAL keystore.' >&2
  exit 1
fi
printf '%s\n' "$fingerprint"
