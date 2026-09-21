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

        let process = Process()
        process.executableURL = URL(fileURLWithPath: binary)
        process.arguments = ["run", prompt, "--agent", "pami-chat"]

        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr

        try process.run()

        let outputData = try stdout.fileHandleForReading.readToEnd() ?? Data()
        process.waitUntilExit()

        if process.terminationStatus != 0 {
            let errorData = try? stderr.fileHandleForReading.readToEnd()
            let message = errorData.flatMap { String(data: $0, encoding: .utf8) } ?? "unknown error"
            throw NSError(domain: "OpenCodeProvider", code: Int(process.terminationStatus), userInfo: [NSLocalizedDescriptionKey: message])
        }

        // opencode's default output includes a "> agent · model" banner line
        // before the actual reply — strip it so the dashboard shows just
        // the answer, matching what ClaudeCodeProvider returns.
        let raw = String(data: outputData, encoding: .utf8) ?? ""
        let lines = raw.split(separator: "\n", omittingEmptySubsequences: false)
        let contentLines = lines.filter { !$0.hasPrefix(">") && !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        let text = contentLines.isEmpty ? raw : contentLines.joined(separator: "\n")
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
