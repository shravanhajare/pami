import SwiftUI
import AppKit

// Dark/yellow brand gradient — pale gold -> amber -> deep amber-orange,
// mirroring apps/web/app/globals.css's --pami-blue/purple/pink (same
// variable names there for historical reasons, but same three stops) so the
// Mac and website feel like one product.
let pamiGradientColors: [Color] = [
    Color(red: 0.98, green: 0.87, blue: 0.45),
    Color(red: 0.96, green: 0.75, blue: 0.20),
    Color(red: 0.88, green: 0.55, blue: 0.15),
]

// A Siri-style floating indicator shown while PAMI is listening/thinking/
// speaking — the menu bar's status text alone is invisible unless you
// happen to have the menu open, which defeats the point of a hands-free
// "Hey PAMI" flow. Lives top-right, out of the way of the menu bar icon
// itself (top-center/top-left collide with the notch and other menu items
// on most Mac laptop screens).
@MainActor
final class VoiceOverlay {
    static let shared = VoiceOverlay()

    private var panel: NSPanel?
    private let state = VoiceOverlayState()
    private var hideTask: Task<Void, Never>?

    func showListening() {
        hideTask?.cancel()
        withAnimation(.easeOut(duration: 0.2)) {
            state.phase = .listening
            state.message = nil
        }
        ensureWindow()
        panel?.orderFrontRegardless()
    }

    // Between "heard you" and having a result — the request is off being
    // worked on (Claude Code / OpenCode / AppleScript automation).
    func showThinking() {
        hideTask?.cancel()
        withAnimation(.easeOut(duration: 0.2)) {
            state.phase = .thinking
        }
        ensureWindow()
        panel?.orderFrontRegardless()
    }

    // While `say` is actually talking — see TextToSpeech.speak(_:onFinish:).
    func showSpeaking() {
        hideTask?.cancel()
        withAnimation(.easeOut(duration: 0.2)) {
            state.phase = .speaking
        }
        ensureWindow()
        panel?.orderFrontRegardless()
    }

    func showHeard(_ text: String) {
        hideTask?.cancel()
        withAnimation(.easeOut(duration: 0.2)) {
            state.phase = .heard
            state.message = text
        }
        ensureWindow()
        panel?.orderFrontRegardless()
        scheduleHide(after: 1.6)
    }

    func showError(_ text: String) {
        hideTask?.cancel()
        withAnimation(.easeOut(duration: 0.2)) {
            state.phase = .error
            state.message = text
        }
        ensureWindow()
        panel?.orderFrontRegardless()
        scheduleHide(after: 3)
    }

    func hide() {
        hideTask?.cancel()
        withAnimation(.easeIn(duration: 0.25)) {
            state.visible = false
        }
        Task {
            try? await Task.sleep(for: .milliseconds(250))
            self.panel?.orderOut(nil)
        }
    }

    private func scheduleHide(after seconds: TimeInterval) {
        hideTask?.cancel()
        hideTask = Task {
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            self.hide()
        }
    }

    private func ensureWindow() {
        state.visible = true
        guard panel == nil else { return }

        let hosting = NSHostingView(rootView: VoiceOverlayView(state: state))
        hosting.frame = NSRect(x: 0, y: 0, width: 240, height: 72)

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
            // Top-right, tucked just under the menu bar and in from the
            // screen edge — clear of the notch/menu-bar icons that live at
            // top-center and top-left.
            let x = screen.visibleFrame.maxX - hosting.frame.width - 16
            let y = screen.frame.maxY - hosting.frame.height - 8
            panel.setFrameOrigin(NSPoint(x: x, y: y))
        }

        self.panel = panel
    }
}

@MainActor
final class VoiceOverlayState: ObservableObject {
    enum Phase { case listening, thinking, speaking, heard, error }
    @Published var phase: Phase = .listening
    @Published var message: String?
    @Published var visible: Bool = true
}

private struct VoiceOverlayView: View {
    @ObservedObject var state: VoiceOverlayState

    var body: some View {
        HStack(spacing: 12) {
            NucleusView(phase: state.phase)
                .frame(width: 34, height: 34)

            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.black.opacity(0.82), in: Capsule())
        .overlay(
            Capsule().strokeBorder(
                LinearGradient(
                    colors: pamiGradientColors.map { $0.opacity(0.5) },
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing,
                ),
                lineWidth: 1,
            ),
        )
        .shadow(color: pamiGradientColors[1].opacity(0.35), radius: 16, y: 4)
        .scaleEffect(state.visible ? 1 : 0.85)
        .opacity(state.visible ? 1 : 0)
    }

    private var label: String {
        switch state.phase {
        case .listening: return "Listening…"
        case .thinking: return "Thinking…"
        case .speaking: return "Speaking…"
        case .heard: return state.message ?? "Got it"
        case .error: return state.message ?? "Something went wrong"
        }
    }
}

// The "nucleus": a glowing core with particles orbiting it, like a tiny
// atom — distinct motion per phase so a glance tells you what PAMI is
// doing without reading the label: a slow steady orbit while listening,
// a faster tightly-wound spin while thinking, and a pulsing burst in sync
// with speech while speaking.
private struct NucleusView: View {
    let phase: VoiceOverlayState.Phase

    var body: some View {
        TimelineView(.animation) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            Canvas { context, size in
                let center = CGPoint(x: size.width / 2, y: size.height / 2)
                draw(context: context, center: center, size: size, t: t)
            }
        }
    }

    private func draw(context: GraphicsContext, center: CGPoint, size: CGSize, t: TimeInterval) {
        let colors = pamiGradientColors
        let coreRadius: CGFloat = coreRadius(t: t)

        // Glow behind the core.
        let glow = context
        var glowContext = glow
        glowContext.addFilter(.blur(radius: 4))
        glowContext.opacity = 0.55
        glowContext.fill(
            Path(ellipseIn: CGRect(
                x: center.x - coreRadius - 3, y: center.y - coreRadius - 3,
                width: (coreRadius + 3) * 2, height: (coreRadius + 3) * 2,
            )),
            with: .linearGradient(
                Gradient(colors: colors),
                startPoint: CGPoint(x: center.x - coreRadius, y: center.y - coreRadius),
                endPoint: CGPoint(x: center.x + coreRadius, y: center.y + coreRadius),
            ),
        )

        // Core.
        context.fill(
            Path(ellipseIn: CGRect(
                x: center.x - coreRadius, y: center.y - coreRadius,
                width: coreRadius * 2, height: coreRadius * 2,
            )),
            with: .linearGradient(
                Gradient(colors: colors),
                startPoint: CGPoint(x: center.x - coreRadius, y: center.y - coreRadius),
                endPoint: CGPoint(x: center.x + coreRadius, y: center.y + coreRadius),
            ),
        )

        // Orbiting particles.
        let particleCount = phase == .thinking ? 3 : 2
        let orbitRadius = size.width / 2 - 2
        for i in 0..<particleCount {
            let speed = orbitSpeed
            let phaseOffset = (Double(i) / Double(particleCount)) * 2 * .pi
            let angle = t * speed + phaseOffset
            let radius = orbitRadius * orbitRadiusScale(index: i, t: t)
            let x = center.x + CGFloat(cos(angle)) * radius
            let y = center.y + CGFloat(sin(angle)) * radius
            let dotSize: CGFloat = phase == .thinking ? 3.5 : 3

            context.fill(
                Path(ellipseIn: CGRect(x: x - dotSize / 2, y: y - dotSize / 2, width: dotSize, height: dotSize)),
                with: .color(colors[i % colors.count].opacity(0.9)),
            )
        }
    }

    private var orbitSpeed: Double {
        switch phase {
        case .listening: return 1.1
        case .thinking: return 3.2
        case .speaking: return 1.6
        case .heard: return 0.4
        case .error: return 0.2
        }
    }

    private func coreRadius(t: TimeInterval) -> CGFloat {
        let base: CGFloat = 7
        switch phase {
        case .listening:
            // Gentle steady breathing while waiting for you to talk.
            return base + CGFloat(sin(t * 2.4)) * 1.6
        case .thinking:
            // Tighter, quicker flicker — visibly "working".
            return base + CGFloat(sin(t * 6)) * 1.0
        case .speaking:
            // Bigger, punchier pulse suggesting an active voice.
            return base + CGFloat(abs(sin(t * 5))) * 3.2
        case .heard:
            return base + 1
        case .error:
            return base
        }
    }

    private func orbitRadiusScale(index: Int, t: TimeInterval) -> Double {
        phase == .thinking ? 0.9 + 0.1 * sin(t * 4 + Double(index)) : 1.0
    }
}
