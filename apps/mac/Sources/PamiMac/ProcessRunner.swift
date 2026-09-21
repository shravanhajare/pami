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

    static func run(executable: String, arguments: [String]) async throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments

        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr

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

                    let outputData = stdout.fileHandleForReading.readDataToEndOfFile()
                    process.waitUntilExit()

                    if process.terminationStatus != 0 {
                        if cancelFlag.get() {
                            continuation.resume(throwing: CancellationError())
                            return
                        }
                        let errData = stderr.fileHandleForReading.readDataToEndOfFile()
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
            process.terminate()
        }
    }
}
