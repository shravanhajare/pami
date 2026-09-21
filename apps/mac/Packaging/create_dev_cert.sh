#!/bin/zsh
# Run this ONCE. It creates a self-signed "Code Signing" identity in your
# login keychain so PamiMac.app can be signed with the SAME identity on
# every rebuild.
#
# Why this matters: ad-hoc signing (`codesign --sign -`, the previous
# default in build_app.sh) derives the app's code identity from a hash of
# the binary itself, so every `swift build` produces a *different* identity.
# macOS's TCC (Privacy & Security) keys granted permissions — Microphone,
# Speech Recognition, Automation — off that identity, so each rebuild looks
# like a brand-new app to TCC and every permission you already granted gets
# silently forgotten, forcing the prompts to reappear. A real certificate
# (even a self-signed local one — no paid Apple Developer account needed)
# gives the app a stable identity that survives rebuilds, so grants stick
# permanently. This does not grant PamiMac any access it didn't already
# have; it just stops macOS from forgetting what you already approved.
set -euo pipefail

CERT_NAME="PamiMac Local Dev"
KEYCHAIN="${HOME}/Library/Keychains/login.keychain-db"

if security find-identity -v -p codesigning "$KEYCHAIN" 2>/dev/null | grep -q "$CERT_NAME"; then
  echo "\"$CERT_NAME\" already exists in the login keychain — nothing to do."
  exit 0
fi

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cat > "$WORKDIR/codesign.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $CERT_NAME
[ext]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
EOF

openssl req -x509 -newkey rsa:2048 -keyout "$WORKDIR/key.pem" -out "$WORKDIR/cert.pem" \
  -days 3650 -nodes -config "$WORKDIR/codesign.cnf"

openssl pkcs12 -export -out "$WORKDIR/cert.p12" \
  -inkey "$WORKDIR/key.pem" -in "$WORKDIR/cert.pem" -passout pass:pami-local-dev

echo ""
echo "Importing into the login keychain — you may see a Keychain access prompt;"
echo "approve it so codesign can use this identity without asking each time."
security import "$WORKDIR/cert.p12" -k "$KEYCHAIN" -P pami-local-dev -T /usr/bin/codesign -T /usr/bin/security

security add-trusted-cert -r trustAsRoot -p codeSign -k "$KEYCHAIN" "$WORKDIR/cert.pem"

echo ""
echo "Done. Created and trusted \"$CERT_NAME\" for code signing."
echo "Packaging/build_app.sh will now use it automatically — permission grants"
echo "(Microphone, Speech Recognition, Automation) will survive rebuilds from now on."
echo "If macOS still re-prompts for a permission you already granted the ad-hoc"
echo "build, reset that one grant so it re-registers under the new stable"
echo "identity: tccutil reset Microphone com.pami.mac (and similarly for"
echo "SpeechRecognition / AppleEvents), then grant it one last time."
