/// HomeView.swift
/// Flent Secured v2 - Home Screen
///
/// IMPORTANT: Single file handles ALL home states via HomeState enum
/// No separate files for different states!
///
/// States handled:
/// - .zeroState: Setup incomplete
/// - .activeQualified: QUALIFIED user (UPI/NetBanking only)
/// - .activeComplete: COMPLETE user (all methods)
/// - .latePayment: After 7th, no cashback
/// - .missedPayment: Overdue
/// - .paidThisMonth(settlementStatus): Payment made, showing settlement
///
/// Figma: Home screens (all variants)

import SwiftUI

struct HomeView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = HomeViewModel()

    let state: HomeState

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            if viewModel.isLoading {
                ProgressView()
                    .tint(AppColors.accentPrimary)
            } else {
                ScrollView {
                    VStack(spacing: Spacing.lg) {
                        // Header
                        headerSection

                        // State-specific content
                        stateContent
                    }
                    .screenPadding()
                    .padding(.top, Spacing.md)
                }
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadDashboard()
        }
        .refreshable {
            await viewModel.refresh()
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("Hello, \(viewModel.firstName)")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text(greetingSubtext)
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textSecondary)
            }

            Spacer()

            // Profile Button
            Button {
                coordinator.navigate(to: .profile)
            } label: {
                Circle()
                    .fill(AppColors.backgroundSecondary)
                    .frame(width: 44, height: 44)
                    .overlay(
                        Image(systemName: "person.fill")
                            .foregroundColor(AppColors.textMuted)
                    )
            }
        }
    }

    private var greetingSubtext: String {
        switch state {
        case .zeroState:
            return "Complete your setup to get started"
        case .paidThisMonth:
            return "You're all set for this month!"
        case .latePayment:
            return "Don't forget to pay your rent"
        case .missedPayment:
            return "Your rent is overdue"
        default:
            return "Ready to pay rent?"
        }
    }

    // MARK: - State Content

    @ViewBuilder
    private var stateContent: some View {
        switch state {
        case .zeroState:
            zeroStateContent

        case .activeQualified, .activeComplete:
            activeStateContent

        case .latePayment:
            latePaymentContent

        case .missedPayment:
            missedPaymentContent

        case .paidThisMonth(let settlementStatus):
            paidStateContent(settlementStatus: settlementStatus)
        }
    }

    // MARK: - Zero State

    private var zeroStateContent: some View {
        VStack(spacing: Spacing.lg) {
            // Setup Progress Card
            VStack(spacing: Spacing.md) {
                HStack {
                    Text("Complete Setup")
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Spacer()

                    Text("0/3")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                }

                ProgressBar(completed: 0, total: 3)

                PrimaryButton(title: "Continue Setup") {
                    coordinator.navigate(to: .pendingSteps)
                }
            }
            .cardPadding()
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.card)
            .accessibilityIdentifier("setup_progress_card")
        }
    }

    // MARK: - Active State

    private var activeStateContent: some View {
        VStack(spacing: Spacing.lg) {
            // Rent Due Card
            rentDueCard

            // Cashback Card
            cashbackCard

            // Quick Actions
            quickActions

            // Recent Transactions
            recentTransactions
        }
    }

    private var rentDueCard: some View {
        VStack(spacing: Spacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text("Rent Due")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textSecondary)

                    Text("₹25,000")
                        .font(Typography.amountLarge)
                        .foregroundColor(AppColors.textPrimary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: Spacing.xxs) {
                    Text("Due in")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textSecondary)

                    Text("5 days")
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.accentPrimary)
                }
            }

            PrimaryButton(title: "Pay Rent") {
                coordinator.navigate(to: .paymentMethods)
            }
            .accessibilityIdentifier("pay_rent_button")
        }
        .cardPadding()
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.card)
    }

    private var cashbackCard: some View {
        HStack {
            Image(systemName: "gift.fill")
                .font(.system(size: 24))
                .foregroundColor(AppColors.accentPrimary)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("Cashback Available")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textSecondary)

                Text("₹500")
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.success)
            }

            Spacer()

            Text("Will be applied")
                .font(Typography.caption)
                .foregroundColor(AppColors.textMuted)
        }
        .cardPadding()
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.card)
    }

    private var quickActions: some View {
        HStack(spacing: Spacing.md) {
            QuickActionButton(icon: "clock.arrow.circlepath", title: "History") {
                coordinator.navigate(to: .transactions)
            }

            QuickActionButton(icon: "doc.text", title: "Receipt") {
                // Show latest receipt
            }

            QuickActionButton(icon: "questionmark.circle", title: "Help") {
                // Show help
            }
        }
    }

    private var recentTransactions: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack {
                Text("Recent Transactions")
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                TextButton(title: "See All") {
                    coordinator.navigate(to: .transactions)
                }
            }

            // Placeholder for transactions
            Text("No recent transactions")
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textMuted)
                .frame(maxWidth: .infinity)
                .padding(Spacing.xl)
        }
    }

    // MARK: - Late Payment

    private var latePaymentContent: some View {
        VStack(spacing: Spacing.lg) {
            // Warning Banner
            HStack(spacing: Spacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(AppColors.warning)

                Text("Pay by the 7th to earn cashback!")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.warning)
            }
            .frame(maxWidth: .infinity)
            .padding(Spacing.md)
            .background(AppColors.warning.opacity(0.1))
            .cornerRadius(Radius.sm)

            rentDueCard
            quickActions
        }
    }

    // MARK: - Missed Payment

    private var missedPaymentContent: some View {
        VStack(spacing: Spacing.lg) {
            // Overdue Banner
            HStack(spacing: Spacing.sm) {
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundColor(AppColors.error)

                Text("Your rent is overdue. Pay now to avoid penalties.")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.error)
            }
            .frame(maxWidth: .infinity)
            .padding(Spacing.md)
            .background(AppColors.error.opacity(0.1))
            .cornerRadius(Radius.sm)

            rentDueCard
            quickActions
        }
    }

    // MARK: - Paid State

    private func paidStateContent(settlementStatus: SettlementStatus) -> some View {
        VStack(spacing: Spacing.lg) {
            // Success Card
            VStack(spacing: Spacing.md) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(AppColors.success)

                Text("Rent Paid!")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text("₹25,000 paid on Jan 5")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)

                // Settlement Status
                HStack(spacing: Spacing.xs) {
                    switch settlementStatus {
                    case .pending:
                        Image(systemName: "clock")
                            .foregroundColor(AppColors.textMuted)
                        Text("Settlement pending")
                    case .processing:
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Transferring to landlord...")
                    case .completed:
                        Image(systemName: "checkmark.circle")
                            .foregroundColor(AppColors.success)
                        Text("Transferred to landlord")
                    case .failed:
                        Image(systemName: "exclamationmark.circle")
                            .foregroundColor(AppColors.error)
                        Text("Transfer failed")
                    }
                }
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textMuted)
            }
            .cardPadding()
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.card)

            // Cashback Earned
            HStack {
                Image(systemName: "gift.fill")
                    .foregroundColor(AppColors.accentPrimary)

                Text("You earned ₹250 cashback!")
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.textPrimary)
            }
            .frame(maxWidth: .infinity)
            .cardPadding()
            .background(AppColors.success.opacity(0.1))
            .cornerRadius(Radius.card)

            quickActions
            recentTransactions
        }
    }
}

// MARK: - Quick Action Button

struct QuickActionButton: View {
    let icon: String
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundColor(AppColors.accentPrimary)

                Text(title)
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.sm)
        }
    }
}

#Preview("Active") {
    HomeView(state: .activeComplete)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Zero State") {
    HomeView(state: .zeroState)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Paid") {
    HomeView(state: .paidThisMonth(settlementStatus: .processing))
        .environment(AppCoordinator())
        .environment(AppState())
}
