import Foundation
import AppKit

// Instant, deterministic handling for the everyday requests people say most
// ("mute", "next song", "lock my Mac", "open YouTube") — answered in
// milliseconds by MacControl instead of spinning up a Claude Code agent,
// which takes several seconds even for trivial things. Anything that
// doesn't match exactly returns nil and falls through to the agent, so a
// miss here only costs speed, never capability.
enum QuickCommands {
    static func handle(_ prompt: String) async throws -> String? {
        let text = normalize(prompt)
        guard !text.isEmpty else { return nil }

        // MARK: Volume
        if matches(text, ["mute", "mute the volume", "mute volume", "mute sound", "mute my mac", "be quiet", "silence"]) {
            return try MacControl.setMuted(true)
        }
        if matches(text, ["unmute", "unmute the volume", "unmute volume", "unmute sound"]) {
            return try MacControl.setMuted(false)
        }
        if matches(text, ["volume up", "turn it up", "turn up the volume", "turn the volume up", "louder", "increase the volume", "increase volume", "raise the volume"]) {
            _ = try? MacControl.setMuted(false)
            return try MacControl.adjustVolume(by: 12)
        }
        if matches(text, ["volume down", "turn it down", "turn down the volume", "turn the volume down", "quieter", "decrease the volume", "decrease volume", "lower the volume"]) {
            return try MacControl.adjustVolume(by: -12)
        }
        if matches(text, ["max volume", "full volume", "volume max", "maximum volume"]) {
            _ = try? MacControl.setMuted(false)
            return try MacControl.setVolume(100)
        }
        if let percent = capture(text, #"^(?:set (?:the )?)?volume (?:to |at )?(\d{1,3})(?: ?%| percent)?$"#).flatMap(Int.init) {
            _ = try? MacControl.setMuted(false)
            return try MacControl.setVolume(percent)
        }
        if matches(text, ["what's the volume", "what is the volume", "volume", "current volume"]) {
            return try MacControl.getVolume()
        }

        // MARK: Music
        if matches(text, ["play", "play music", "resume", "resume music", "resume playback", "start music"]) {
            return try MacControl.musicControl(action: "play")
        }
        if matches(text, ["pause", "pause music", "stop music", "stop the music", "pause the music", "stop playing"]) {
            return try MacControl.musicControl(action: "pause")
        }
        if matches(text, ["next", "next song", "next track", "skip", "skip song", "skip this song", "skip track"]) {
            return try MacControl.musicControl(action: "next")
        }
        if matches(text, ["previous", "previous song", "previous track", "last song", "go back a song"]) {
            return try MacControl.musicControl(action: "previous")
        }
        if matches(text, ["what's playing", "what song is this", "what is playing", "now playing", "what's this song"]) {
            return try MacControl.musicControl(action: "now_playing")
        }

        // MARK: Screen / power
        if matches(text, ["lock", "lock screen", "lock the screen", "lock my screen", "lock my mac", "lock the mac", "lock my computer", "lock computer"]) {
            return try MacControl.lockScreen()
        }
        if matches(text, ["turn off the display", "turn off display", "turn off the screen", "turn off screen", "sleep display", "display off", "screen off"]) {
            return try await MacControl.sleepDisplay()
        }
        if matches(text, ["sleep", "go to sleep", "put my mac to sleep", "put the mac to sleep", "sleep my mac", "put computer to sleep"]) {
            return try await MacControl.sleepMac()
        }
        if matches(text, ["battery", "battery status", "battery level", "how much battery", "how much battery do i have", "how's my battery", "what's my battery"]) {
            return try await MacControl.batteryStatus()
        }
        if matches(text, ["screenshot", "take a screenshot", "take screenshot", "capture the screen", "capture screen"]) {
            return try await MacControl.screenshot()
        }

        // MARK: Appearance / network
        if matches(text, ["dark mode", "turn on dark mode", "enable dark mode", "dark mode on", "switch to dark mode"]) {
            return try MacControl.setDarkMode(true)
        }
        if matches(text, ["light mode", "turn off dark mode", "disable dark mode", "dark mode off", "switch to light mode"]) {
            return try MacControl.setDarkMode(false)
        }
        if matches(text, ["toggle dark mode", "switch appearance", "toggle appearance"]) {
            return try MacControl.setDarkMode(nil)
        }
        if matches(text, ["turn on wifi", "turn on wi-fi", "wifi on", "wi-fi on", "enable wifi", "enable wi-fi"]) {
            return try await MacControl.setWiFi(true)
        }
        if matches(text, ["turn off wifi", "turn off wi-fi", "wifi off", "wi-fi off", "disable wifi", "disable wi-fi"]) {
            return try await MacControl.setWiFi(false)
        }

        // MARK: Clipboard / time
        if matches(text, ["what's on my clipboard", "what's in my clipboard", "read my clipboard", "read clipboard", "clipboard"]) {
            return MacControl.clipboardGet()
        }
        if matches(text, ["what time is it", "what's the time", "time", "current time"]) {
            return "It's \(Date().formatted(date: .omitted, time: .shortened))."
        }
        if matches(text, ["what's the date", "what is the date", "what's today's date", "what day is it", "date", "today's date"]) {
            return "It's \(Date().formatted(date: .complete, time: .omitted))."
        }

        // MARK: Web search
        if let query = capture(text, #"^(?:search|play|find) (.+?) on youtube$"#)
            ?? capture(text, #"^(?:search )?youtube (?:for )?(.+)$"#) {
            return try openSearch("https://www.youtube.com/results?search_query=", query, label: "YouTube")
        }
        if let query = capture(text, #"^(?:google|search google for|search the web for|search for|look up|search) (.+)$"#) {
            return try openSearch("https://www.google.com/search?q=", query, label: "Google")
        }

        // MARK: Quit
        if let name = capture(text, #"^(?:quit|close|exit|kill) (?:the )?(.+?)(?: app)?$"#), name.split(separator: " ").count <= 3 {
            let appName = resolveRunningApp(name)
            if let appName {
                return try MacControl.quitApp(named: appName)
            }
            return nil // not a running app — maybe "close all Safari tabs"; let the agent handle it
        }

        // MARK: Open (websites, folders, apps)
        if let target = capture(text, #"^(?:open|launch|start|go to|show me|show) (?:up )?(?:the |my )?(.+?)(?: app| website| site| folder)?$"#),
           target.split(separator: " ").count <= 4,
           !target.contains(" and "), !target.contains(" then "), !target.contains(" in ") {
            if let url = websiteURL(for: target) {
                return try MacControl.open(url: url)
            }
            if let folder = homeFolder(for: target) {
                NSWorkspace.shared.open(folder)
                return "Opened \(folder.lastPathComponent)."
            }
            if let appName = try? AppLauncher.extractAppName(from: "open \(target)"),
               let result = try? AppLauncher.open(appName: appName) {
                return result
            }
            return nil // unknown app name — the agent can search for it
        }

        return nil
    }

    // MARK: - Helpers

    private static let fillerPrefixes = [
        "hey pami", "hi pami", "ok pami", "okay pami", "pami",
        "please", "can you", "could you", "would you", "will you", "i want you to", "go ahead and", "just",
    ]
    private static let fillerSuffixes = ["please", "for me", "now", "pami"]

    static func normalize(_ prompt: String) -> String {
        var text = prompt.lowercased()
            .replacingOccurrences(of: "’", with: "'")
            .trimmingCharacters(in: CharacterSet.whitespacesAndNewlines.union(.punctuationCharacters).subtracting(CharacterSet(charactersIn: "%'")))
        var changed = true
        while changed {
            changed = false
            for prefix in fillerPrefixes where text.hasPrefix(prefix + " ") || text.hasPrefix(prefix + ",") {
                text = String(text.dropFirst(prefix.count)).trimmingCharacters(in: CharacterSet(charactersIn: " ,"))
                changed = true
            }
            for suffix in fillerSuffixes where text.hasSuffix(" " + suffix) || text.hasSuffix(", " + suffix) {
                text = String(text.dropLast(suffix.count)).trimmingCharacters(in: CharacterSet(charactersIn: " ,"))
                changed = true
            }
        }
        return text.replacingOccurrences(of: "  ", with: " ")
    }

    private static func matches(_ text: String, _ phrases: [String]) -> Bool {
        phrases.contains(text)
    }

    private static func capture(_ text: String, _ pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              let captured = Range(match.range(at: 1), in: text)
        else { return nil }
        let value = String(text[captured]).trimmingCharacters(in: .whitespaces)
        return value.isEmpty ? nil : value
    }

    private static func openSearch(_ base: String, _ query: String, label: String) throws -> String {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        guard let url = URL(string: base + encoded) else { return "Couldn't build that search." }
        _ = try MacControl.open(url: url)
        return "Searching \(label) for \(query)."
    }

    private static let knownSites: [String: String] = [
        "youtube": "https://www.youtube.com",
        "gmail": "https://mail.google.com",
        "google": "https://www.google.com",
        "google drive": "https://drive.google.com",
        "google docs": "https://docs.google.com",
        "github": "https://github.com",
        "netflix": "https://www.netflix.com",
        "twitter": "https://x.com",
        "x": "https://x.com",
        "instagram": "https://www.instagram.com",
        "facebook": "https://www.facebook.com",
        "linkedin": "https://www.linkedin.com",
        "reddit": "https://www.reddit.com",
        "amazon": "https://www.amazon.com",
        "chatgpt": "https://chatgpt.com",
        "claude": "https://claude.ai",
        "whatsapp web": "https://web.whatsapp.com",
        "pami dashboard": Config.dashboardURL.absoluteString,
        "dashboard": Config.dashboardURL.absoluteString,
    ]

    private static func websiteURL(for target: String) -> URL? {
        if let known = knownSites[target] { return URL(string: known) }
        // "youtube.com", "news.ycombinator.com" — a dot and no spaces.
        if !target.contains(" "), target.contains("."),
           let tld = target.split(separator: ".").last, tld.count >= 2, tld.allSatisfy(\.isLetter) {
            return URL(string: target.hasPrefix("http") ? target : "https://\(target)")
        }
        return nil
    }

    private static func homeFolder(for target: String) -> URL? {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let folders: [String: String] = [
            "downloads": "Downloads", "desktop": "Desktop", "documents": "Documents",
            "pictures": "Pictures", "movies": "Movies", "music folder": "Music",
            "home": "", "home folder": "", "applications": "/Applications",
        ]
        guard let name = folders[target] else { return nil }
        return name.hasPrefix("/") ? URL(fileURLWithPath: name) : home.appendingPathComponent(name)
    }

    private static func resolveRunningApp(_ spoken: String) -> String? {
        let apps = NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular }
        let lower = spoken.lowercased()
        let alias = (try? AppLauncher.extractAppName(from: "open \(spoken)"))?.lowercased()
        return apps.first {
            let name = $0.localizedName?.lowercased() ?? ""
            return name == lower || name == alias
        }?.localizedName
    }
}
