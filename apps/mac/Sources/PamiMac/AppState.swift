import Foundation
import SwiftUI

enum ConnectionState: Equatable {
    case notPaired
    case pairing(code: String)
    case connected
    case reconnecting
}

@MainActor
final class AppState: ObservableObject {
    // A single process-wide instance, referenced identically by both the
    // SwiftUI view tree and AppDelegate — see AppDelegate.swift for why:
    // SwiftUI's @StateObject/.task lifecycle timing inside a MenuBarExtra
    // scene proved unreliable for reliably starting a one-time background
    // loop, so that's driven from AppKit's applicationDidFinishLaunching
    // instead, and both sides need to agree on which instance is "the" one.
    static let shared = AppState()

    @Published var connectionState: ConnectionState = .notPaired
    @Published var currentTask: PamiTask?
    @Published var isPaused = false
    @Published var isListening = false
    @Published var isWakeWordActive = false
    @Published var voiceStatus: String?

    // Persisted across launches, unlike the other toggles above — this is
    // a standing preference ("always speak responses"), not a per-session
    // mode.
    @Published var voiceResponsesEnabled: Bool = UserDefaults.standard.bool(forKey: "voiceResponsesEnabled") {
        didSet {
            UserDefaults.standard.set(voiceResponsesEnabled, forKey: "voiceResponsesEnabled")
        }
    }

    var deviceToken: String? {
        Keychain.loadDeviceToken()
    }

    var statusIcon: String {
        switch connectionState {
        case .notPaired, .reconnecting: return "circle.dotted"
        case .pairing: return "circle.dashed"
        case .connected: return isPaused ? "pause.circle" : "circle.fill"
        }
    }

    var statusLabel: String {
        switch connectionState {
        case .notPaired: return "Not paired"
        case .pairing(let code): return "Pairing: \(code)"
        case .reconnecting: return "Offline — reconnecting…"
        case .connected: return isPaused ? "Paused" : "Connected"
        }
    }

    func apply(_ result: HeartbeatResponse) {
        if result.status == "pending" {
            // The server may mint a fresh code if the previous one expired
            // before the user got to it — always reflect what it returns.
            if let code = result.pairing_code {
                connectionState = .pairing(code: code)
            }
            return
        }
        connectionState = .connected
        currentTask = result.tasks.first
    }
}
