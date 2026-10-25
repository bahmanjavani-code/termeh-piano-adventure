#!/usr/bin/env bash
# Uses a disposable TEST KEY. Never publish an APK signed with this key.
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
umask 077
export TERMEH_KEYSTORE_FILE="$tmp/disposable-test-keystore.p12"
export TERMEH_KEYSTORE_PASSWORD="test-only-local-password-123456"
export TERMEH_KEY_ALIAS="termeh_test_key_not_for_release"
keytool -genkeypair -noprompt \
  -keystore "$TERMEH_KEYSTORE_FILE" -storetype PKCS12 \
  -storepass "$TERMEH_KEYSTORE_PASSWORD" \
  -alias "$TERMEH_KEY_ALIAS" \
  -keypass "$TERMEH_KEYSTORE_PASSWORD" \
  -keyalg RSA -keysize 3072 -validity 10000 \
  -dname 'CN=Disposable Test Key, O=Termeh QA, C=IR' >/dev/null 2>&1
real="$(bash tools/check-release-key.sh)"
[[ "$real" =~ ^[0-9a-f]{64}$ ]] || { echo "Fingerprint check failed"; exit 1; }
export TERMEH_RELEASE_CERT_SHA256="$real"
[[ "$(bash tools/check-release-key.sh)" == "$real" ]]
export TERMEH_RELEASE_CERT_SHA256="$(printf '0%.0s' {1..64})"
if bash tools/check-release-key.sh >/dev/null 2>&1; then
  echo 'Wrong fingerprint incorrectly accepted!' >&2
  exit 1
fi
unset TERMEH_RELEASE_CERT_SHA256
export TERMEH_KEY_ALIAS='wrong-alias'
if bash tools/check-release-key.sh >/dev/null 2>&1; then
  echo 'Wrong alias incorrectly accepted!' >&2
  exit 1
fi
echo 'PASS: signing keystore checker validates entry, fingerprint pin, and rejects mismatches.'
