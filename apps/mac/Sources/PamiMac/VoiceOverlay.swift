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
    private var hosting: NSHostingView<VoiceOverlayView>?
    private let state = VoiceOverlayState()
    private var hideTask: Task<Void, Never>?

    // `onCancel` is offered for every phase where something's actually in
    // flight and worth stopping (listening for your voice, a request being
    // worked on, or a response being read aloud) — not for .heard/.error,
    // which are already-resolved outcomes that dismiss on their own.
    func showListening(onCancel: (() -> Void)? = nil) {
        hideTask?.cancel()
        withAnimation(.easeOut(duration: 0.2)) {
            state.phase = .listening
            state.message = nil
            state.onCancel = onCancel
        }
        ensureWindow()
        panel?.orderFrontRegardless()
    }

    // Between "heard you" and having a result — the request is off being
    // worked on (Claude Code / OpenCode / AppleScript automation).
    func showThinking(onCancel: (() -> Void)? = nil) {
        hideTask?.cancel()
        withAnimation(.easeOut(duration: 0.2)) {
            state.phase = .thinking
            state.onCancel = onCancel
        }
        ensureWindow()
        panel?.orderFrontRegardless()
    }

    // While `say` is actually talking — see TextToSpeech.speak(_:onFinish:).
    func showSpeaking(onCancel: (() -> Void)? = nil) {
        hideTask?.cancel()
        withAnimation(.easeOut(duration: 0.2)) {
            state.phase = .speaking
            state.onCancel = onCancel
        }
        ensureWindow()
        panel?.orderFrontRegardless()
    }

    func showHeard(_ text: String) {
        hideTask?.cancel()
        withAnimation(.easeOut(duration: 0.2)) {
            state.phase = .heard
            state.message = text
            state.onCancel = nil
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
            state.onCancel = nil
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

        // The bubble's width varies a lot by phase — "Thinking…" vs. a full
        // transcribed sentence in .heard — so it can't be given one static
        // frame. state.onSizeChange is fed by a GeometryReader inside
        // VoiceOverlayView (below) reporting SwiftUI's own measured content
        // size on every layout pass, and applyContentSize(_:) below resizes
        // the actual NSPanel to match, anchored to the same top-right
        // corner. Without this, a fixed NSHostingView frame either clips
        // long text or forces short labels to wrap mid-word into a box far
        // narrower than intended.
        state.onSizeChange = { [weak self] size in
            self?.applyContentSize(size)
        }

        let hosting = NSHostingView(rootView: VoiceOverlayView(state: state))
        let initialSize = NSSize(width: 220, height: 54)
        hosting.frame = NSRect(origin: .zero, size: initialSize)

        let panel = NSPanel(
            contentRect: hosting.frame,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false,
        )
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.level = .floating
        // false so the Cancel button is actually clickable — the panel is
        // sized to hug its content (see applyContentSize below), so this
        // only ever intercepts clicks within the small bubble itself, not
        // the rest of the screen.
        panel.ignoresMouseEvents = false
        panel.hasShadow = true
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        panel.contentView = hosting

        if let screen = NSScreen.main {
            // Top-right, tucked just under the menu bar and in from the
            // screen edge — clear of the notch/menu-bar icons that live at
            // top-center and top-left.
            let x = screen.visibleFrame.maxX - initialSize.width - 16
            let y = screen.frame.maxY - initialSize.height - 8
            panel.setFrameOrigin(NSPoint(x: x, y: y))
        }

        self.panel = panel
        self.hosting = hosting
    }

    private func applyContentSize(_ size: CGSize) {
        guard let panel, let hosting, size.width > 1, size.height > 1 else { return }
        let width = ceil(size.width)
        let height = ceil(size.height)
        guard let screen = NSScreen.main else { return }

        // Right edge and top edge stay put; only the left edge and bottom
        // edge move as the bubble grows/shrinks, so it never drifts away
        // from its top-right anchor as the label changes.
        let x = screen.visibleFrame.maxX - width - 16
        let topY = screen.frame.maxY - 8
        let y = topY - height

        hosting.setFrameSize(NSSize(width: width, height: height))
        panel.setFrame(NSRect(x: x, y: y, width: width, height: height), display: true)
    }
}

@MainActor
final class VoiceOverlayState: ObservableObject {
    enum Phase { case listening, thinking, speaking, heard, error }
    @Published var phase: Phase = .listening
    @Published var message: String?
    @Published var visible: Bool = true

    // Not @Published on purpose — set once by VoiceOverlay.ensureWindow(),
    // called from VoiceOverlayView's GeometryReader on every layout pass to
    // report SwiftUI's real measured size back out to the owning NSPanel.
    var onSizeChange: ((CGSize) -> Void)?

    // Set alongside `phase` in each show*(onCancel:) call above, so a
    // change here always rides along with a `phase` change that SwiftUI
    // already re-renders for — nil hides the Cancel button entirely.
    var onCancel: (() -> Void)?
}

private struct OverlaySizeKey: PreferenceKey {
    static var defaultValue: CGSize = .zero
    static func reduce(value: inout CGSize, nextValue: () -> CGSize) {
        value = nextValue()
    }
}

private struct VoiceOverlayView: View {
    @ObservedObject var state: VoiceOverlayState

    // Short phase labels ("Thinking…") must never wrap — that's what was
    // producing the mid-word "Thinki"/"ng…" cutoff. Only .heard/.error can
    // carry a longer, unpredictable string (a full transcribed sentence, or
    // an error message), so only those get a second line and a width cap
    // to wrap within instead of growing the bubble arbitrarily wide.
    private var isLongForm: Bool {
        state.phase == .heard || state.phase == .error
    }

    var body: some View {
        HStack(spacing: 12) {
            NucleusView(phase: state.phase)
                .frame(width: 34, height: 34)

            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white)
                .lineLimit(isLongForm ? 2 : 1)
                .fixedSize(horizontal: !isLongForm, vertical: true)
                .frame(maxWidth: isLongForm ? 260 : nil, alignment: .leading)

            if let onCancel = state.onCancel {
                Button(action: onCancel) {
                    Image(systemName: "xmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white.opacity(0.85))
                        .frame(width: 20, height: 20)
                        .background(.white.opacity(0.15), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Cancel")
            }
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
        .fixedSize()
        .background(
            GeometryReader { proxy in
                Color.clear
                    .onAppear { state.onSizeChange?(proxy.size) }
                    .onChange(of: proxy.size) { newSize in state.onSizeChange?(newSize) }
                    .preference(key: OverlaySizeKey.self, value: proxy.size)
            },
        )
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
