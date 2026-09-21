import Foundation

// Not secret (unlike the device token) — just a stable local identifier so
// re-launching the app doesn't create a new pairing request every time.
enum DeviceIdentity {
    private static let key = "com.pami.mac.device-id"

    static var current: String {
        if let existing = UserDefaults.standard.string(forKey: key) {
            return existing
        }
        let id = UUID().uuidString
        UserDefaults.standard.set(id, forKey: key)
        return id
    }

    // Called when the server rejects device-pair-init because this id is
    // already registered (e.g. the local token store was cleared/lost but
    // the persisted id survived) — a fresh id lets pairing succeed again
    // instead of colliding forever.
    static func regenerate() {
        UserDefaults.standard.set(UUID().uuidString, forKey: key)
    }

    static var deviceName: String {
        Host.current().localizedName ?? "My Mac"
    }

    static var osVersion: String {
        let v = ProcessInfo.processInfo.operatingSystemVersion
        return "\(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
    }
}
