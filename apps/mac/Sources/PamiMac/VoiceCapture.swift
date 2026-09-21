import AVFoundation
import Speech

// Menu Bar Voice mode (Section 8 of the spec): click, speak, get a
// transcription. This is silence-detected capture (stops shortly after you
// stop talking) rather than continuous wake-word listening — a robust
// always-on local wake word (openWakeWord/whisper.cpp) is a substantial
// project of its own and is deliberately deferred; see WakeWordListener.
// Uses Apple's on-device Speech framework (no network audio upload, no
// external model to install) rather than a paid cloud STT service,
// matching the spec's privacy requirement.
enum VoiceCapture {
    struct NotAuthorized: Error {}
    struct NoSpeechDetected: Error {}
    struct AudioEngineUnavailable: Error {}

    static func requestPermissions() async -> Bool {
        let speechStatus = await withCheckedContinuation { (continuation: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
        guard speechStatus == .authorized else { return false }

        let micGranted = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                continuation.resume(returning: granted)
            }
        }
        return micGranted
    }

    // Holds state written from the recognitionTask's completion handler
    // (which fires on an arbitrary queue, not necessarily the calling
    // task) and read from the polling loop below — an actor keeps that
    // cross-thread access safe without needing manual locking.
    private actor CaptureState {
        private(set) var latestText = ""
        private(set) var lastUpdate = Date()
        private(set) var finalText: String?
        private(set) var error: Error?

        func update(text: String) {
            latestText = text
            lastUpdate = Date()
        }
        func finish(text: String) { finalText = text }
        func fail(_ e: Error) { error = e }
    }

    // Starts recording, and stops automatically ~1.1s after you stop
    // talking (silence-detected), rather than always recording for a fixed
    // duration regardless of how long you actually spoke.
    static func captureOnce(maxDuration: TimeInterval = 15, silenceTimeout: TimeInterval = 1.1) async throws -> String {
        guard await requestPermissions() else { throw NotAuthorized() }

        guard let recognizer = SFSpeechRecognizer(), recognizer.isAvailable else {
            throw NotAuthorized()
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.contextualStrings = ["PAMI", "Notes", "Reminders", "Calendar", "Safari", "Finder"]
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        let engine = AVAudioEngine()
        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        // The input node reports a zero-channel/zero-rate format when mic
        // access isn't actually authorized yet (even if requestPermissions()
        // above returned true from a stale/cached TCC state) — installTap
        // with that format throws CoreAudio error -10877 immediately.
        guard format.sampleRate > 0, format.channelCount > 0 else {
            throw AudioEngineUnavailable()
        }

        let state = CaptureState()

        // Start recognition *before* audio starts flowing in, so partial
        // results stream live as the person talks — starting it only after
        // a fixed sleep (the previous version's bug) meant nothing was
        // transcribed until that whole window elapsed, no matter how short
        // the actual utterance was.
        let recognitionTask = recognizer.recognitionTask(with: request) { result, error in
            if let result {
                let text = result.bestTranscription.formattedString
                Task { await state.update(text: text) }
                if result.isFinal {
                    Task { await state.finish(text: text) }
                }
            } else if let error {
                Task { await state.fail(error) }
            }
        }

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        engine.prepare()
        try engine.start()

        defer {
            inputNode.removeTap(onBus: 0)
            engine.stop()
            recognitionTask.cancel()
        }

        let start = Date()
        while true {
            try await Task.sleep(for: .milliseconds(200))

            if let error = await state.error { throw error }
            if await state.finalText != nil { break }

            let text = await state.latestText
            let sinceUpdate = Date().timeIntervalSince(await state.lastUpdate)
            let sinceStart = Date().timeIntervalSince(start)

            if !text.isEmpty, sinceUpdate > silenceTimeout {
                break // went quiet after actually saying something — done talking
            }
            if sinceStart > maxDuration {
                break // safety cap regardless of ongoing speech
            }
        }

        request.endAudio()

        // endAudio() usually triggers a final result shortly after; give it
        // a brief grace period, but don't block indefinitely if it never
        // arrives — the last partial transcript is a fine fallback.
        if await state.finalText == nil {
            for _ in 0..<10 {
                if await state.finalText != nil { break }
                try? await Task.sleep(for: .milliseconds(150))
            }
        }

        let finalText: String
        if let final = await state.finalText {
            finalText = final
        } else {
            finalText = await state.latestText
        }
        let trimmed = finalText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw NoSpeechDetected() }
        return trimmed
    }
}
