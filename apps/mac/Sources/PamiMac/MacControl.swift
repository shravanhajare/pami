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

    // CGSession -suspend is the same mechanism the  menu bar "Lock Screen"
    // item uses — unlike simulating Cmd+Ctrl+Q via System Events, it needs
    // no Accessibility permission at all.
    static func lockScreen() throws -> String {
        let path = "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession"
        guard FileManager.default.fileExists(atPath: path) else {
            throw ActionError(message: "Lock Screen isn't available on this macOS version.")
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: path)
        process.arguments = ["-suspend"]
        try process.run()
        return "Locked the screen."
    }

    // MARK: - Volume

    // Plain top-level Standard Additions commands, not a `tell application`
    // block — these don't trigger an Automation permission prompt.
    static func getVolume() throws -> String {
        let result = try runAppleScript("output volume of (get volume settings)")
        return "Volume is at \(result)%."
    }

    static func setVolume(_ percent: Int) throws -> String {
        let clamped = max(0, min(100, percent))
        _ = try runAppleScript("set volume output volume \(clamped)")
        return "Volume set to \(clamped)%."
    }

    // MARK: - Music

    static func musicControl(action: String) throws -> String {
        let normalized = action.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch normalized {
        case "play":
            _ = try runAppleScript(#"tell application "Music" to play"#)
            return "Playing."
        case "pause":
            _ = try runAppleScript(#"tell application "Music" to pause"#)
            return "Paused."
        case "next":
            _ = try runAppleScript(#"tell application "Music" to next track"#)
            return try nowPlaying(prefix: "Skipped to")
        case "previous":
            _ = try runAppleScript(#"tell application "Music" to previous track"#)
            return try nowPlaying(prefix: "Back to")
        case "now_playing", "now playing", "":
            return try nowPlaying(prefix: "Now playing:")
        default:
            throw ActionError(message: "Unrecognized music action \"\(action)\".")
        }
    }

    private static func nowPlaying(prefix: String) throws -> String {
        let script = #"""
        tell application "Music"
            if player state is stopped then return "nothing"
            return (name of current track) & " — " & (artist of current track)
        end tell
        """#
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
