import Foundation

// Runs a CLI process on a dedicated GCD thread rather than directly inside
// an async function on Swift's cooperative thread pool. That pool has only
// a handful of threads (roughly one per core); a long blocking call there
// (Process.run() + FileHandle.readToEnd()/waitUntilExit(), none of which
// are cancellation-aware) can starve *unrelated* async work — this is
// exactly what broke HeartbeatLoop's OpenCode timeout: the timeout's
// Task.sleep never got a thread to run on while OpenCode's blocking I/O
// held one for 3 minutes. Routing the blocking work through
// withCheckedThrowingContinuation + DispatchQueue.global keeps it off that
// pool, and withTaskCancellationHandler means a timeout race that cancels
// this Task actually terminates the underlying process instead of leaving
// it running unattended in the background.
enum ProcessRunner {
    struct ExecutionError: Error {
        let exitCode: Int32
        let message: String
    }

    // Set from `onCancel` below, read back on the GCD thread once the
    // process actually exits, so a cancellation-triggered terminate() is
    // reported as CancellationError rather than a misleading nonzero-exit
    // ExecutionError — callers (HeartbeatLoop) tell "you cancelled this"
    // apart from "this genuinely failed" by catching CancellationError
    // specifically. Task.isCancelled itself isn't readable from inside the
    // plain DispatchQueue.global closure below (no Task context there), so
    // this lock-protected flag is the bridge.
    private final class CancelFlag: @unchecked Sendable {
        private let lock = NSLock()
        private var value = false
        func set() { lock.lock(); value = true; lock.unlock() }
        func get() -> Bool { lock.lock(); defer { lock.unlock() }; return value }
    }

    // An app launched from Finder/login items inherits launchd's bare
    // PATH (/usr/bin:/bin:/usr/sbin:/sbin), so Homebrew-installed tools
    // (node, git from brew, python, etc.) would be invisible to anything
    // the agent runs — prepend the usual install locations.
    static let fullEnvironment: [String: String] = {
        var env = ProcessInfo.processInfo.environment
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let extra = ["/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/bin", "\(home)/.local/bin", "\(home)/.bun/bin", "\(home)/.cargo/bin"]
        env["PATH"] = (extra + [env["PATH"] ?? "/usr/bin:/bin:/usr/sbin:/sbin"]).joined(separator: ":")
        return env
    }()

    static func run(executable: String, arguments: [String], currentDirectory: URL? = nil) async throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.environment = fullEnvironment
        if let currentDirectory {
            process.currentDirectoryURL = currentDirectory
        }

        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr
        // Headless CLIs like `claude -p` read stdin when it isn't a TTY —
        // an inherited-but-never-closed stdin would make them wait forever.
        process.standardInput = FileHandle.nullDevice

        let cancelFlag = CancelFlag()

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
                DispatchQueue.global(qos: .userInitiated).async {
                    do {
                        try process.run()
                    } catch {
                        continuation.resume(throwing: error)
                        return
                    }

                    if cancelFlag.get() { process.terminate() }

                    // Drained on its own thread: reading stderr only after
                    // stdout hits EOF deadlocks once a chatty child fills
                    // the ~64KB stderr pipe buffer and blocks on write.
                    var errData = Data()
                    let errDone = DispatchSemaphore(value: 0)
                    DispatchQueue.global(qos: .utility).async {
                        errData = stderr.fileHandleForReading.readDataToEndOfFile()
                        errDone.signal()
                    }

                    let outputData = stdout.fileHandleForReading.readDataToEndOfFile()
                    process.waitUntilExit()
                    errDone.wait()

                    if process.terminationStatus != 0 {
                        if cancelFlag.get() {
                            continuation.resume(throwing: CancellationError())
                            return
                        }
                        let message = String(data: errData, encoding: .utf8) ?? ""
                        continuation.resume(throwing: ExecutionError(
                            exitCode: process.terminationStatus,
                            message: message.isEmpty ? "exit code \(process.terminationStatus)" : message,
                        ))
                        return
                    }

                    let text = String(data: outputData, encoding: .utf8) ?? ""
                    continuation.resume(returning: text)
                }
            }
        } onCancel: {
            cancelFlag.set()
            // terminate() on a not-yet-launched Process raises an ObjC
            // exception; the post-launch flag check above covers that case.
            if process.isRunning { process.terminate() }
        }
    }
}
