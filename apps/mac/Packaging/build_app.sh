#!/bin/zsh
# Builds PamiMac without Xcode: SPM executable -> hand-assembled .app bundle
# -> codesign. Prefers the stable local identity from create_dev_cert.sh
# (run that once first) over ad-hoc signing — ad-hoc signs re-hash on every
# rebuild, which makes macOS treat each build as a new app and re-prompt for
# Microphone/Speech/Automation access it already granted. Neither is
# suitable for distribution outside this machine.
set -euo pipefail
cd "$(dirname "$0")/.."

swift build -c release

APP="dist/PamiMac.app"
rm -rf dist
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp ".build/release/PamiMac" "$APP/Contents/MacOS/PamiMac"
cp "Packaging/Info.plist" "$APP/Contents/Info.plist"

CERT_NAME="PamiMac Local Dev"
if security find-identity -v -p codesigning 2>/dev/null | grep -q "$CERT_NAME"; then
  SIGN_IDENTITY="$CERT_NAME"
else
  SIGN_IDENTITY="-"
  echo ""
  echo "No stable local signing identity found — falling back to ad-hoc signing."
  echo "This means macOS will likely re-prompt for Microphone/Speech/Automation"
  echo "access on every rebuild. Run ./Packaging/create_dev_cert.sh once to fix"
  echo "this permanently."
  echo ""
fi

codesign --force --deep --sign "$SIGN_IDENTITY" --identifier com.pami.mac "$APP"
codesign --verify --verbose "$APP"

echo ""
echo "Built $APP"
echo "Copy to /Applications for reliable login-item registration:"
echo "  cp -R $APP /Applications/"
