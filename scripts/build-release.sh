#!/usr/bin/env bash
# Builds a signed + notarized universal macOS release.
#
# Pins the updater signing key explicitly: the key that matches the pubkey
# baked into every shipped build lives in ~/taskfm-signing/updater.key.
# (~/.tauri/taskfm.key is an unrelated orphan key from the v0.0.1 era — using
# it would produce updates that every installed client rejects.)
#
# Requires the Apple app-specific password in ~/taskfm-signing/.notary-password
# so it never has to be passed on the command line.
#
# Usage: scripts/build-release.sh

set -euo pipefail

UPDATER_KEY="$HOME/taskfm-signing/updater.key"
NOTARY_PASSWORD_FILE="$HOME/taskfm-signing/.notary-password"

[ -f "$UPDATER_KEY" ] || { echo "✗ Missing updater key: $UPDATER_KEY"; exit 1; }
[ -f "$NOTARY_PASSWORD_FILE" ] || { echo "✗ Missing notary password: $NOTARY_PASSWORD_FILE"; exit 1; }

# Fail loudly if the key on disk is not the one the shipped apps trust.
EXPECTED_PUBKEY_ID="F09BDF6E0AC712F"
ACTUAL_PUBKEY_ID=$(base64 -d < "$UPDATER_KEY.pub" | sed -n 's/.*minisign public key: //p')
if [ "$ACTUAL_PUBKEY_ID" != "$EXPECTED_PUBKEY_ID" ]; then
  echo "✗ Updater key mismatch: expected $EXPECTED_PUBKEY_ID, got $ACTUAL_PUBKEY_ID"
  echo "  Signing with this key would break auto-update for every existing user."
  exit 1
fi

export TAURI_SIGNING_PRIVATE_KEY="$(cat "$UPDATER_KEY")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

# Developer ID signing + notarization (Tauri signs, notarizes and staples).
export APPLE_SIGNING_IDENTITY="Developer ID Application: nedal adnan (V52X6SMZT6)"
export APPLE_ID="nedalnasser150@gmail.com"
export APPLE_TEAM_ID="V52X6SMZT6"
export APPLE_PASSWORD="$(cat "$NOTARY_PASSWORD_FILE")"

echo "→ Building universal release (this takes a while)…"
npm run tauri -- build --target universal-apple-darwin

# Tauri notarizes and staples the .app, then builds the DMG from it — but it
# only *signs* the DMG, it never notarizes the container itself. Do that here,
# otherwise Gatekeeper reports the download as "Unnotarized Developer ID".
DMG=$(ls src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg | head -1)
echo "→ Notarizing DMG: $DMG"
xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD" --wait
xcrun stapler staple "$DMG"

echo "✓ Done. Verify with: spctl -a -vvv -t open --context context:primary-signature \"$DMG\""
