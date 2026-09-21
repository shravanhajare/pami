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

        let process = Process()
        process.executableURL = URL(fileURLWithPath: binary)
        process.arguments = ["-p", prompt, "--output-format", "text", "--tools", ""]

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
            throw NSError(domain: "ClaudeCodeProvider", code: Int(process.terminationStatus), userInfo: [NSLocalizedDescriptionKey: message])
        }

        return String(data: outputData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
}
