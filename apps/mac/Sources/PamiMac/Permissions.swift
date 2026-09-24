import Foundation
import AppKit
import ApplicationServices
import CoreGraphics

// macOS privacy (TCC) grants the agent needs to operate the whole Mac.
// Everything PAMI spawns — Claude Code, osascript, shell commands —
// inherits PamiMac's grants (it's the "responsible process"), so these are
// granted once to PAMI itself, not to each tool.
enum Permissions {
    // macOS asks "PamiMac wants to control X" once per target app and has
    // no way for an app to pre-approve itself. This front-loads every one
    // of those dialogs into a single setup pass (instead of popping up
    // mid-request) — each is remembered forever after, as long as the app
    // keeps a stable signing identity (see Packaging/create_dev_cert.sh).
    static let automationTargets = [
        "com.apple.systemevents", "com.apple.finder", "com.apple.Safari",
        "com.google.Chrome", "company.thebrowser.Browser", "com.apple.Music",
        "com.spotify.client", "com.apple.Notes", "com.apple.reminders",
        "com.apple.iCal", "com.apple.mail", "com.apple.MobileSMS",
        "com.apple.Terminal", "com.apple.Photos", "com.apple.AddressBook",
        "com.apple.Preview", "com.apple.systempreferences", "com.apple.TextEdit",
        "com.microsoft.VSCode", "com.apple.QuickTimePlayerX",
    ]

    // Blocks while macOS shows each consent dialog, so call off the main
    // thread. Apps that weren't already running are launched hidden just
    // long enough to be asked (AppleEvent consent needs a live target),
    // then quit again.
    static func requestAllAutomation() -> (granted: Int, total: Int) {
        var granted = 0
        var total = 0
        for bundleID in automationTargets {
            guard let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else { continue }
            total += 1

            let wasRunning = !NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).isEmpty
            if !wasRunning {
                let config = NSWorkspace.OpenConfiguration()
                config.activates = false
                config.hides = true
                NSWorkspace.shared.openApplication(at: appURL, configuration: config)
                for _ in 0..<50 where NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).isEmpty {
                    Thread.sleep(forTimeInterval: 0.1)
                }
            }

            if automationStatus(for: bundleID) == noErr { granted += 1 }

            if !wasRunning {
                NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).forEach { $0.terminate() }
            }
        }
        return (granted, total)
    }

    private static func automationStatus(for bundleID: String) -> OSStatus {
        var target = AEAddressDesc()
        let bytes = Array(bundleID.utf8)
        guard AECreateDesc(DescType(typeApplicationBundleID), bytes, bytes.count, &target) == noErr else {
            return OSStatus(procNotFound)
        }
        defer { AEDisposeDesc(&target) }
        return AEDeterminePermissionToAutomateTarget(&target, AEEventClass(typeWildCard), AEEventID(typeWildCard), true)
    }

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
