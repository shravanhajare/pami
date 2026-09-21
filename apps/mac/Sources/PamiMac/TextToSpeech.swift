import Foundation

// Speaks Ask PAMI's text responses aloud when enabled. Uses the system
// `say` command rather than AVSpeechSynthesizer/AVAudioEngine — the voice
// *input* side (VoiceCapture/WakeWordListener) already had a painful
// history with AVAudioEngine's input-format edge cases, and `say` sidesteps
// all of that for output: it's a single fire-and-forget process using
// macOS's own default output device and voice, no audio session
// setup/permissions needed.
enum TextToSpeech {
    // Only ever one `say` process talking at a time in this app — tracked
    // so the overlay's Cancel button (see VoiceOverlay/HeartbeatLoop) can
    // stop it mid-sentence via stop() below.
    private static var activeProcess: Process?

    static func speak(_ text: String) {
        speak(text, onFinish: {})
    }

    // `onFinish` lets callers (HeartbeatLoop) drive the voice overlay's
    // "speaking" animation for exactly as long as `say` is actually
    // talking, rather than guessing a fixed duration. It still fires if
    // stop() cuts the process short, so callers don't need to special-case
    // a cancelled speech the way they do a cancelled Task.
    static func speak(_ text: String, onFinish: @escaping () -> Void) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            onFinish()
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/say")
        process.arguments = [trimmed]
        process.terminationHandler = { _ in
            Task { @MainActor in
                if activeProcess === process { activeProcess = nil }
                onFinish()
            }
        }
        do {
            try process.run()
            activeProcess = process
        } catch {
            onFinish()
        }
    }

    // Cuts off whatever's currently being spoken. Safe to call even when
    // nothing is speaking.
    static func stop() {
        activeProcess?.terminate()
    }
}
