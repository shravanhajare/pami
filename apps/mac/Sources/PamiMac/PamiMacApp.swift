import SwiftUI

@main
struct PamiMacApp: App {
    @ObservedObject private var appState = AppState.shared
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        setbuf(stdout, nil) // unbuffered: otherwise print() output sits in a buffer and never reaches a redirected log file, which makes debugging via `PamiMac > out.log 2>&1` misleading
        LoginItem.register()
    }

    var body: some Scene {
        MenuBarExtra {
            MenuContent(heartbeatLoop: HeartbeatLoop.shared)
                .environmentObject(appState)
        } label: {
            Image(systemName: appState.statusIcon)
        }
        .menuBarExtraStyle(.menu)
    }
}
