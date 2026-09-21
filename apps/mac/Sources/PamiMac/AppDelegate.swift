import AppKit

// SwiftUI's own lifecycle hooks (reading @StateObject in init(), .task on a
// MenuBarExtra label) both proved unreliable for starting a one-time
// background loop in this Scene type — applicationDidFinishLaunching is
// AppKit's own guaranteed "the app has launched" signal, independent of
// whatever SwiftUI's internal view-diffing decides to do. Both this and the
// SwiftUI view tree reference the same static singletons (AppState.shared,
// HeartbeatLoop.shared), so there's no risk of them diverging.
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Foundation.Notification) {
        Task { await HeartbeatLoop.shared.start(appState: AppState.shared) }
    }
}
