import Foundation
import AppKit

// Broader "control my Mac from my phone" actions — new task types that
// route through the exact same task+heartbeat pipeline as everything else
// in HeartbeatLoop.execute(), not a separate remote-control surface. Kept
// to the same trust tier as MacIntegrations.swift: no dashboard approval
// needed (per the user's own explicit choice not to weaken that gate), but
// AppleScript-driven actions (music) still trigger macOS's normal one-time
// Automation permission prompt per app, same as Notes/Reminders/Calendar.
enum MacControl {
    struct ActionError: Error {
        let message: String
    }

    // MARK: - Screen lock

    // The old CGSession -suspend binary is gone on current macOS. The
    // private login.framework SACLockScreenImmediate is what the  menu's
    // "Lock Screen" item calls today; fall back to the Ctrl-Cmd-Q shortcut
    // via System Events (needs Accessibility) if the symbol ever moves.
    static func lockScreen() throws -> String {
        let path = "/System/Library/PrivateFrameworks/login.framework/Versions/Current/login"
        if let handle = dlopen(path, RTLD_NOW), let symbol = dlsym(handle, "SACLockScreenImmediate") {
            typealias LockFn = @convention(c) () -> Int32
            let lock = unsafeBitCast(symbol, to: LockFn.self)
            _ = lock()
            return "Locked the screen."
        }
        _ = try runAppleScript(#"tell application "System Events" to keystroke "q" using {control down, command down}"#)
        return "Locked the screen."
    }

    // MARK: - Power

    static func sleepDisplay() async throws -> String {
        _ = try await ProcessRunner.run(executable: "/usr/bin/pmset", arguments: ["displaysleepnow"])
        return "Turned off the display."
    }

    static func sleepMac() async throws -> String {
        // Delayed so the task can be acked as completed before the Mac
        // actually drops off the network.
        Task.detached {
            try? await Task.sleep(for: .seconds(3))
            _ = try? await ProcessRunner.run(executable: "/usr/bin/pmset", arguments: ["sleepnow"])
        }
        return "Putting your Mac to sleep."
    }

    // MARK: - Volume

    // Plain top-level Standard Additions commands, not a `tell application`
    // block — these don't trigger an Automation permission prompt.
    static func getVolume() throws -> String {
        let result = try runAppleScript("output volume of (get volume settings)")
        return "Volume is at \(result)%."
    }

    static func currentVolume() throws -> Int {
        Int(try runAppleScript("output volume of (get volume settings)")) ?? 50
    }

    static func adjustVolume(by delta: Int) throws -> String {
        try setVolume(currentVolume() + delta)
    }

    static func setMuted(_ muted: Bool) throws -> String {
        _ = try runAppleScript("set volume output muted \(muted)")
        return muted ? "Muted." : "Unmuted."
    }

    static func setVolume(_ percent: Int) throws -> String {
        let clamped = max(0, min(100, percent))
        _ = try runAppleScript("set volume output volume \(clamped)")
        return "Volume set to \(clamped)%."
    }

    // MARK: - Music

    // Spotify if it's running (most people who have it open are using it),
    // otherwise Apple Music — both expose the same AppleScript verbs.
    private static var musicPlayer: String {
        let spotifyRunning = NSWorkspace.shared.runningApplications.contains {
            $0.bundleIdentifier == "com.spotify.client"
        }
        return spotifyRunning ? "Spotify" : "Music"
    }

    static func musicControl(action: String) throws -> String {
        let player = musicPlayer
        let normalized = action.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch normalized {
        case "play":
            _ = try runAppleScript("tell application \"\(player)\" to play")
            return "Playing."
        case "pause":
            _ = try runAppleScript("tell application \"\(player)\" to pause")
            return "Paused."
        case "toggle", "playpause":
            _ = try runAppleScript("tell application \"\(player)\" to playpause")
            return "Done."
        case "next":
            _ = try runAppleScript("tell application \"\(player)\" to next track")
            return try nowPlaying(prefix: "Skipped to", player: player)
        case "previous":
            _ = try runAppleScript("tell application \"\(player)\" to previous track")
            return try nowPlaying(prefix: "Back to", player: player)
        case "now_playing", "now playing", "":
            return try nowPlaying(prefix: "Now playing:", player: player)
        default:
            throw ActionError(message: "Unrecognized music action \"\(action)\".")
        }
    }

    private static func nowPlaying(prefix: String, player: String) throws -> String {
        let script = """
        tell application "\(player)"
            if player state is stopped then return "nothing"
            return (name of current track) & " by " & (artist of current track)
        end tell
        """
        let result = try runAppleScript(script)
        return result == "nothing" ? "Nothing is playing." : "\(prefix) \(result)"
    }

    // MARK: - Clipboard

    // NSPasteboard is a normal in-process API — no AppleEvents, no
    // permission prompt of any kind.
    static func clipboardGet() -> String {
        guard let text = NSPasteboard.general.string(forType: .string), !text.isEmpty else {
            return "Clipboard is empty (or isn't plain text)."
        }
        let preview = text.count > 500 ? String(text.prefix(500)) + "…" : text
        return preview
    }

    static func clipboardSet(_ text: String) -> String {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
        return "Copied to clipboard."
    }

    // MARK: - App control

    // NSRunningApplication is a normal API too — quitting an app you
    // launched yourself needs no special permission.
    static func quitApp(named name: String) throws -> String {
        let running = NSWorkspace.shared.runningApplications.filter {
            $0.localizedName?.caseInsensitiveCompare(name) == .orderedSame
        }
        guard !running.isEmpty else {
            throw ActionError(message: "\(name) doesn't appear to be running.")
        }
        for app in running {
            app.terminate()
        }
        return "Quit \(name)."
    }

    // MARK: - Appearance

    static func setDarkMode(_ enabled: Bool?) throws -> String {
        let value = enabled.map { $0 ? "true" : "false" } ?? "not dark mode"
        let result = try runAppleScript("""
        tell application "System Events" to tell appearance preferences
            set dark mode to \(value)
            return dark mode
        end tell
        """)
        return result == "true" ? "Dark mode is on." : "Light mode is on."
    }

    // MARK: - Screenshot

    static func screenshot() async throws -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd 'at' HH.mm.ss"
        let desktop = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Desktop")
        let file = desktop.appendingPathComponent("Screenshot \(formatter.string(from: Date())).png")
        _ = try await ProcessRunner.run(executable: "/usr/sbin/screencapture", arguments: ["-x", file.path])
        return "Saved a screenshot to your Desktop."
    }

    // MARK: - Wi-Fi

    static func setWiFi(_ on: Bool) async throws -> String {
        let ports = try await ProcessRunner.run(executable: "/usr/sbin/networksetup", arguments: ["-listallhardwareports"])
        // "Hardware Port: Wi-Fi\nDevice: en0\n..."
        let lines = ports.split(separator: "\n").map(String.init)
        guard let index = lines.firstIndex(where: { $0.contains("Wi-Fi") || $0.contains("AirPort") }),
              index + 1 < lines.count,
              let device = lines[index + 1].split(separator: ":").last?.trimmingCharacters(in: .whitespaces)
        else {
            throw ActionError(message: "Couldn't find a Wi-Fi interface.")
        }
        _ = try await ProcessRunner.run(executable: "/usr/sbin/networksetup", arguments: ["-setairportpower", device, on ? "on" : "off"])
        return on ? "Wi-Fi is on." : "Wi-Fi is off."
    }

    // MARK: - URLs

    static func open(url: URL) throws -> String {
        guard NSWorkspace.shared.open(url) else {
            throw ActionError(message: "Couldn't open \(url.absoluteString).")
        }
        return "Opened \(url.host ?? url.lastPathComponent)."
    }

    // MARK: - Battery / system status

    static func batteryStatus() async throws -> String {
        let output = try await ProcessRunner.run(executable: "/usr/bin/pmset", arguments: ["-g", "batt"])
        // Typical line: "-InternalBattery-0 (id=...)   87%; discharging; 3:12 remaining"
        guard let line = output.split(separator: "\n").first(where: { $0.contains("%") }) else {
            return "Couldn't read battery status."
        }
        return line.trimmingCharacters(in: .whitespaces)
    }

    private static func runAppleScript(_ source: String) throws -> String {
        var errorDict: NSDictionary?
        guard let script = NSAppleScript(source: source) else {
            throw ActionError(message: "could not compile AppleScript")
        }
        let result = script.executeAndReturnError(&errorDict)
        if let errorDict {
            let message = errorDict[NSAppleScript.errorMessage] as? String ?? "unknown AppleScript error"
            throw ActionError(message: message)
        }
        return result.stringValue ?? ""
    }
}
