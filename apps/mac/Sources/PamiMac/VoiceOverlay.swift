import SwiftUI
import AppKit

// A Siri-style floating indicator shown while PAMI is listening/processing
// a voice request — the menu bar's status text alone is invisible unless
// you happen to have the menu open, which defeats the point of a
// hands-free "Hey PAMI" flow.
@MainActor
final class VoiceOverlay {
    static let shared = VoiceOverlay()

    private var panel: NSPanel?
    private let state = VoiceOverlayState()

    func showListening() {
        state.phase = .listening
        state.message = nil
        ensureWindow()
        panel?.orderFrontRegardless()
    }

    func showHeard(_ text: String) {
        state.phase = .heard
        state.message = text
        scheduleHide(after: 2.5)
    }

    func showError(_ text: String) {
        state.phase = .error
        state.message = text
        scheduleHide(after: 3)
    }

    func hide() {
        panel?.orderOut(nil)
    }

    private func scheduleHide(after seconds: TimeInterval) {
        Task {
            try? await Task.sleep(for: .seconds(seconds))
            self.hide()
        }
    }

    private func ensureWindow() {
        guard panel == nil else { return }

        let hosting = NSHostingView(rootView: VoiceOverlayView(state: state))
        hosting.frame = NSRect(x: 0, y: 0, width: 300, height: 60)

        let panel = NSPanel(
            contentRect: hosting.frame,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false,
        )
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.level = .floating
        panel.ignoresMouseEvents = true
        panel.hasShadow = true
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        panel.contentView = hosting

        if let screen = NSScreen.main {
            let x = screen.frame.midX - hosting.frame.width / 2
            let y = screen.frame.maxY - 140
            panel.setFrameOrigin(NSPoint(x: x, y: y))
        }

        self.panel = panel
    }
}

@MainActor
final class VoiceOverlayState: ObservableObject {
    enum Phase { case listening, heard, error }
    @Published var phase: Phase = .listening
    @Published var message: String?
}

private struct VoiceOverlayView: View {
    @ObservedObject var state: VoiceOverlayState
    @State private var pulse = false

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.blue, .purple, .pink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing,
                        ),
                    )
                    .frame(width: 32, height: 32)
                    .scaleEffect(state.phase == .listening && pulse ? 1.15 : 1.0)
                    .animation(
                        state.phase == .listening
                            ? .easeInOut(duration: 0.7).repeatForever(autoreverses: true)
                            : .default,
                        value: pulse,
                    )
                Image(systemName: iconName)
                    .foregroundStyle(.white)
                    .font(.system(size: 13, weight: .semibold))
            }
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.black.opacity(0.8), in: Capsule())
        .onAppear { pulse = true }
    }

    private var iconName: String {
        switch state.phase {
        case .listening: return "waveform"
        case .heard: return "checkmark"
        case .error: return "exclamationmark.triangle"
        }
    }

    private var label: String {
        switch state.phase {
        case .listening: return "Listening…"
        case .heard: return state.message ?? "Got it"
        case .error: return state.message ?? "Something went wrong"
        }
    }
}
