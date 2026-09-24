import SwiftUI
import AppKit

struct MenuContent: View {
    @EnvironmentObject var appState: AppState
    let heartbeatLoop: HeartbeatLoop

    var body: some View {
        Text(appState.statusLabel)

        Divider()

        Button("Activate PAMI") {
            Task { await heartbeatLoop.createTask(appState: appState) }
        }
        .disabled(appState.connectionState != .connected)

        Button(appState.isListening ? "Listening…" : "Voice Mode") {
            startVoiceCapture()
        }
        .disabled(appState.connectionState != .connected || appState.isListening || appState.isWakeWordActive)

        Toggle("Wake Word (\"Hey PAMI\")", isOn: Binding(
            get: { appState.isWakeWordActive },
            set: { enabled in
                if enabled {
                    Task { await WakeWordListener.shared.start(appState: appState) }
                } else {
                    Task {
                        await WakeWordListener.shared.stop()
                        appState.isWakeWordActive = false
                        appState.voiceStatus = nil
                    }
                }
            },
        ))
        .disabled(appState.connectionState != .connected)

        // Read-only here on purpose: the website's Settings page is the one
        // place this is controlled (per the user's request that audio be a
        // website-only toggle, not something each Mac decides locally).
        Text("Speak Responses: \(appState.voiceResponsesEnabled ? "On" : "Off") (in dashboard)")

        if let voiceStatus = appState.voiceStatus {
            Text(voiceStatus)
        }

        Button("Open Dashboard") {
            NSWorkspace.shared.open(Config.dashboardURL)
        }

        Divider()

        if let task = appState.currentTask {
            Text("Current: \(task.title)")
        } else {
            Text("No active task")
        }

        Divider()

        if LoginItem.needsApproval {
            Button("Approve Launch at Login…") {
                LoginItem.openLoginItemsSettings()
            }
        } else {
            Toggle("Launch at Login", isOn: Binding(
                get: { LoginItem.isEnabled },
                set: { enabled in
                    if enabled { LoginItem.register() } else { LoginItem.unregister() }
                },
            ))
        }

        Menu("Full Mac Access") {
            ForEach(Permissions.Kind.allCases, id: \.self) { kind in
                Button("\(statusMark(kind.isGranted)) \(kind.title)") {
                    kind.request()
                }
            }
            Button("Allow All Apps Now…") {
                appState.voiceStatus = "Approving app control — click Allow on each dialog…"
                DispatchQueue.global(qos: .userInitiated).async {
                    let result = Permissions.requestAllAutomation()
                    DispatchQueue.main.async {
                        appState.voiceStatus = "App control: \(result.granted)/\(result.total) apps allowed."
                    }
                }
            }
            Divider()
            Button("New Conversation (forget context)") {
                ClaudeCodeProvider.resetConversation()
            }
        }

        // The kill switch for full access: paused, PAMI stops picking up
        // tasks entirely (see HeartbeatLoop).
        Toggle("Pause PAMI", isOn: $appState.isPaused)

        Divider()

        Button("Quit") {
            NSApplication.shared.terminate(nil)
        }
    }

    private func statusMark(_ granted: Bool?) -> String {
        switch granted {
        case .some(true): return "✓"
        case .some(false): return "○"
        case .none: return "•"
        }
    }

    private func startVoiceCapture() {
        appState.isListening = true
        appState.voiceStatus = "Listening…"
        // Wrapped in its own Task (rather than awaited inline in the outer
        // one below) so the overlay's Cancel button has something to call
        // .cancel() on.
        let captureTask = Task { try await VoiceCapture.captureOnce() }
        VoiceOverlay.shared.showListening(onCancel: { captureTask.cancel() })
        Task {
            do {
                let text = try await captureTask.value
                appState.voiceStatus = "Heard: \(text)"
                VoiceOverlay.shared.showHeard(text)
                appState.voiceTaskInFlight = true
                try await heartbeatLoop.createAskTask(appState: appState, prompt: text)
            } catch is CancellationError {
                appState.voiceStatus = "Cancelled."
                VoiceOverlay.shared.hide()
            } catch is VoiceCapture.NotAuthorized {
                appState.voiceStatus = "Microphone/Speech Recognition access needed — check System Settings > Privacy."
                VoiceOverlay.shared.showError("Need Microphone/Speech access")
            } catch is VoiceCapture.AudioEngineUnavailable {
                appState.voiceStatus = "Microphone access not granted yet — check System Settings > Privacy & Security > Microphone."
                VoiceOverlay.shared.showError("Microphone access needed")
            } catch is VoiceCapture.NoSpeechDetected {
                appState.voiceStatus = "Didn't catch anything."
                VoiceOverlay.shared.showError("Didn't catch anything")
            } catch {
                appState.voiceStatus = "Voice capture failed: \(error.localizedDescription)"
                VoiceOverlay.shared.showError("Voice capture failed")
            }
            appState.isListening = false
        }
    }
}
