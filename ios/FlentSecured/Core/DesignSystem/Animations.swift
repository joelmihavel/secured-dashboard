/// Animations.swift
/// Flent Secured v2 - Design System Animations
///
/// Source: Figma Design File - Flent-Secured_v1.2
/// Standardized animation timings and curves
///
/// Usage:
/// ```swift
/// withAnimation(Animations.spring) { }
/// .animation(Animations.pressResponse, value: isPressed)
/// DispatchQueue.main.asyncAfter(deadline: .now() + Animations.Duration.standard) { }
/// ```

import SwiftUI

// MARK: - Animations

enum Animations {

    // MARK: - Spring Animations

    /// Standard spring animation for sheets, modals, and most transitions
    /// Response: 0.3s, Damping: 0.8
    static let spring = Animation.spring(response: 0.3, dampingFraction: 0.8)

    /// Responsive spring for quick transitions like toasts
    /// Response: 0.3s
    static let springResponsive = Animation.spring(response: 0.3)

    /// Bouncy spring for playful interactions
    /// Response: 0.4s, Damping: 0.6
    static let springBouncy = Animation.spring(response: 0.4, dampingFraction: 0.6)

    // MARK: - Ease Animations

    /// Micro interaction for button press feedback
    /// Duration: 100ms
    static let pressResponse = Animation.easeInOut(duration: Duration.micro)

    /// Quick state change for tab switches
    /// Duration: 200ms
    static let tabSwitch = Animation.easeInOut(duration: Duration.quick)

    /// Standard transition
    /// Duration: 300ms
    static let standard = Animation.easeInOut(duration: Duration.standard)

    /// Emphasis animation for focus indicators
    /// Duration: 500ms
    static let emphasis = Animation.easeInOut(duration: Duration.emphasis)

    // MARK: - Repeating Animations

    /// Skeleton loading shimmer
    /// Duration: 1500ms, repeats forever
    static let shimmer = Animation.linear(duration: Duration.shimmer).repeatForever(autoreverses: false)

    /// Loading dots animation
    /// Duration: 600ms, repeats forever
    static let loadingDots = Animation.easeInOut(duration: Duration.loading).repeatForever()

    /// Cursor blink animation
    /// Duration: 500ms, repeats with autoreverse
    static let cursorBlink = Animation.easeInOut(duration: Duration.emphasis).repeatForever(autoreverses: true)

    /// Pulse animation for attention
    /// Duration: 1000ms, repeats with autoreverse
    static let pulse = Animation.easeInOut(duration: 1.0).repeatForever(autoreverses: true)

    // MARK: - Durations

    enum Duration {
        /// 100ms - Micro-interactions (button press, hover)
        static let micro: TimeInterval = 0.1

        /// 200ms - Quick state changes (tab switch, toggle)
        static let quick: TimeInterval = 0.2

        /// 300ms - Standard transitions (sheets, modals)
        static let standard: TimeInterval = 0.3

        /// 500ms - Emphasis animations (cursor blink, focus)
        static let emphasis: TimeInterval = 0.5

        /// 600ms - Loading states (dots animation)
        static let loading: TimeInterval = 0.6

        /// 1500ms - Long running (skeleton shimmer)
        static let shimmer: TimeInterval = 1.5

        /// 3000ms - Toast auto-dismiss
        static let toastDismiss: TimeInterval = 3.0

        /// Stagger delay for sequential animations
        static let staggerDelay: TimeInterval = 0.05
    }

    // MARK: - Easing Curves

    enum Curve {
        /// Standard ease-in-out for most animations
        static let standard = Animation.easeInOut

        /// Ease-out for elements entering the screen
        static let enter = Animation.easeOut

        /// Ease-in for elements leaving the screen
        static let exit = Animation.easeIn

        /// Linear for continuous animations
        static let linear = Animation.linear
    }
}

// MARK: - Staggered Animation Helper

extension View {
    /// Apply staggered animation with delay based on index
    func staggeredAnimation(index: Int, animation: Animation = Animations.spring) -> some View {
        self.animation(
            animation.delay(Double(index) * Animations.Duration.staggerDelay),
            value: index
        )
    }
}

// MARK: - Transition Presets

extension AnyTransition {
    /// Slide up from bottom with opacity
    static var slideUp: AnyTransition {
        .asymmetric(
            insertion: .move(edge: .bottom).combined(with: .opacity),
            removal: .move(edge: .bottom).combined(with: .opacity)
        )
    }

    /// Slide from leading edge
    static var slideFromLeading: AnyTransition {
        .asymmetric(
            insertion: .move(edge: .leading),
            removal: .move(edge: .trailing)
        )
    }

    /// Scale with opacity for popovers
    static var scaleOpacity: AnyTransition {
        .scale.combined(with: .opacity)
    }

    /// Blur transition for overlays
    static var blur: AnyTransition {
        .opacity
    }
}

// MARK: - Animated Value Property Wrapper

/// Property wrapper for values that animate automatically
@propertyWrapper
struct Animated<Value: Equatable>: DynamicProperty {
    @State private var internalValue: Value
    private let animation: Animation

    var wrappedValue: Value {
        get { internalValue }
        nonmutating set {
            withAnimation(animation) {
                internalValue = newValue
            }
        }
    }

    var projectedValue: Binding<Value> {
        Binding(
            get: { internalValue },
            set: { newValue in
                withAnimation(animation) {
                    internalValue = newValue
                }
            }
        )
    }

    init(wrappedValue: Value, animation: Animation = Animations.spring) {
        self._internalValue = State(initialValue: wrappedValue)
        self.animation = animation
    }
}

// MARK: - Preview

#Preview("Animation Showcase") {
    AnimationShowcaseView()
}

private struct AnimationShowcaseView: View {
    @State private var isPressed = false
    @State private var showSheet = false
    @State private var loadingPhase: CGFloat = 0

    var body: some View {
        VStack(spacing: 24) {
            // Press animation
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.green)
                .frame(height: 56)
                .scaleEffect(isPressed ? 0.98 : 1.0)
                .opacity(isPressed ? 0.9 : 1.0)
                .animation(Animations.pressResponse, value: isPressed)
                .onTapGesture {
                    isPressed = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        isPressed = false
                    }
                }
                .overlay(
                    Text("Tap Me")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.black)
                )

            // Loading shimmer
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.gray.opacity(0.3))
                .frame(height: 20)
                .overlay(
                    GeometryReader { geometry in
                        LinearGradient(
                            gradient: Gradient(colors: [
                                .clear,
                                Color.white.opacity(0.3),
                                .clear
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geometry.size.width * 0.7)
                        .offset(x: -geometry.size.width * 0.35 + loadingPhase * geometry.size.width * 1.35)
                    }
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .onAppear {
                    withAnimation(Animations.shimmer) {
                        loadingPhase = 1
                    }
                }

            // Spring button
            Button("Show Sheet") {
                showSheet.toggle()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .background(Color.black)
        .sheet(isPresented: $showSheet) {
            Text("Sheet Content")
                .presentationDetents([.medium])
        }
    }
}
