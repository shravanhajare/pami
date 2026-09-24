import Foundation
import AppKit
import ApplicationServices
import CoreGraphics

// macOS privacy (TCC) grants the agent needs to operate the whole Mac.
// Everything PAMI spawns — Claude Code, osascript, shell commands —
// inherits PamiMac's grants (it's the "responsible process"), so these are
// granted once to PAMI itself, not to each tool.
enum Permissions {
    enum Kind: CaseIterable {
        case accessibility, fullDiskAccess, screenRecording, automation

        var title: String {
            switch self {
            case .accessibility: return "Accessibility (clicks & keystrokes)"
            case .fullDiskAccess: return "Full Disk Access (all files)"
            case .screenRecording: return "Screen Recording (screenshots)"
            case .automation: return "Automation (control other apps)"
            }
        }

        private var pane: String {
            switch self {
            case .accessibility: return "Privacy_Accessibility"
            case .fullDiskAccess: return "Privacy_AllFiles"
            case .screenRecording: return "Privacy_ScreenCapture"
            case .automation: return "Privacy_Automation"
            }
        }

        // nil = macOS offers no way to check (Automation is per target app
        // and prompts on first use).
        var isGranted: Bool? {
            switch self {
            case .accessibility: return AXIsProcessTrusted()
            case .screenRecording: return CGPreflightScreenCaptureAccess()
            case .fullDiskAccess:
                // No public API — probe a file that's only readable with FDA.
                let probe = FileManager.default.homeDirectoryForCurrentUser
                    .appendingPathComponent("Library/Safari/Bookmarks.plist")
                return FileManager.default.isReadableFile(atPath: probe.path)
                    && (try? Data(contentsOf: probe)) != nil
            case .automation: return nil
            }
        }

        func request() {
            switch self {
            case .accessibility:
                let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
                _ = AXIsProcessTrustedWithOptions([key: true] as CFDictionary)
            case .screenRecording:
                _ = CGRequestScreenCaptureAccess()
            default:
                break
            }
            if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)") {
                NSWorkspace.shared.open(url)
            }
        }
    }
}
