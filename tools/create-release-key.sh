#!/usr/bin/env bash
# Developer-operated OFFLINE signing-key generation. Never run in CI or commit the key.
# Run in your own terminal (PC or Termux), and retain encrypted offline backups.
set -euo pipefail
if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  echo 'Refusing to generate a permanent release key on a temporary CI runner.' >&2
  exit 1
fi
if [[ ! -t 0 ]]; then
  echo 'A local interactive terminal is required to enter your own secret password.' >&2
  exit 1
fi
command -v keytool >/dev/null || { echo 'Install a Java JDK (keytool) first.' >&2; exit 1; }
umask 077
destination="$HOME/termeh-signing"
keystore="$destination/termeh-release.jks"
alias_name="termeh_piano_release"
mkdir -p "$destination"
chmod 700 "$destination"
if [[ -e "$keystore" ]]; then
  echo 'Existing permanent signing key found. NEVER overwrite it; use the original for updates.' >&2
  exit 1
fi
echo 'A new private app-signing key is about to be created on YOUR device.'
echo 'Choose a long password; store it privately. Do NOT paste it into a chat or Git repository.'
echo 'When prompted to enter key password, reuse the store password (PKCS12).'
keytool -genkeypair \
  -keystore "$keystore" -storetype PKCS12 \
  -alias "$alias_name" -keyalg RSA -keysize 3072 -validity 12000 \
  -dname "CN=Termeh Piano, O=Termeh Piano, C=IR"
chmod 600 "$keystore"
echo
echo 'Signing key successfully generated on this device.'
echo "Private file: $keystore"
echo "Alias: $alias_name"
echo 'Save TWO secure/offline backups of the .jks file and record its password securely.'
echo 'To see the PUBLIC SHA-256 fingerprint (no private key disclosure):'
echo "  keytool -list -v -keystore '$keystore' -alias '$alias_name'"
echo 'To create a temporary Base64 representation for the GitHub secret:'
echo "  base64 -w 0 '$keystore' > '$destination/keystore-base64-DELETE-AFTER-UPLOAD.txt'"
echo 'The base64 file is JUST AS SECRET as the keystore: delete it immediately after upload.'
