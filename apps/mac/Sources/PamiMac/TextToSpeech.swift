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
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/say")
        process.arguments = [trimmed]
        // Deliberately not awaited/waited-on — this runs independently so
        // speaking a long response doesn't hold up the heartbeat loop.
        try? process.run()
    }
}
