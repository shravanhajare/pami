import Foundation

// Stores the opaque device token issued at pairing time.
//
// This intentionally uses a permissions-locked file (0600, only this user
// account can read it) instead of the macOS Keychain. The reason is
// practical, not a security downgrade in principle: ad-hoc code signing
// (`codesign -s -`, used because this app is built without Xcode — see
// Packaging/build_app.sh) produces a *different* signing identity on every
// rebuild, and the Keychain ACL on a saved item is bound to the identity
// that created it. During active development that means every single
// rebuild makes macOS pop a blocking "PamiMac wants to access your
// keychain" prompt on next launch — and if nothing is available to click
// it, the app hangs forever inside SecItemCopyMatching. A local file has no
// such ACL-vs-signature coupling.
//
// TODO: once this app has a stable signing identity (a real Developer ID,
// relevant if it's ever distributed rather than just run locally), switch
// this back to Keychain storage — the code it replaced is straightforward
// SecItemAdd/SecItemCopyMatching/SecItemDelete and can be restored from
// version control history.
enum Keychain {
    private static let directory: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("PamiMac", isDirectory: true)
    }()

    private static let fileURL = directory.appendingPathComponent("device-token")

    static func saveDeviceToken(_ token: String) {
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        FileManager.default.createFile(atPath: fileURL.path, contents: Data(token.utf8))
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: fileURL.path)
    }

    static func loadDeviceToken() -> String? {
        guard let data = FileManager.default.contents(atPath: fileURL.path) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func clearDeviceToken() {
        try? FileManager.default.removeItem(at: fileURL)
    }
}
