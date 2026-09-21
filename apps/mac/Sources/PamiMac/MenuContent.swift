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

        Toggle("Pause PAMI", isOn: $appState.isPaused)

        Divider()

        Button("Quit") {
            NSApplication.shared.terminate(nil)
        }
    }

    private func startVoiceCapture() {
        appState.isListening = true
        appState.voiceStatus = "Listening…"
        VoiceOverlay.shared.showListening()
        Task {
            do {
                let text = try await VoiceCapture.captureOnce()
                appState.voiceStatus = "Heard: \(text)"
                VoiceOverlay.shared.showHeard(text)
                try await heartbeatLoop.createAskTask(appState: appState, prompt: text)
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
