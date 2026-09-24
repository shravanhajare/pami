import Foundation

// Polling, not a persistent connection — "reconnecting" is simply the next
// successful call after a failure, with exponential backoff in between.
actor HeartbeatLoop {
    static let shared = HeartbeatLoop()

    private let api = PamiAPI()
    private var backoff: TimeInterval = 5
    private var running = false
    private var lastActivity = Date.distantPast

    // The between-heartbeat wait, held so poke() can cut it short — a task
    // created on this Mac (voice) gets picked up immediately instead of
    // sitting until the next scheduled poll.
    private var sleeper: Task<Void, Never>?

    private func nap(seconds: TimeInterval) async {
        let task = Task<Void, Never> { try? await Task.sleep(for: .seconds(seconds)) }
        sleeper = task
        await task.value
        sleeper = nil
    }

    func poke() {
        lastActivity = Date()
        sleeper?.cancel()
    }

    // The in-flight execute(task:) for a voice-originated "ask" — tracked
    // so the overlay's Cancel button (during the "Thinking…" phase) has
    // something to call .cancel() on. Cancelling it propagates down through
    // ClaudeCodeProvider/OpenCodeProvider's ProcessRunner, which terminates
    // the underlying CLI subprocess (see ProcessRunner.swift's
    // withTaskCancellationHandler), not just abandoning the Swift Task.
    private var currentVoiceExecTask: Task<String, Error>?

    func cancelCurrentVoiceTask() {
        currentVoiceExecTask?.cancel()
    }

    func start(appState: AppState) {
        guard !running else { return }
        running = true
        Task { await self.run(appState: appState) }
    }

    private func run(appState: AppState) async {
        while running {
            await ensurePaired(appState: appState)

            guard let token = await appState.deviceToken else {
                try? await Task.sleep(for: .seconds(2))
                continue
            }

            do {
                let result = try await api.heartbeat(
                    deviceToken: token,
                    agentVersion: AppVersion.current,
                    osVersion: DeviceIdentity.osVersion,
                    state: await appState.isPaused ? "paused" : "standby",
                )
                backoff = 5
                await MainActor.run { appState.apply(result) }

                // Paused = kill switch: keep heartbeating (so the dashboard
                // shows "paused") but leave every task untouched in the
                // queue until resumed.
                let paused = await appState.isPaused
                for task in result.tasks where !paused {
                    if task.status == "pending" {
                        await handle(task: task, deviceToken: token)
                    } else if task.status == "waiting_for_approval", let decision = task.approval_decision {
                        await handleApprovalResolution(task: task, decision: decision, deviceToken: token)
                    }
                }

                let pending = result.status == "pending"
                // Snappy while the user is actively sending things, relaxed
                // when idle (keeps Edge Function invocations reasonable).
                if !result.tasks.isEmpty { lastActivity = Date() }
                let recentlyActive = Date().timeIntervalSince(lastActivity) < 120
                await nap(seconds: pending ? 2 : (recentlyActive ? 3 : 10))
            } catch {
                await MainActor.run { appState.connectionState = .reconnecting }
                try? await Task.sleep(for: .seconds(backoff))
                backoff = min(backoff * 2, 60)
            }
        }
    }

    private func ensurePaired(appState: AppState) async {
        guard await appState.deviceToken == nil else { return }

        do {
            let response = try await api.pairInit(
                deviceId: DeviceIdentity.current,
                name: DeviceIdentity.deviceName,
                osVersion: DeviceIdentity.osVersion,
            )
            Keychain.saveDeviceToken(response.device_token)
            await MainActor.run {
                appState.connectionState = .pairing(code: response.pairing_code)
            }
        } catch PamiAPIError.server(let status, _) where status == 409 {
            // The persisted device_id already has a row server-side (e.g.
            // local token storage was cleared/lost but the id survived in
            // UserDefaults) — a fresh id lets pairing succeed instead of
            // colliding on the same primary key forever.
            DeviceIdentity.regenerate()
        } catch {
            await MainActor.run { appState.connectionState = .reconnecting }
            try? await Task.sleep(for: .seconds(backoff))
            backoff = min(backoff * 2, 60)
        }
    }

    func createTask(appState: AppState) async {
        guard let token = await appState.deviceToken else { return }
        try? await api.createTask(deviceToken: token)
    }

    // Used by voice capture: a transcribed request becomes an "ask" task,
    // going through the exact same Claude Code delegation path as text
    // typed into the dashboard's Ask PAMI box.
    func createAskTask(appState: AppState, prompt: String) async throws {
        guard let token = await appState.deviceToken else { return }
        let title = prompt.count > 60 ? String(prompt.prefix(57)) + "..." : prompt
        try await api.createTask(deviceToken: token, title: title, type: "ask", prompt: prompt)
        poke()
    }

    // Routes each task by type: structured Apple-app actions run directly
    // via AppleScript (MacIntegrations), free-text "ask" goes through
    // QuickCommands and then the full-access Claude Code agent,
    // "system_command" runs immediately with no approval step (older
    // tasks still parked in waiting_for_approval are resolved by
    // handleApprovalResolution), and anything else (e.g.
    // "manual_activation") has no further action defined yet, so it's
    // marked completed immediately rather than left to rot as
    // "acknowledged".
    private func handle(task: PamiTask, deviceToken: String) async {
        try? await api.ackTask(deviceToken: deviceToken, taskId: task.id, status: "acknowledged")

        let voiceTaskInFlight = await AppState.shared.voiceTaskInFlight
        let isVoiceOriginated = task.type == "ask" && voiceTaskInFlight
        if isVoiceOriginated {
            await MainActor.run {
                VoiceOverlay.shared.showThinking(onCancel: {
                    Task { await HeartbeatLoop.shared.cancelCurrentVoiceTask() }
                })
            }
        }

        do {
            let result: String
            if isVoiceOriginated {
                // Run through a cancellable Task rather than awaiting
                // execute(task:) inline, so cancelCurrentVoiceTask() (wired
                // to the overlay's Cancel button above) can actually stop
                // it mid-flight instead of only detaching from it.
                let execTask = Task { try await self.execute(task: task) }
                currentVoiceExecTask = execTask
                defer { currentVoiceExecTask = nil }
                result = try await execTask.value
            } else {
                result = try await execute(task: task)
            }
            try await api.ackTask(deviceToken: deviceToken, taskId: task.id, status: "completed", result: result)

            // Voice output only for the conversational "ask" path — not
            // for calendar/notes/reminders confirmations or raw shell
            // command output, which the user didn't ask to hear read aloud.
            if task.type == "ask" {
                let shouldSpeak = await AppState.shared.voiceResponsesEnabled
                if shouldSpeak {
                    if isVoiceOriginated {
                        await MainActor.run { VoiceOverlay.shared.showSpeaking(onCancel: { TextToSpeech.stop() }) }
                        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                            TextToSpeech.speak(result) {
                                continuation.resume()
                            }
                        }
                        await MainActor.run { VoiceOverlay.shared.hide() }
                    } else {
                        TextToSpeech.speak(result)
                    }
                } else if isVoiceOriginated {
                    await MainActor.run { VoiceOverlay.shared.hide() }
                }
            }
        } catch is CancellationError {
            try? await api.ackTask(deviceToken: deviceToken, taskId: task.id, status: "cancelled", result: "Cancelled.")
            if isVoiceOriginated {
                await MainActor.run { VoiceOverlay.shared.hide() }
            }
        } catch {
            try? await api.ackTask(
                deviceToken: deviceToken,
                taskId: task.id,
                status: "failed",
                result: "\(error.localizedDescription)",
            )
            if isVoiceOriginated {
                await MainActor.run { VoiceOverlay.shared.showError("Couldn't finish that") }
            }
        }

        if isVoiceOriginated {
            await MainActor.run { AppState.shared.voiceTaskInFlight = false }
        }
    }

    // A task the Mac previously parked in waiting_for_approval, now
    // resolved one way or the other from the dashboard.
    private func handleApprovalResolution(task: PamiTask, decision: String, deviceToken: String) async {
        guard decision == "approved" else {
            try? await api.ackTask(deviceToken: deviceToken, taskId: task.id, status: "cancelled", result: "Denied.")
            return
        }
        guard let command = task.requested_action?.command else {
            try? await api.ackTask(deviceToken: deviceToken, taskId: task.id, status: "failed", result: "Approved but no command was recorded.")
            return
        }
        do {
            let output = try await SystemTools.runCommand(command)
            try await api.ackTask(deviceToken: deviceToken, taskId: task.id, status: "completed", result: output)
        } catch {
            try? await api.ackTask(deviceToken: deviceToken, taskId: task.id, status: "failed", result: error.localizedDescription)
        }
    }

    private func execute(task: PamiTask) async throws -> String {
        switch task.type {
        case "ask":
            guard let prompt = task.prompt, !prompt.isEmpty else {
                return "No prompt provided."
            }
            // Everyday commands ("mute", "next song", "open YouTube", "lock
            // my Mac") are answered instantly by QuickCommands; only what it
            // doesn't recognize goes on to an LLM.
            if let result = try await QuickCommands.handle(prompt) {
                return result
            }
            // Only pure general-knowledge questions ("what's the capital of
            // France") go to the free, tool-less OpenCode route — anything
            // that should *happen* on this Mac needs the Claude Code agent.
            if looksLikeGeneralQuestion(prompt) {
                // The free NVIDIA route has turned out to be unreliable, so
                // give it a bounded window and fall back to the agent.
                do {
                    return try await withTimeout(seconds: 20) {
                        try await OpenCodeProvider.run(prompt: prompt)
                    }
                } catch is CancellationError {
                    // A genuine cancel (the overlay's Cancel button) — not a
                    // timeout, so don't retry via Claude Code.
                    throw CancellationError()
                } catch {}
            }
            return try await runAgent(prompt: prompt)

        case "calendar_today":
            return try MacIntegrations.todayEvents()

        case "create_note":
            return try MacIntegrations.createNote(title: task.title, body: task.prompt ?? "")

        case "create_reminder":
            return try MacIntegrations.createReminder(text: task.prompt ?? task.title, dueDate: nil)

        case "system_command":
            guard let command = task.prompt else { return "No command provided." }
            return try await SystemTools.runCommand(command)

        case "lock_screen":
            return try MacControl.lockScreen()

        case "volume_get":
            return try MacControl.getVolume()

        case "volume_set":
            guard let raw = task.prompt, let percent = Int(raw.trimmingCharacters(in: .whitespaces)) else {
                return "Give a volume percentage from 0–100."
            }
            return try MacControl.setVolume(percent)

        case "music_control":
            return try MacControl.musicControl(action: task.prompt ?? "")

        case "clipboard_get":
            return MacControl.clipboardGet()

        case "clipboard_set":
            guard let text = task.prompt, !text.isEmpty else { return "No text provided." }
            return MacControl.clipboardSet(text)

        case "quit_app":
            let name = task.prompt ?? task.title
            return try MacControl.quitApp(named: name)

        case "battery_status":
            return try await MacControl.batteryStatus()

        // Dashboard shortcut buttons — the same phrases QuickCommands
        // understands by voice, so both surfaces share one vocabulary.
        case "quick_command":
            let phrase = task.prompt ?? task.title
            guard let result = try await QuickCommands.handle(phrase) else {
                return "Didn't recognize \"\(phrase)\"."
            }
            return result

        default:
            return "PAMI activated on \(DeviceIdentity.deviceName)."
        }
    }

    // Agent runs are capped so one stuck request can't block the task
    // queue (and heartbeats) forever; cancellation terminates the CLI.
    private func runAgent(prompt: String) async throws -> String {
        do {
            return try await withTimeout(seconds: 10 * 60) {
                try await ClaudeCodeProvider.run(prompt: prompt)
            }
        } catch is TimeoutError {
            throw ClaudeCodeProvider.AgentError(message: "That took longer than 10 minutes, so I stopped it.")
        }
    }

    // A keyword heuristic, not real intent classification: a question
    // ("what/who/why/how…") that doesn't mention anything on this Mac or
    // the user's own stuff is general knowledge; everything else — every
    // imperative ("move", "send", "find", "clean up") and every question
    // about "my" things — is something the agent should act on.
    private let questionStarts = [
        "what", "what's", "who", "who's", "whos", "why", "how", "when", "where", "which",
        "is ", "are ", "does ", "do ", "can ", "explain", "define", "tell me about", "tell me a",
    ]

    private let localContextWords = [
        " my ", " i ", " me ", " mine", "mac", "computer", "laptop", "file", "folder",
        "download", "desktop", "document", "screen", "app", "email", "mail", "message",
        "calendar", "reminder", "note", "photo", "disk", "storage", "memory", "cpu",
        "wifi", "wi-fi", "bluetooth", "battery", "running", "installed", "open ",
        "code", "repo", "project", "git", "terminal", "clipboard", "browser", "tab",
        "this", "that", "it ", "again",
    ]

    private func looksLikeGeneralQuestion(_ prompt: String) -> Bool {
        let lower = " " + QuickCommands.normalize(prompt) + " "
        let trimmed = lower.trimmingCharacters(in: .whitespaces)
        guard questionStarts.contains(where: { trimmed.hasPrefix($0) }) else { return false }
        return !localContextWords.contains { lower.contains($0) }
    }
}

enum AppVersion {
    static let current = "0.1.0"
}

struct TimeoutError: Error {}

// Races `operation` against a deadline. If the deadline wins, this throws
// TimeoutError and the caller can fall back — note the losing operation
// keeps running in the background (Process calls don't respect Swift task
// cancellation), it's just no longer waited on.
func withTimeout<T: Sendable>(seconds: TimeInterval, operation: @escaping @Sendable () async throws -> T) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
        group.addTask { try await operation() }
        group.addTask {
            try await Task.sleep(for: .seconds(seconds))
            throw TimeoutError()
        }
        guard let result = try await group.next() else { throw TimeoutError() }
        group.cancelAll()
        return result
    }
}
