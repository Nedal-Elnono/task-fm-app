#!/usr/bin/env bash
# Builds the Mac App Store .pkg (universal, sandboxed, no self-updater).
#
# Prerequisites:
#   - embedded.provisionprofile (Mac App Store profile for com.taskfm.app)
#     placed at the repo root — download from developer.apple.com
#   - Apple Distribution + 3rd Party Mac Developer Installer certs in keychain
#
# Usage: scripts/build-mas.sh

set -euo pipefail
cd "$(dirname "$0")/.."

PROFILE="embedded.provisionprofile"
DIST_ID="Apple Distribution: nedal adnan (V52X6SMZT6)"
INSTALLER_ID="3rd Party Mac Developer Installer: nedal adnan (V52X6SMZT6)"
VERSION=$(node -p "require('./package.json').version")

[ -f "$PROFILE" ] || { echo "✗ Missing $PROFILE (Mac App Store provisioning profile)"; exit 1; }

echo "→ Building universal MAS app (no updater, sandboxed)…"
export APPLE_SIGNING_IDENTITY="$DIST_ID"
npm run tauri build -- \
  --target universal-apple-darwin \
  --bundles app \
  --features mas \
  --config '{"bundle":{"createUpdaterArtifacts":false,"macOS":{"entitlements":"Entitlements.mas.plist"}}}'

APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/TASK FM.app"

echo "→ Embedding provisioning profile…"
cp "$PROFILE" "$APP/Contents/embedded.provisionprofile"

echo "→ Stripping extended attributes (quarantine flags are rejected by App Store)…"
xattr -cr "$APP"

echo "→ Re-signing with entitlements (profile changed the bundle)…"
codesign --force --options runtime \
  --entitlements src-tauri/Entitlements.mas.plist \
  --sign "$DIST_ID" "$APP"

echo "→ Building signed pkg…"
productbuild --component "$APP" /Applications \
  --sign "$INSTALLER_ID" \
  "TASK-FM-$VERSION-mas.pkg"

echo "✓ Done: TASK-FM-$VERSION-mas.pkg"
echo "  Upload with Transporter, or:"
echo "  xcrun altool --upload-app -f TASK-FM-$VERSION-mas.pkg -t macos -u <apple-id> -p <app-specific-password>"
