/// LottieView.swift
/// Flent Secured v2 - Lottie Animation Wrapper
///
/// SwiftUI wrapper for Lottie animations

import SwiftUI
import Lottie

// MARK: - Lottie View

struct LottieView: UIViewRepresentable {
    let name: String
    var loopMode: LottieLoopMode = .loop
    var speed: CGFloat = 1.0
    var contentMode: UIView.ContentMode = .scaleAspectFit
    @Binding var isPlaying: Bool

    init(
        name: String,
        loopMode: LottieLoopMode = .loop,
        speed: CGFloat = 1.0,
        contentMode: UIView.ContentMode = .scaleAspectFit,
        isPlaying: Binding<Bool> = .constant(true)
    ) {
        self.name = name
        self.loopMode = loopMode
        self.speed = speed
        self.contentMode = contentMode
        self._isPlaying = isPlaying
    }

    func makeUIView(context: Context) -> LottieAnimationView {
        let animationView = LottieAnimationView(name: name)
        animationView.loopMode = loopMode
        animationView.animationSpeed = speed
        animationView.contentMode = contentMode
        animationView.backgroundBehavior = .pauseAndRestore

        if isPlaying {
            animationView.play()
        }

        return animationView
    }

    func updateUIView(_ uiView: LottieAnimationView, context: Context) {
        if isPlaying && !uiView.isAnimationPlaying {
            uiView.play()
        } else if !isPlaying && uiView.isAnimationPlaying {
            uiView.pause()
        }
    }
}

// MARK: - Predefined Animations

extension LottieView {
    /// Loading spinner animation
    static var loading: LottieView {
        LottieView(name: "loading", loopMode: .loop)
    }

    /// Payment success animation (plays once)
    static var paymentSuccess: LottieView {
        LottieView(name: "payment_success", loopMode: .playOnce)
    }

    /// Payment failed animation (plays once)
    static var paymentFailed: LottieView {
        LottieView(name: "payment_failed", loopMode: .playOnce)
    }

    /// Confetti celebration
    static var confetti: LottieView {
        LottieView(name: "confetti", loopMode: .playOnce, speed: 1.2)
    }

    /// Processing/waiting animation
    static var processing: LottieView {
        LottieView(name: "processing", loopMode: .loop)
    }

    /// Empty state animation
    static var empty: LottieView {
        LottieView(name: "empty", loopMode: .loop, speed: 0.8)
    }

    /// Success checkmark
    static var success: LottieView {
        LottieView(name: "success", loopMode: .playOnce)
    }

    /// Error/failure
    static var error: LottieView {
        LottieView(name: "error", loopMode: .playOnce)
    }
}

// MARK: - Simple Animation View (No Binding)

struct SimpleLottieView: View {
    let name: String
    var loopMode: LottieLoopMode = .loop
    var speed: CGFloat = 1.0

    var body: some View {
        LottieView(
            name: name,
            loopMode: loopMode,
            speed: speed,
            isPlaying: .constant(true)
        )
    }
}

// MARK: - Animation Container

struct AnimationContainer: View {
    let animation: LottieView
    var size: CGFloat = 120
    var backgroundColor: Color = .clear

    var body: some View {
        ZStack {
            if backgroundColor != .clear {
                Circle()
                    .fill(backgroundColor)
                    .frame(width: size, height: size)
            }

            animation
                .frame(width: size, height: size)
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        SimpleLottieView(name: "loading")
            .frame(width: 100, height: 100)

        AnimationContainer(
            animation: .paymentSuccess,
            size: 150,
            backgroundColor: AppColors.success.opacity(0.1)
        )
    }
    .background(AppColors.backgroundPrimary)
}
