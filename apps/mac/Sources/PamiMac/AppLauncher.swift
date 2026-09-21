import Foundation

// Recognizes "open <app>" / "launch <app>" style requests and actually
// launches the app via `open -a`, rather than letting them fall through to
// Claude Code — a tool-less LLM asked to "open Notes" can only generate a
// plausible-sounding sentence claiming it did, which is exactly the kind
// of fake-looking "completed" status the project spec warns against.
enum AppLauncher {
    struct NotRecognized: Error {}
    struct AppNotFound: Error { let name: String }

    private static let pattern = try! NSRegularExpression(
        pattern: #"^(?:please\s+)?(?:open|launch|start)\s+(?:the\s+|my\s+)?(.+?)(?:\s+app)?\.?$"#,
        options: .caseInsensitive,
    )

    // Common mis-hearings from generic dictation for app names that don't
    // transcribe cleanly (mirrors the same problem "PAMI" has as a wake
    // word — see WakeWordListener).
    private static let aliases: [String: String] = [
        "notebook": "Notes",
        "note book": "Notes",
        "note": "Notes",
        "notes": "Notes",
        "calendar": "Calendar",
        "reminders": "Reminders",
        "safari": "Safari",
        "finder": "Finder",
        "mail": "Mail",
        "messages": "Messages",
        "terminal": "Terminal",
        "music": "Music",
        "photos": "Photos",
        "preview": "Preview",
        "settings": "System Settings",
        "system settings": "System Settings",
        "system preferences": "System Settings",
        "vs code": "Visual Studio Code",
        "vscode": "Visual Studio Code",
        "xcode": "Xcode",
    ]

    // Extracts an app name from a natural-language request, or throws
    // NotRecognized if this doesn't look like an "open X" request at all
    // (the caller should fall back to Claude Code in that case).
    static func extractAppName(from text: String) throws -> String {
        let range = NSRange(text.startIndex..., in: text)
        guard let match = pattern.firstMatch(in: text, range: range),
              let nameRange = Range(match.range(at: 1), in: text)
        else {
            throw NotRecognized()
        }
        let raw = String(text[nameRange]).trimmingCharacters(in: .whitespaces).lowercased()
        return aliases[raw] ?? raw.capitalized
    }

    static func open(appName: String) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        process.arguments = ["-a", appName]

        let stderr = Pipe()
        process.standardError = stderr
        try process.run()
        process.waitUntilExit()

        if process.terminationStatus != 0 {
            let errData = try? stderr.fileHandleForReading.readToEnd()
            let message = errData.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            if message.lowercased().contains("unable to find application") {
                throw AppNotFound(name: appName)
            }
            throw NSError(domain: "AppLauncher", code: Int(process.terminationStatus), userInfo: [NSLocalizedDescriptionKey: message])
        }

        return "Opened \(appName)."
    }
}
