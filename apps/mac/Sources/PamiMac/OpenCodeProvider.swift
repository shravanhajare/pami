import Foundation

// Delegates general (non-coding) text requests to a free-tier NVIDIA model
// via the user's own OpenCode CLI installation, keeping Claude Code
// reserved for actual development work per the user's own routing
// preference. Uses a dedicated `pami-chat` OpenCode agent (defined in
// ~/.config/opencode/agents/pami-chat.md) with every tool permission
// explicitly disabled — same reasoning as ClaudeCodeProvider's `--tools ""`:
// a plain-text answer box shouldn't be able to touch files or run commands.
enum OpenCodeProvider {
    struct NotFound: Error {}

    static func locateBinary() -> String? {
        let candidates = [
            "/opt/homebrew/bin/opencode",
            "/usr/local/bin/opencode",
        ]
        return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
    }

    static func run(prompt: String) async throws -> String {
        guard let binary = locateBinary() else { throw NotFound() }

        let raw = try await ProcessRunner.run(
            executable: binary,
            arguments: ["run", prompt, "--agent", "pami-chat"],
        )

        // opencode's default output includes a "> agent · model" banner line
        // before the actual reply — strip it so the dashboard shows just
        // the answer, matching what ClaudeCodeProvider returns.
        let lines = raw.split(separator: "\n", omittingEmptySubsequences: false)
        let contentLines = lines.filter { !$0.hasPrefix(">") && !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        let text = contentLines.isEmpty ? raw : contentLines.joined(separator: "\n")
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
