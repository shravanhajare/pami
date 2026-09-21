#!/bin/zsh
# Builds PamiMac without Xcode: SPM executable -> hand-assembled .app bundle
# -> ad-hoc codesign. Ad-hoc signing is sufficient for SMAppService login-item
# registration and running locally; it is not suitable for distribution.
set -euo pipefail
cd "$(dirname "$0")/.."

swift build -c release

APP="dist/PamiMac.app"
rm -rf dist
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp ".build/release/PamiMac" "$APP/Contents/MacOS/PamiMac"
cp "Packaging/Info.plist" "$APP/Contents/Info.plist"

codesign --force --deep --sign - "$APP"
codesign --verify --verbose "$APP"

echo ""
echo "Built $APP"
echo "Copy to /Applications for reliable login-item registration:"
echo "  cp -R $APP /Applications/"
