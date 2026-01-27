/// HomeView.swift
/// Flent Secured v2 - Home Screen
///
/// Figma: node-id=1:32816
/// - Header: Logo + "Hi, [Name]" + Avatar + Menu
/// - Tab bar: "Home | Transactions" pill style
/// - Setup progress card with checklist
/// - Stats cards and property details
/// - Sticky footer with due amount
///
/// States handled:
/// - .zeroState: Setup incomplete
/// - .activeQualified: QUALIFIED user (UPI/NetBanking only)
/// - .activeComplete: COMPLETE user (all methods)
/// - .latePayment: After 7th, no cashback
/// - .missedPayment: Overdue
/// - .paidThisMonth(settlementStatus): Payment made

import SwiftUI

struct HomeView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = HomeViewModel()
    @State private var selectedTab: HomeTabBar.HomeTab = .home

    let state: HomeState

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            if viewModel.isLoading {
                ProgressView()
                    .tint(AppColors.accentPrimary)
            } else {
                VStack(spacing: 0) {
                    // Main scrollable content
                    ScrollView {
                        VStack(spacing: Spacing.lg) {
                            // Header
                            headerSection

                            // Tab bar
                            HomeTabBar(selectedTab: $selectedTab)
                                .padding(.vertical, Spacing.sm)

                            // Tab content
                            if selectedTab == .home {
                                homeTabContent
                            } else {
                                transactionsTabContent
                            }
                        }
                        .padding(.horizontal, Spacing.screenHorizontalCompact)
                        .padding(.top, Spacing.md)
                        .padding(.bottom, 100) // Space for sticky footer
                    }

                    // Sticky footer
                    if state != .zeroState {
                        stickyFooter
                    }
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

    // MARK: - Header (Figma style)

    private var headerSection: some View {
        HStack {
            // Logo
            FlentLogo(size: 24)

            // Greeting
            Text("Hi, \(viewModel.firstName)")
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral500)

            Spacer()

            // Avatar
            Button {
                coordinator.navigate(to: .profile)
            } label: {
                Circle()
                    .fill(AppColors.brand500)
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.white)
                    )
            }

            // Menu
            Button {
                // Toggle menu
            } label: {
                Image(systemName: "line.3.horizontal")
                    .font(.system(size: 20))
                    .foregroundColor(.white)
            }
        }
    }

    // MARK: - Home Tab Content

    @ViewBuilder
    private var homeTabContent: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Welcome message
            VStack(alignment: .leading, spacing: 0) {
                Text("Welcome to")
                    .font(.system(size: 28, weight: .regular))
                    .foregroundColor(.white)
                Text("Flent Secured")
                    .font(.system(size: 28, weight: .regular))
                    .foregroundColor(AppColors.brand500)
            }

            // State-specific content
            stateContent
        }
    }

    // MARK: - Transactions Tab Content

    private var transactionsTabContent: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Transactions")
                .font(.system(size: 28, weight: .regular))
                .foregroundColor(.white)

            // Transaction list placeholder
            Text("No transactions yet")
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral500)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, Spacing.xxl)
        }
    }

    // MARK: - Sticky Footer

    private var stickyFooter: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Due in \(viewModel.daysUntilDue) Days")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppColors.neutral500)
                Text("₹\(viewModel.rentAmount)")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
            }

            Spacer()

            Button(action: {
                coordinator.navigate(to: .paymentMethods)
            }) {
                Text("View Details")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                    .background(AppColors.brand500)
                    .cornerRadius(Radius.pill)
            }
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
        .padding(.vertical, Spacing.md)
        .background(AppColors.backgroundSecondary)
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

    // MARK: - Zero State (Figma style)

    private var zeroStateContent: some View {
        VStack(spacing: Spacing.lg) {
            // Setup Progress Card
            SetupProgressCard(
                title: "Setup incomplete",
                progress: "\(viewModel.setupProgress)/3",
                items: [
                    SetupItem(
                        title: "Add landlord's bank details",
                        subtitle: "enables secure payouts",
                        status: viewModel.bankDetailsComplete ? .completed : .inProgress
                    ),
                    SetupItem(
                        title: "Upload address proof",
                        subtitle: "for verification",
                        status: viewModel.addressProofComplete ? .completed : .pending
                    ),
                    SetupItem(
                        title: "Invite your landlord",
                        subtitle: "needed for cashback eligibility",
                        status: viewModel.landlordInvited ? .completed : .pending
                    )
                ]
            )
            .accessibilityIdentifier("setup_progress_card")

            // Get Started section
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("GET STARTED")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppColors.neutral500)
                    .tracking(1)

                HStack(spacing: Spacing.sm) {
                    PillButton(icon: "sparkles", title: "Add UPI method") {
                        coordinator.navigate(to: .paymentMethods)
                    }
                    PillButton(icon: "creditcard", title: "Add Credit Card") {
                        coordinator.navigate(to: .paymentMethods)
                    }
                }
            }

            // Landlord invitation warning
            landlordInvitationCard

            // Stats cards
            statsSection

            // Property details
            propertyDetailsSection
        }
    }

    // MARK: - Landlord Invitation Card

    private var landlordInvitationCard: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("LANDLORD INVITATION")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppColors.neutral500)
                .tracking(1)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Your landlord declined the invite")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)

                Text("Some landlords prefer to understand before joining. You can continue paying rent.")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)

                Button(action: {
                    // Contact support
                }) {
                    Text("Contact support")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppColors.brand500)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.xs)
                        .background(AppColors.brand500.opacity(0.2))
                        .cornerRadius(Radius.xs)
                }
            }
            .padding(Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.error.opacity(0.3), lineWidth: 1)
            )
        }
    }

    // MARK: - Stats Section

    private var statsSection: some View {
        HStack(spacing: Spacing.md) {
            // On-time payments
            StatsCard(
                icon: "checkmark.circle",
                iconColor: AppColors.success,
                title: "On-Time",
                subtitle: "Payments made",
                value: "\(viewModel.onTimePayments)"
            )

            // Cashback earned
            StatsCard(
                icon: "gift",
                iconColor: AppColors.brand500,
                title: "Cashback",
                subtitle: "Available",
                value: viewModel.cashbackAvailable
            )
        }
    }

    // MARK: - Property Details Section

    private var propertyDetailsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("About your Home")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                PropertyDetailRow(icon: "building.2", label: "Property Name", value: viewModel.propertyName)
                PropertyDetailRow(icon: "mappin.and.ellipse", label: "Address", value: viewModel.propertyAddress)
                PropertyDetailRow(icon: "indianrupeesign.circle", label: "Monthly Rent", value: viewModel.rentAmount)
            }
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

// MARK: - Pill Button (for GET STARTED section)

struct PillButton: View {
    let icon: String
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                Text(title)
                    .font(.system(size: 14, weight: .medium))
            }
            .foregroundColor(.white)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.xs)
            .background(AppColors.black500)
            .cornerRadius(Radius.pill)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.pill)
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
    }
}

// MARK: - Stats Card

struct StatsCard: View {
    let icon: String
    let iconColor: Color
    let title: String
    let subtitle: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Icon with circular border
            ZStack {
                Circle()
                    .stroke(iconColor.opacity(0.3), lineWidth: 2)
                    .frame(width: 40, height: 40)
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundColor(iconColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                Text(subtitle)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Text(value)
                .font(.system(size: 32, weight: .light))
                .foregroundColor(AppColors.brand500)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
    }
}

// MARK: - Property Detail Row

struct PropertyDetailRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(AppColors.neutral500)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                Text(value)
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(.white)
            }
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
