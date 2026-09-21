import Foundation

// Controlled shell execution — NOT an unrestricted shell(command) tool.
// Every command runs with its cwd pinned to a single workspace directory
// (per the spec's workspace-restriction requirement), and anything not on
// the short read-only allowlist requires an explicit Approve click on the
// dashboard before it runs (see device-request-approval / HeartbeatLoop).
// This is deliberately a plain allowlist, not an attempt at sandboxing —
// an approved command can still reach outside the workspace via an
// absolute path, exactly as it could if you typed it in Terminal yourself;
// the approval step exists so nothing runs without you seeing it first.
enum SystemTools {
    static let workspaceRoot: URL = {
        let base = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let root = base.appendingPathComponent("PAMI", isDirectory: true)
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }()

    private static let readOnlyPrefixes = [
        "git status", "git diff", "git log", "git branch", "git show",
        "ls", "pwd", "cat", "find", "grep",
        "npm test", "npm run build", "npm run lint", "npm list",
    ]

    static func isReadOnly(command: String) -> Bool {
        let trimmed = command.trimmingCharacters(in: .whitespaces)
        return readOnlyPrefixes.contains { trimmed == $0 || trimmed.hasPrefix($0 + " ") }
    }

    static func runCommand(_ command: String) async throws -> String {
        // -lc runs it through zsh, and `cd` first since ProcessRunner's
        // generic executor has no notion of a working directory.
        let out = try await ProcessRunner.run(
            executable: "/bin/zsh",
            arguments: ["-lc", "cd \(shellEscape(workspaceRoot.path)) && \(command)"],
        )
        return out.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "(no output)" : out
    }

    private static func shellEscape(_ path: String) -> String {
        "'" + path.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}
