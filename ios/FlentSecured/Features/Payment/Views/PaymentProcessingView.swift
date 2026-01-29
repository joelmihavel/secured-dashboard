/// PaymentProcessingView.swift
/// Flent Secured v2 - Payment Processing Screen
///
/// Figma: node-id=41:9460 - Payment Processing
/// Shows while payment is being processed
/// Uses Realtime subscription to track payment status
///
/// Features:
/// - Animated progress indicator with rotating arc
/// - Stage-based messaging (Initiated, Processing, Verifying, Complete)
/// - Progress steps visualization
/// - Warning about not closing the app

import SwiftUI

struct PaymentProcessingView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel: PaymentProcessingViewModel
    @State private var rotation: Double = 0
    @State private var pulseScale: CGFloat = 1.0
    @State private var dotAnimationPhase: Int = 0

    init(paymentId: String) {
        self._viewModel = State(initialValue: PaymentProcessingViewModel(paymentId: paymentId))
    }

    var body: some View {
        ZStack {
            // Background
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Subtle radial gradient for depth - Figma: Brand tinted center
            RadialGradient(
                gradient: Gradient(colors: [
                    AppColors.brand500.opacity(0.1),
                    AppColors.backgroundPrimary
                ]),
                center: .center,
                startRadius: 50,
                endRadius: 300
            )
            .ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                Spacer()

                // Animation Container
                VStack(spacing: Spacing.xxl) {
                    // Progress Animation - Figma: Circular progress with icon
                    ZStack {
                        // Background circle
                        Circle()
                            .stroke(AppColors.backgroundSecondary, lineWidth: 6)
                            .frame(width: 120, height: 120)

                        // Pulsing background
                        Circle()
                            .fill(AppColors.brand500.opacity(0.1))
                            .frame(width: 120, height: 120)
                            .scaleEffect(pulseScale)

                        // Rotating progress arc - Figma: Gradient arc
                        Circle()
                            .trim(from: 0, to: 0.25)
                            .stroke(
                                AngularGradient(
                                    gradient: Gradient(colors: [
                                        AppColors.brand500.opacity(0.3),
                                        AppColors.brand500
                                    ]),
                                    center: .center
                                ),
                                style: StrokeStyle(lineWidth: 6, lineCap: .round)
                            )
                            .frame(width: 120, height: 120)
                            .rotationEffect(.degrees(rotation))

                        // Stage icon - Figma: Icon in center circle
                        ZStack {
                            Circle()
                                .fill(AppColors.backgroundSecondary)
                                .frame(width: 64, height: 64)

                            Image(systemName: viewModel.stage.iconName)
                                .font(.system(size: 28, weight: .medium))
                                .foregroundColor(stageIconColor)
                                .symbolEffect(.pulse, options: .repeating, value: viewModel.stage)
                        }
                    }

                    // Status Text - Figma: 24px semibold with animated dots
                    VStack(spacing: Spacing.sm) {
                        HStack(spacing: 0) {
                            Text(viewModel.stage.title)
                                .font(.system(size: 24, weight: .semibold))
                                .foregroundColor(.white)

                            // Animated dots
                            Text(animatedDots)
                                .font(.system(size: 24, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(width: 30, alignment: .leading)
                        }
                        .animation(.easeInOut, value: viewModel.stage)

                        Text(viewModel.stage.subtitle)
                            .font(.system(size: 16, weight: .regular))
                            .foregroundColor(AppColors.neutral500)
                            .multilineTextAlignment(.center)
                    }

                    // Progress Steps - Figma: Step indicators
                    progressSteps
                }

                Spacer()

                // Warning Card - Figma: Warning banner at bottom
                if viewModel.showWarning {
                    warningCard
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                Spacer()
                    .frame(height: Spacing.xl)
            }
            .padding(.horizontal, Spacing.screenHorizontalCompact)
        }
        .navigationBarHidden(true)
        .navigationBarBackButtonHidden(true)
        .task {
            viewModel.startProcessing()
            startAnimations()
        }
        .onChange(of: viewModel.isCompleted) { _, isCompleted in
            if isCompleted {
                // Haptic feedback
                HapticManager.shared.notification(viewModel.isSuccess ? .success : .error)

                // Navigate after small delay for animation
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    coordinator.navigate(to: .paymentResult(
                        paymentId: viewModel.paymentId,
                        success: viewModel.isSuccess
                    ))
                }
            }
        }
        .onDisappear {
            viewModel.stopProcessing()
        }
    }

    // MARK: - Animated Dots

    private var animatedDots: String {
        switch dotAnimationPhase % 4 {
        case 0: return ""
        case 1: return "."
        case 2: return ".."
        case 3: return "..."
        default: return ""
        }
    }

    // MARK: - Progress Steps

    /// Figma: Three-step progress indicator
    private var progressSteps: some View {
        HStack(spacing: 0) {
            // Step 1: Initiated
            progressStep(
                index: 0,
                title: "Initiated",
                isActive: true,
                isCompleted: viewModel.stage != .initiating
            )

            // Connector 1
            progressConnector(isActive: viewModel.stage != .initiating)

            // Step 2: Processing
            progressStep(
                index: 1,
                title: "Processing",
                isActive: viewModel.stage == .processing || viewModel.stage == .verifying || viewModel.stage.isCompleted,
                isCompleted: viewModel.stage == .verifying || viewModel.stage.isCompleted
            )

            // Connector 2
            progressConnector(isActive: viewModel.stage == .verifying || viewModel.stage.isCompleted)

            // Step 3: Verified
            progressStep(
                index: 2,
                title: "Verified",
                isActive: viewModel.stage.isCompleted,
                isCompleted: viewModel.stage.isCompleted
            )
        }
    }

    /// Individual step indicator
    private func progressStep(index: Int, title: String, isActive: Bool, isCompleted: Bool) -> some View {
        VStack(spacing: Spacing.xs) {
            ZStack {
                Circle()
                    .fill(isCompleted ? AppColors.success : (isActive ? AppColors.brand500 : AppColors.black500))
                    .frame(width: 24, height: 24)

                if isCompleted {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                } else {
                    Text("\(index + 1)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(isActive ? .white : AppColors.neutral500)
                }
            }

            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(isActive ? .white : AppColors.neutral500)
        }
    }

    /// Connector line between steps
    private func progressConnector(isActive: Bool) -> some View {
        Rectangle()
            .fill(isActive ? AppColors.success : AppColors.black500)
            .frame(width: 50, height: 2)
            .padding(.bottom, 24) // Offset to align with circles
    }

    // MARK: - Warning Card

    /// Figma: Warning banner with icon and text
    private var warningCard: some View {
        HStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 20))
                .foregroundColor(AppColors.warning)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("Don't close the app")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)

                Text("Please wait while we process your payment")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Spacer()
        }
        .padding(Spacing.md)
        .background(AppColors.warning.opacity(0.1))
        .cornerRadius(Radius.card)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.card)
                .stroke(AppColors.warning.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Computed Properties

    private var stageIconColor: Color {
        switch viewModel.stage {
        case .initiating:
            return AppColors.brand500
        case .processing:
            return AppColors.brand500
        case .verifying:
            return AppColors.success
        case .completed(let success):
            return success ? AppColors.success : AppColors.error
        }
    }

    // MARK: - Animations

    private func startAnimations() {
        // Rotation animation - Continuous spin
        withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
            rotation = 360
        }

        // Pulse animation - Breathing effect
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            pulseScale = 1.1
        }

        // Dot animation - Typing effect
        Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { _ in
            dotAnimationPhase += 1
        }
    }
}

// MARK: - Processing Stage Extension

extension PaymentProcessingViewModel.ProcessingStage {
    var isCompleted: Bool {
        if case .completed = self { return true }
        return false
    }
}

// MARK: - Preview

#Preview {
    PaymentProcessingView(paymentId: "test-123")
        .environment(AppCoordinator())
}
