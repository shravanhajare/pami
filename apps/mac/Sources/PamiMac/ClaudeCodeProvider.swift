import Foundation

// Delegates a request to the user's own Claude Code CLI installation (their
// existing subscription/auth, not a separate API key) as a full-access Mac
// operator: every tool enabled and every permission check bypassed
// (`--dangerously-skip-permissions`), cwd at the home directory, and the
// whole filesystem added as an allowed directory — per the user's explicit
// choice that whatever they ask for should just happen, with no approval
// step in between. The menu bar's "Pause PAMI" toggle is the kill switch.
//
// Follow-ups ("now do the same for Downloads") resume the previous session
// if it was used recently, so the agent keeps the context of what it just
// did instead of starting cold every time.
enum ClaudeCodeProvider {
    struct NotFound: Error, LocalizedError {
        var errorDescription: String? { "Claude Code CLI not found — install it with `npm i -g @anthropic-ai/claude-code`." }
    }

    struct AgentError: Error, LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    private struct ResultEnvelope: Decodable {
        let result: String?
        let session_id: String?
        let is_error: Bool?
    }

    static let model = "claude-sonnet-5"

    // How long a finished conversation stays "live" for follow-ups.
    private static let sessionWindow: TimeInterval = 10 * 60

    private final class SessionStore: @unchecked Sendable {
        private let lock = NSLock()
        private var id: String?
        private var lastUsed = Date.distantPast

        func current(within window: TimeInterval) -> String? {
            lock.lock(); defer { lock.unlock() }
            return Date().timeIntervalSince(lastUsed) < window ? id : nil
        }

        func update(_ newId: String?) {
            lock.lock(); defer { lock.unlock() }
            id = newId
            lastUsed = Date()
        }
    }

    private static let session = SessionStore()

    static func resetConversation() {
        session.update(nil)
    }

    static func locateBinary() -> String? {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let candidates = [
            "/opt/homebrew/bin/claude",
            "/usr/local/bin/claude",
            "\(home)/.local/bin/claude",
            "\(home)/.claude/local/claude",
        ]
        return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
    }

    static func run(prompt: String) async throws -> String {
        guard let binary = locateBinary() else { throw NotFound() }

        if let previous = session.current(within: sessionWindow) {
            do {
                return try await invoke(binary: binary, prompt: prompt, resume: previous)
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                // Stale/corrupt session — start fresh rather than failing.
            }
        }
        return try await invoke(binary: binary, prompt: prompt, resume: nil)
    }

    private static func invoke(binary: String, prompt: String, resume: String?) async throws -> String {
        var arguments = [
            "-p", prompt,
            "--output-format", "json",
            // Pinned per the user's choice, rather than inheriting whatever
            // default their CLI/account happens to have.
            "--model", model,
            "--dangerously-skip-permissions",
            "--add-dir", "/",
            "--append-system-prompt", systemPrompt(),
        ]
        if let resume {
            arguments += ["--resume", resume]
        }

        let raw = try await ProcessRunner.run(
            executable: binary,
            arguments: arguments,
            currentDirectory: FileManager.default.homeDirectoryForCurrentUser,
        )

        guard let data = raw.data(using: .utf8),
              let envelope = try? JSONDecoder().decode(ResultEnvelope.self, from: data)
        else {
            // Not JSON (older CLI?) — the raw text is still the best answer we have.
            return raw.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        session.update(envelope.session_id)
        let text = (envelope.result ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if envelope.is_error == true {
            throw AgentError(message: text.isEmpty ? "Claude Code reported an error." : text)
        }
        return text.isEmpty ? "Done." : text
    }

    private static func systemPrompt() -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.timeStyle = .short
        let now = formatter.string(from: Date())
        let user = NSUserName()
        let home = FileManager.default.homeDirectoryForCurrentUser.path

        return """
        You are PAMI, a personal assistant with full, unrestricted control of \(user)'s Mac \
        (\(DeviceIdentity.deviceName), macOS \(DeviceIdentity.osVersion)). The current time is \(now). \
        Home directory: \(home).

        The user speaks or types a request from their Mac or phone and expects it to actually \
        happen on this Mac — do it, don't describe how to do it. You have explicit permission \
        to act without asking for confirmation. Use every tool available:
        - Shell commands (Bash) for files, processes, system settings (defaults, pmset, \
        networksetup, open, mdfind, screencapture, pbcopy/pbpaste, etc.).
        - AppleScript/JXA via `osascript` to drive any app (Finder, Safari, Chrome, Mail, \
        Messages, Notes, Reminders, Calendar, Music, Spotify, System Events for UI \
        scripting, keystrokes and clicks).
        - `open -a <App>` / `open <url>` to launch apps, files and websites.
        - Web search/fetch when the request needs current information.

        Be decisive: pick the most reasonable interpretation instead of asking clarifying \
        questions. Verify the result when it's cheap to do so. For irreversible deletions \
        prefer moving items to the Trash over `rm`.

        Your final message is shown on a dashboard and often read aloud by text-to-speech: \
        reply in one or two short, plain sentences confirming what you did (or the answer), \
        with no markdown, bullet points, code blocks or file dumps unless the user asked for them.
        """
    }
}
