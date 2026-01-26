/// PendingStepsView.swift
/// Flent Secured v2 - Pending Setup Steps Screen
///
/// Shows verification checklist for QUALIFIED users
/// Three verification steps required before COMPLETE status
///
/// Figma: Setup / Pending Steps screens

import SwiftUI

struct PendingStepsView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = PendingStepsViewModel()

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Header
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Complete your setup")
                        .font(Typography.h4)
                        .foregroundColor(AppColors.textPrimary)

                    Text("Finish these steps to start paying rent")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.textSecondary)
                }

                // Progress
                ProgressBar(
                    completed: viewModel.completedStepsCount,
                    total: viewModel.totalSteps
                )

                // Loading State
                if viewModel.isLoading {
                    VStack(spacing: Spacing.md) {
                        ProgressView()
                            .tint(AppColors.accentPrimary)
                        Text("Loading status...")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textMuted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, Spacing.xl)
                } else {
                    // Steps List
                    VStack(spacing: Spacing.md) {
                        ForEach(viewModel.steps) { step in
                            SetupStepCard(
                                step: step.number,
                                title: step.title,
                                subtitle: step.subtitle,
                                isCompleted: step.isCompleted,
                                icon: step.icon
                            ) {
                                coordinator.navigate(to: step.route)
                            }
                        }
                    }

                    // Error Message
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.error)
                    }
                }

                Spacer()

                // All Complete Message
                if viewModel.allStepsCompleted {
                    VStack(spacing: Spacing.md) {
                        HStack(spacing: Spacing.sm) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(AppColors.success)
                            Text("All verifications complete!")
                                .font(Typography.bodyMd)
                                .foregroundColor(AppColors.success)
                        }

                        PrimaryButton(title: "Continue to Home") {
                            coordinator.navigate(to: .home(state: .activeComplete))
                        }
                    }
                } else if viewModel.canSkipToHome {
                    // Skip for now (if at least one step done)
                    TextButton(title: "Continue to home") {
                        coordinator.navigate(to: .home(state: .activeQualified))
                    }
                }
            }
            .screenPadding()
            .padding(.top, Spacing.xl)
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadStatus()
        }
        .refreshable {
            await viewModel.refresh()
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.completedStepsCount)
    }
}

// MARK: - Progress Bar

struct ProgressBar: View {
    let completed: Int
    let total: Int

    private var progress: CGFloat {
        guard total > 0 else { return 0 }
        return CGFloat(completed) / CGFloat(total)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            Text("\(completed) of \(total) completed")
                .font(Typography.caption)
                .foregroundColor(AppColors.textMuted)

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: 4)
                        .fill(AppColors.backgroundSecondary)

                    // Progress
                    RoundedRectangle(cornerRadius: 4)
                        .fill(AppColors.accentPrimary)
                        .frame(width: geometry.size.width * progress)
                        .animation(.easeInOut, value: progress)
                }
            }
            .frame(height: 8)
        }
    }
}

// MARK: - Setup Step Card

struct SetupStepCard: View {
    let step: Int
    let title: String
    let subtitle: String
    let isCompleted: Bool
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.md) {
                // Icon
                ZStack {
                    Circle()
                        .fill(isCompleted ? AppColors.success.opacity(0.2) : AppColors.backgroundSecondary)
                        .frame(width: 48, height: 48)

                    if isCompleted {
                        Image(systemName: "checkmark")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundColor(AppColors.success)
                    } else {
                        Image(systemName: icon)
                            .font(.system(size: 20))
                            .foregroundColor(AppColors.accentPrimary)
                    }
                }

                // Text
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text(title)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text(subtitle)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textSecondary)
                }

                Spacer()

                // Arrow
                if !isCompleted {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(AppColors.textMuted)
                }
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.card)
        }
        .disabled(isCompleted)
    }
}

#Preview {
    PendingStepsView()
        .environment(AppCoordinator())
        .environment(AppState())
}
