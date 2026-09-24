import Foundation

// Unrestricted shell execution, per the user's explicit choice to give PAMI
// full control of their Mac: any command runs immediately through a login
// zsh (so their PATH/aliases resolve), starting in the home directory,
// with no allowlist and no dashboard approval step. The menu bar's
// "Pause PAMI" toggle is the kill switch.
enum SystemTools {
    static let workingDirectory = FileManager.default.homeDirectoryForCurrentUser

    static func runCommand(_ command: String) async throws -> String {
        let out = try await ProcessRunner.run(
            executable: "/bin/zsh",
            arguments: ["-lc", command],
            currentDirectory: workingDirectory,
        )
        let trimmed = out.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "(no output)" }
        // Task results are stored/rendered on the dashboard — keep huge
        // outputs (e.g. a recursive ls) from bloating the row.
        return trimmed.count > 20_000 ? String(trimmed.prefix(20_000)) + "\n… (truncated)" : trimmed
    }
}
