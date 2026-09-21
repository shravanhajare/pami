import Foundation

// Speaks Ask PAMI's text responses aloud when enabled. Uses the system
// `say` command rather than AVSpeechSynthesizer/AVAudioEngine — the voice
// *input* side (VoiceCapture/WakeWordListener) already had a painful
// history with AVAudioEngine's input-format edge cases, and `say` sidesteps
// all of that for output: it's a single fire-and-forget process using
// macOS's own default output device and voice, no audio session
// setup/permissions needed.
enum TextToSpeech {
    static func speak(_ text: String) {
        speak(text, onFinish: {})
    }

    // `onFinish` lets callers (HeartbeatLoop) drive the voice overlay's
    // "speaking" animation for exactly as long as `say` is actually
    // talking, rather than guessing a fixed duration.
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
            Task { @MainActor in onFinish() }
        }
        do {
            try process.run()
        } catch {
            onFinish()
        }
    }
}
