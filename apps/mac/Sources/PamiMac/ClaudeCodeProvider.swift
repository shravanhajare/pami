import Foundation

// Delegates a text request to the user's own Claude Code CLI installation —
// their existing subscription/auth, not a separate API key. Runs headless
// with all tools disabled (`--tools ""`): a coding-task executor that can
// edit files or run shell commands needs an approval flow (Section 26 of
// the spec) that doesn't exist yet, so for now this is a safe, hang-free
// text-only responder. Wiring real tool-using delegation is future work
// once the approval system exists.
enum ClaudeCodeProvider {
    struct NotFound: Error {}

    static func locateBinary() -> String? {
        let candidates = [
            "/opt/homebrew/bin/claude",
            "/usr/local/bin/claude",
        ]
        return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
    }

    static func run(prompt: String) async throws -> String {
        guard let binary = locateBinary() else { throw NotFound() }

        return try await ProcessRunner.run(
            executable: binary,
            arguments: ["-p", prompt, "--output-format", "text", "--tools", ""],
        )
    }
}
