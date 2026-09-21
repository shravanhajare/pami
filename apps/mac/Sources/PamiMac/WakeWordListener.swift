import AVFoundation
import Speech

// "Hey PAMI" activation. This is NOT a dedicated wake-word model
// (openWakeWord/Porcupine-style) — those run a tiny, purpose-built model
// that idles at near-zero cost and need a separate runtime to bundle. This
// instead keeps Apple's on-device Speech framework continuously
// transcribing and watches partial results for the phrase, which is
// heavier on CPU/battery than a real wake-word model but works today with
// zero extra dependencies. Fully on-device — no audio leaves the Mac.
// Revisit with a dedicated model if battery impact matters in practice.
actor WakeWordListener {
    static let shared = WakeWordListener()

    private var engine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var running = false
    private var consecutiveFailures = 0

    // "PAMI" isn't a real word, so generic dictation has no vocabulary
    // entry for it and will often transcribe it as something else
    // ("pommy", "palmy", "bami", "happy me", ...). contextualStrings below
    // biases the recognizer toward it; this list is a fallback net for
    // whatever still gets mis-transcribed.
    private let wakePhrases = [
        "hey pami", "hey, pami", "pami", "hey pommy", "hey palmy",
        "hey bami", "hey pommie", "hey pam e", "hey pam i",
    ]
    private let maxConsecutiveFailures = 3

    func start(appState: AppState) async {
        guard !running else { return }
        guard await VoiceCapture.requestPermissions() else {
            await MainActor.run {
                appState.isWakeWordActive = false
                appState.voiceStatus = "Wake word needs Microphone + Speech Recognition access — check System Settings > Privacy & Security."
            }
            return
        }
        guard let recognizer = SFSpeechRecognizer(), recognizer.isAvailable else {
            await MainActor.run {
                appState.isWakeWordActive = false
                appState.voiceStatus = "Speech recognizer unavailable for this language/region."
            }
            return
        }

        running = true
        consecutiveFailures = 0
        await MainActor.run { appState.isWakeWordActive = true }
        await listenSegment(recognizer: recognizer, appState: appState)
    }

    func stop() {
        running = false
        teardown()
    }

    private func teardown() {
        engine?.inputNode.removeTap(onBus: 0)
        engine?.stop()
        request?.endAudio()
        recognitionTask?.cancel()
        engine = nil
        request = nil
        recognitionTask = nil
    }

    // Recognition tasks don't run forever, and partial-result-only listening
    // needs periodic restarts anyway — each "segment" listens until either
    // the wake phrase is heard or SFSpeechRecognizer times out/errors on its
    // own, then starts a new segment while `running` is true. A segment
    // that fails immediately (e.g. mic access not actually granted) backs
    // off and eventually gives up instead of hammering CoreAudio/TCC in a
    // tight loop — which is what happened before this fix.
    private func listenSegment(recognizer: SFSpeechRecognizer, appState: AppState) async {
        guard running else { return }

        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        // Biases the recognizer's language model toward this custom
        // vocabulary — the actual fix for an invented word like "PAMI"
        // having no dictionary entry, rather than just hoping a lucky
        // mis-transcription happens to match the fallback list above.
        request.contextualStrings = ["PAMI", "Hey PAMI", "Hey, PAMI"]
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        self.engine = engine
        self.request = request

        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            // The input node reports an invalid format when mic access
            // isn't actually authorized yet — starting the engine here
            // would just throw repeatedly (CoreAudio error -10877).
            await failSegment(appState: appState, message: "Microphone access not granted yet.")
            return
        }

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        do {
            engine.prepare()
            try engine.start()
        } catch {
            await failSegment(appState: appState, message: "Couldn't start audio engine: \(error.localizedDescription)")
            return
        }

        let heard = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            var didResume = false
            recognitionTask = recognizer.recognitionTask(with: request) { result, error in
                if let result {
                    let text = result.bestTranscription.formattedString.lowercased()
                    if self.wakePhrases.contains(where: { text.contains($0) }), !didResume {
                        didResume = true
                        continuation.resume(returning: true)
                    } else if result.isFinal, !didResume {
                        didResume = true
                        continuation.resume(returning: false)
                    }
                } else if error != nil, !didResume {
                    didResume = true
                    continuation.resume(returning: false)
                }
            }
        }

        teardown()
        guard running else { return }

        if heard {
            consecutiveFailures = 0
            await MainActor.run {
                appState.voiceStatus = "Heard \"Hey PAMI\" — listening…"
                VoiceOverlay.shared.showListening()
            }
            do {
                let text = try await VoiceCapture.captureOnce()
                await MainActor.run {
                    appState.voiceStatus = "Heard: \(text)"
                    VoiceOverlay.shared.showHeard(text)
                    appState.voiceTaskInFlight = true
                }
                try await HeartbeatLoop.shared.createAskTask(appState: appState, prompt: text)
            } catch {
                await MainActor.run {
                    appState.voiceStatus = "Didn't catch a request after the wake word."
                    VoiceOverlay.shared.showError("Didn't catch that")
                }
            }
            await listenSegment(recognizer: recognizer, appState: appState)
        } else {
            // A normal timeout with no wake phrase heard is expected and
            // common — restart immediately, it's not a failure.
            consecutiveFailures = 0
            await listenSegment(recognizer: recognizer, appState: appState)
        }
    }

    private func failSegment(appState: AppState, message: String) async {
        teardown()
        consecutiveFailures += 1

        if consecutiveFailures >= maxConsecutiveFailures {
            running = false
            await MainActor.run {
                appState.isWakeWordActive = false
                appState.voiceStatus = "Wake word stopped: \(message)"
            }
            return
        }

        try? await Task.sleep(for: .seconds(2))
        guard running else { return }
        if let recognizer = SFSpeechRecognizer(), recognizer.isAvailable {
            await listenSegment(recognizer: recognizer, appState: appState)
        }
    }
}
