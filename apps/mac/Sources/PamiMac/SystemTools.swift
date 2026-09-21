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

    static func runCommand(_ command: String) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lc", command]
        process.currentDirectoryURL = workspaceRoot

        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr
        try process.run()

        let outData = try stdout.fileHandleForReading.readToEnd() ?? Data()
        let errData = try stderr.fileHandleForReading.readToEnd() ?? Data()
        process.waitUntilExit()

        if process.terminationStatus != 0 {
            let err = String(data: errData, encoding: .utf8) ?? ""
            throw NSError(
                domain: "SystemTools",
                code: Int(process.terminationStatus),
                userInfo: [NSLocalizedDescriptionKey: err.isEmpty ? "command exited with status \(process.terminationStatus)" : err],
            )
        }

        let out = String(data: outData, encoding: .utf8) ?? ""
        return out.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "(no output)" : out
    }
}
