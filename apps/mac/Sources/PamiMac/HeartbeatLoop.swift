import Foundation

// Polling, not a persistent connection — "reconnecting" is simply the next
// successful call after a failure, with exponential backoff in between.
actor HeartbeatLoop {
    static let shared = HeartbeatLoop()

    private let api = PamiAPI()
    private var backoff: TimeInterval = 5
    private var running = false

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

                for task in result.tasks {
                    if task.status == "pending" {
                        await handle(task: task, deviceToken: token)
                    } else if task.status == "waiting_for_approval", let decision = task.approval_decision {
                        await handleApprovalResolution(task: task, decision: decision, deviceToken: token)
                    }
                }

                let pending = result.status == "pending"
                try await Task.sleep(for: .seconds(pending ? 2 : 20))
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
    }

    // Routes each task by type: structured Apple-app actions run directly
    // via AppleScript (MacIntegrations), free-text "ask" is delegated to
    // Claude Code (see ClaudeCodeProvider for why tool use is disabled
    // there), "system_command" runs immediately only if it's on the
    // read-only allowlist and otherwise waits for a dashboard approval
    // (see handleApprovalResolution), and anything else (e.g.
    // "manual_activation") has no further action defined yet, so it's
    // marked completed immediately rather than left to rot as
    // "acknowledged".
    private func handle(task: PamiTask, deviceToken: String) async {
        try? await api.ackTask(deviceToken: deviceToken, taskId: task.id, status: "acknowledged")

        if task.type == "system_command", let command = task.prompt, !SystemTools.isReadOnly(command: command) {
            do {
                try await api.requestApproval(deviceToken: deviceToken, taskId: task.id, command: command)
            } catch {
                try? await api.ackTask(
                    deviceToken: deviceToken,
                    taskId: task.id,
                    status: "failed",
                    result: "Could not request approval: \(error.localizedDescription)",
                )
            }
            return
        }

        do {
            let result = try await execute(task: task)
            try await api.ackTask(deviceToken: deviceToken, taskId: task.id, status: "completed", result: result)
        } catch {
            try? await api.ackTask(
                deviceToken: deviceToken,
                taskId: task.id,
                status: "failed",
                result: "\(error.localizedDescription)",
            )
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
            let output = try SystemTools.runCommand(command)
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
            // "Open X" is a real action, not something a tool-less LLM can
            // actually do — try it as an app-launch request first, and only
            // fall through to Claude Code if it doesn't look like one.
            if let appName = try? AppLauncher.extractAppName(from: prompt) {
                return try AppLauncher.open(appName: appName)
            }
            // Per the user's own routing preference: Claude Code (their paid
            // subscription) is reserved for actual development work; general
            // Q&A goes to the free OpenCode/NVIDIA route instead.
            if looksLikeDevelopmentRequest(prompt) {
                return try await ClaudeCodeProvider.run(prompt: prompt)
            }
            return try await OpenCodeProvider.run(prompt: prompt)

        case "calendar_today":
            return try MacIntegrations.todayEvents()

        case "create_note":
            return try MacIntegrations.createNote(title: task.title, body: task.prompt ?? "")

        case "create_reminder":
            return try MacIntegrations.createReminder(text: task.prompt ?? task.title, dueDate: nil)

        case "system_command":
            guard let command = task.prompt else { return "No command provided." }
            return try SystemTools.runCommand(command) // only reached when isReadOnly() already passed

        default:
            return "PAMI activated on \(DeviceIdentity.deviceName)."
        }
    }

    // A keyword heuristic, not real intent classification — good enough to
    // route the obvious "help me code/debug/build something" requests to
    // Claude Code while everything else (general questions, "what's the
    // capital of France", etc.) goes to the free OpenCode route.
    private let developmentKeywords = [
        "code", "coding", "bug", "debug", "function", "implement", "refactor",
        "compile", "repo", "repository", "git ", "commit", "pull request",
        "merge conflict", "npm ", "python", "swift", "javascript",
        "typescript", "api", "database", "sql", "script", "programming",
        "class ", "variable", "algorithm", "regex", "unit test",
        "stack trace", "build error", "xcode", "terminal command",
    ]

    private func looksLikeDevelopmentRequest(_ prompt: String) -> Bool {
        let lower = prompt.lowercased()
        return developmentKeywords.contains { lower.contains($0) }
    }
}

enum AppVersion {
    static let current = "0.1.0"
}
