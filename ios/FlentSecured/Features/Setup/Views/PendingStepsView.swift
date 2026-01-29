/// PendingStepsView.swift
/// Flent Secured v2 - Pending Setup Steps Screen
///
/// Figma Node ID: 1:34236 - onboarding / summary
///
/// Design Specifications:
/// - Header: "Complete your setup" (28px light) with brand accent
/// - Subtitle: "Finish these steps to start paying rent" (14px regular)
/// - Progress bar: brand500 fill on black400 background
/// - Step cards: Icons, titles, subtitles, chevrons
/// - Completed steps: success green checkmark
/// - Time estimates for each step
///
/// Shows verification checklist for QUALIFIED users
/// Three verification steps required before COMPLETE status

import SwiftUI

struct PendingStepsView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = PendingStepsViewModel()
    @State private var animateProgress = false

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            DottedGridPattern()
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Header
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Complete your")
                        .font(.system(size: 28, weight: .light))
                        .foregroundColor(.white)
                    + Text(" setup")
                        .font(.system(size: 28, weight: .light))
                        .foregroundColor(AppColors.brand500)

                    Text("Finish these steps to start paying rent")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.textSecondary)
                }
                .padding(.top, Spacing.xl)

                // Progress Section
                progressSection

                // Loading State
                if viewModel.isLoading {
                    loadingContent
                } else {
                    // Steps List
                    stepsListContent

                    Spacer()

                    // All Complete Message or Continue Options
                    bottomActions
                }
            }
            .screenPadding()
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadStatus()
            withAnimation(.easeOut(duration: 0.8).delay(0.3)) {
                animateProgress = true
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.completedStepsCount)
    }

    // MARK: - Progress Section

    private var progressSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Progress Label
            HStack {
                Text("\(viewModel.completedStepsCount) of \(viewModel.totalSteps) completed")
                    .font(Typography.bodySmMedium)
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                // Percentage
                Text("\(Int((Double(viewModel.completedStepsCount) / Double(max(1, viewModel.totalSteps))) * 100))%")
                    .font(Typography.bodySmMedium)
                    .foregroundColor(AppColors.brand500)
            }

            // Progress Bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: 4)
                        .fill(AppColors.black400)

                    // Progress
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: [AppColors.brand400, AppColors.brand500],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: animateProgress ? geometry.size.width * progressValue : 0)
                }
            }
            .frame(height: 8)
        }
        .padding(Spacing.md)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.md)
    }

    private var progressValue: CGFloat {
        guard viewModel.totalSteps > 0 else { return 0 }
        return CGFloat(viewModel.completedStepsCount) / CGFloat(viewModel.totalSteps)
    }

    // MARK: - Loading Content

    private var loadingContent: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
                .tint(AppColors.accentPrimary)
                .scaleEffect(1.2)
            Text("Loading your setup status...")
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.xxl)
    }

    // MARK: - Steps List

    private var stepsListContent: some View {
        VStack(spacing: Spacing.md) {
            ForEach(Array(viewModel.steps.enumerated()), id: \.element.id) { index, step in
                EnhancedSetupStepCard(
                    stepNumber: index + 1,
                    totalSteps: viewModel.totalSteps,
                    step: step
                ) {
                    coordinator.navigate(to: step.route)
                }
            }

            // Error Message
            if let error = viewModel.errorMessage {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(AppColors.error)
                    Text(error)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.error)
                }
                .padding(Spacing.sm)
                .background(AppColors.error.opacity(0.1))
                .cornerRadius(Radius.sm)
            }
        }
    }

    // MARK: - Bottom Actions

    private var bottomActions: some View {
        VStack(spacing: Spacing.md) {
            if viewModel.allStepsCompleted {
                // All steps complete
                allCompleteContent
            } else {
                // Time estimate
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "clock")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.textMuted)

                    Text("Estimated time: ~\(viewModel.remainingTimeEstimate)")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                }

                // Skip to home (if at least one step done)
                if viewModel.canSkipToHome {
                    TextButton(title: "Continue to home") {
                        coordinator.navigate(to: .home(state: .activeQualified))
                    }
                }
            }
        }
        .padding(.bottom, Spacing.lg)
    }

    // MARK: - All Complete Content

    private var allCompleteContent: some View {
        VStack(spacing: Spacing.md) {
            // Success message
            HStack(spacing: Spacing.sm) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.success)
                Text("All verifications complete!")
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.success)
            }
            .padding(Spacing.md)
            .frame(maxWidth: .infinity)
            .background(AppColors.success.opacity(0.1))
            .cornerRadius(Radius.md)

            // Continue button
            PrimaryButton(title: "Continue to Home") {
                coordinator.navigate(to: .home(state: .activeComplete))
            }
        }
    }
}

// MARK: - Enhanced Setup Step Card

private struct EnhancedSetupStepCard: View {
    let stepNumber: Int
    let totalSteps: Int
    let step: SetupStep
    let action: () -> Void

    @State private var isPressed = false

    var body: some View {
        Button(action: {
            if !step.isCompleted {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                action()
            }
        }) {
            HStack(spacing: Spacing.md) {
                // Step Indicator
                stepIndicator

                // Content
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    // Title with step number
                    HStack(spacing: Spacing.xs) {
                        Text(step.title)
                            .font(Typography.bodyMd)
                            .foregroundColor(step.isCompleted ? AppColors.textSecondary : AppColors.textPrimary)

                        if step.isCompleted {
                            Text("Done")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(AppColors.success)
                                .padding(.horizontal, Spacing.xs)
                                .padding(.vertical, 2)
                                .background(AppColors.success.opacity(0.1))
                                .cornerRadius(Radius.pill)
                        }
                    }

                    Text(step.subtitle)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                }

                Spacer()

                // Right side content
                if step.isCompleted {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(AppColors.success)
                } else {
                    // Time estimate and chevron
                    HStack(spacing: Spacing.sm) {
                        Text(step.timeEstimate)
                            .font(Typography.caption)
                            .foregroundColor(AppColors.textMuted)

                        Image(systemName: "chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(AppColors.brand500)
                    }
                }
            }
            .padding(Spacing.md)
            .background(cardBackground)
            .cornerRadius(Radius.md)
            .overlay(cardBorder)
            .scaleEffect(isPressed ? 0.98 : 1.0)
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(step.isCompleted)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !step.isCompleted {
                        withAnimation(.easeInOut(duration: 0.1)) {
                            isPressed = true
                        }
                    }
                }
                .onEnded { _ in
                    withAnimation(.easeInOut(duration: 0.1)) {
                        isPressed = false
                    }
                }
        )
    }

    // MARK: - Step Indicator

    private var stepIndicator: some View {
        ZStack {
            Circle()
                .fill(indicatorBackground)
                .frame(width: 48, height: 48)

            if step.isCompleted {
                Image(systemName: "checkmark")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(AppColors.success)
            } else {
                Image(systemName: step.icon)
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.brand500)
            }
        }
    }

    private var indicatorBackground: Color {
        if step.isCompleted {
            return AppColors.success.opacity(0.15)
        }
        return AppColors.brand500.opacity(0.1)
    }

    private var cardBackground: Color {
        if step.isCompleted {
            return AppColors.backgroundSecondary.opacity(0.5)
        }
        return AppColors.backgroundSecondary
    }

    private var cardBorder: some View {
        RoundedRectangle(cornerRadius: Radius.md)
            .stroke(
                step.isCompleted ? AppColors.success.opacity(0.3) : AppColors.border,
                lineWidth: 1
            )
    }
}

// MARK: - Type Alias for Step

typealias SetupStep = PendingStepsViewModel.VerificationStep

// MARK: - Setup Step Model Extension

extension PendingStepsViewModel.VerificationStep {
    var timeEstimate: String {
        switch title.lowercased() {
        case let t where t.contains("bank"):
            return "2 min"
        case let t where t.contains("utility"):
            return "1 min"
        case let t where t.contains("landlord"):
            return "1 min"
        default:
            return "2 min"
        }
    }
}

// MARK: - ViewModel Extension

extension PendingStepsViewModel {
    var remainingTimeEstimate: String {
        let remaining = steps.filter { !$0.isCompleted }.count
        let minutes = remaining * 2
        return "\(minutes) minutes"
    }
}

// MARK: - Previews

#Preview("Loading") {
    PendingStepsView()
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("In Progress") {
    PendingStepsView()
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("All Complete") {
    PendingStepsView()
        .environment(AppCoordinator())
        .environment(AppState())
}
