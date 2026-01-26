/// WaitlistView.swift
/// Flent Secured v2 - Waitlist Screen
///
/// IMPORTANT: Single file handles ALL waitlist states via WaitlistViewModel
/// No separate files for different states!
///
/// States handled:
/// - .loading: Fetching waitlist status
/// - .pending: In queue, showing position
/// - .pendingLong: >24 hours wait, different messaging
/// - .approved: User qualified, proceed to setup
/// - .rejected: User not eligible
/// - .error: Error loading status
///
/// Figma: Onboarding / Waitlist Screen (all variants)

import SwiftUI

struct WaitlistView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel = WaitlistViewModel()
    @State private var showReferralSheet = false
    @State private var referralCode = ""
    @State private var isApplyingReferral = false

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                Spacer()

                // State-specific content
                stateContent

                Spacer()

                // State-specific actions
                stateActions
            }
            .screenPadding()
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadStatus()
        }
        .animation(.easeInOut(duration: 0.3), value: viewModel.state)
        .sheet(isPresented: $showReferralSheet) {
            referralSheetContent
        }
        .onDisappear {
            viewModel.stopPolling()
        }
    }

    // MARK: - State Content

    @ViewBuilder
    private var stateContent: some View {
        switch viewModel.state {
        case .loading:
            loadingContent

        case .pending(let position, let days):
            pendingContent(position: position, estimatedDays: days, isLongWait: false)

        case .pendingLong(let days):
            pendingContent(position: nil, estimatedDays: days, isLongWait: true)

        case .approved:
            acceptedContent

        case .rejected(let reason):
            rejectedContent(reason: reason)

        case .error(let message):
            errorContent(message: message)
        }
    }

    // MARK: - Loading Content

    private var loadingContent: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: AppColors.accentPrimary))
                .scaleEffect(1.2)

            Text("Loading your status...")
                .font(Typography.bodyMd)
                .foregroundColor(AppColors.textSecondary)
        }
    }

    // MARK: - Pending Content

    private func pendingContent(position: Int?, estimatedDays: Int?, isLongWait: Bool) -> some View {
        VStack(spacing: Spacing.lg) {
            // Illustration
            Image(systemName: "hourglass.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(AppColors.accentPrimary)

            VStack(spacing: Spacing.sm) {
                Text("You're on the waitlist!")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)

                Text(isLongWait
                     ? "Thanks for your patience. We're working to expand our service to your area."
                     : "We're reviewing your application. This usually takes a few hours.")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            // Position indicator
            if let position = position {
                HStack {
                    Text("Position in queue:")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)

                    Text("#\(position)")
                        .font(Typography.bodySmMedium)
                        .foregroundColor(AppColors.accentPrimary)
                }
            }

            // Estimated wait
            if let days = estimatedDays, days > 0 {
                HStack {
                    Text("Estimated wait:")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)

                    Text(days == 1 ? "~1 day" : "~\(days) days")
                        .font(Typography.bodySmMedium)
                        .foregroundColor(AppColors.textSecondary)
                }
            }

            // Last updated
            if let lastUpdated = viewModel.lastUpdated {
                Text("Last checked: \(lastUpdated.formatted(.relative(presentation: .named)))")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
            }
        }
    }

    // MARK: - Accepted Content

    private var acceptedContent: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(AppColors.success)

            VStack(spacing: Spacing.sm) {
                Text("You're in!")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text("Complete your setup to start paying rent through Flent.")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - Rejected Content

    private func rejectedContent(reason: String) -> some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(AppColors.error)

            VStack(spacing: Spacing.sm) {
                Text("Not eligible")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text(reason)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - Error Content

    private func errorContent(message: String) -> some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 60))
                .foregroundColor(AppColors.warning)

            VStack(spacing: Spacing.sm) {
                Text("Something went wrong")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text(message)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - State Actions

    @ViewBuilder
    private var stateActions: some View {
        switch viewModel.state {
        case .loading:
            EmptyView()

        case .pending, .pendingLong:
            VStack(spacing: Spacing.md) {
                TextButton(title: "Have a referral code?") {
                    showReferralSheet = true
                }

                SecondaryButton(title: "Refresh Status") {
                    Task {
                        await viewModel.refresh()
                    }
                }
            }

        case .approved:
            PrimaryButton(title: "Complete Setup") {
                if let route = viewModel.nextRoute() {
                    coordinator.navigate(to: route)
                }
            }

        case .rejected:
            VStack(spacing: Spacing.md) {
                SecondaryButton(title: "Contact Support") {
                    openSupport()
                }

                TextButton(title: "Sign out") {
                    Task {
                        // TODO: Sign out and return to phone entry
                        coordinator.popToRoot()
                    }
                }
            }

        case .error:
            VStack(spacing: Spacing.md) {
                PrimaryButton(title: "Try Again") {
                    Task {
                        await viewModel.refresh()
                    }
                }

                SecondaryButton(title: "Contact Support") {
                    openSupport()
                }
            }
        }
    }

    // MARK: - Referral Sheet

    private var referralSheetContent: some View {
        NavigationView {
            ZStack {
                AppColors.backgroundPrimary
                    .ignoresSafeArea()

                VStack(spacing: Spacing.xl) {
                    VStack(spacing: Spacing.sm) {
                        Text("Enter referral code")
                            .font(Typography.h4)
                            .foregroundColor(AppColors.textPrimary)

                        Text("A valid referral code can help you skip the queue")
                            .font(Typography.bodyMd2)
                            .foregroundColor(AppColors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, Spacing.xl)

                    TextField("", text: $referralCode)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)
                        .multilineTextAlignment(.center)
                        .textCase(.uppercase)
                        .autocorrectionDisabled()
                        .padding(Spacing.md)
                        .background(AppColors.backgroundSecondary)
                        .cornerRadius(Radius.input)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.input)
                                .stroke(AppColors.border, lineWidth: 1)
                        )
                        .padding(.horizontal, Spacing.xl)

                    Spacer()

                    PrimaryButton(
                        title: "Apply Code",
                        isLoading: isApplyingReferral,
                        isEnabled: !referralCode.isEmpty
                    ) {
                        applyReferralCode()
                    }
                    .padding(.horizontal, Spacing.md)
                }
                .screenPadding()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        showReferralSheet = false
                    }
                    .foregroundColor(AppColors.textSecondary)
                }
            }
        }
        .presentationDetents([.medium])
    }

    // MARK: - Actions

    private func applyReferralCode() {
        isApplyingReferral = true

        // TODO: Call referral code API
        Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)

            await MainActor.run {
                isApplyingReferral = false
                showReferralSheet = false

                // Refresh status after applying code
                Task {
                    await viewModel.refresh()
                }
            }
        }
    }

    private func openSupport() {
        // TODO: Open support email or chat
        if let url = URL(string: "mailto:support@flent.app") {
            UIApplication.shared.open(url)
        }
    }
}

// Note: TextButton and SecondaryButton are defined in Core/DesignSystem/Components/PrimaryButton.swift

#Preview("Loading") {
    WaitlistView()
        .environment(AppCoordinator())
}

#Preview("Pending") {
    WaitlistView()
        .environment(AppCoordinator())
}

#Preview("Approved") {
    WaitlistView()
        .environment(AppCoordinator())
}

#Preview("Rejected") {
    WaitlistView()
        .environment(AppCoordinator())
}
