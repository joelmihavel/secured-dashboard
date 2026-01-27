/// HomeView.swift
/// Flent Secured v2 - Home Screen
///
/// Figma: node-id=1:32816, 1:33091
/// - Background: #131313 (black700)
/// - Header: Logo + "Hi, [Name]" (14px neutral) + Avatar (32px circle, brand bg) + Menu icon
/// - Tab bar: Pill style "Home | Transactions"
///   - Selected: #202020 bg, white text, rd-40
///   - Unselected: transparent, gray text
/// - Welcome: "Welcome to" (white 28px) + "Flent Secured" (orange 28px)
/// - Setup Progress Card (zero state):
///   - Background: #202020, border 1px #4D4D4D, rd-12
///   - Checklist with orange status circles
/// - Stats Cards:
///   - Background: #202020
///   - Icon with circular border
///   - Value in orange 32px light
/// - Sticky Footer:
///   - Background: #202020
///   - "Due in X Days" (12px medium, neutral500) + Amount (20px semibold, white)
///   - "View Details" pill button (brand500 bg, white text, rd-40)
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
            // Background: #131313
            AppColors.black700
                .ignoresSafeArea()

            if viewModel.isLoading {
                ProgressView()
                    .tint(AppColors.brand500)
            } else {
                VStack(spacing: 0) {
                    // Main scrollable content
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: Spacing.lg) {
                            // Header
                            headerSection

                            // Tab bar - left aligned
                            HStack {
                                HomeTabBar(selectedTab: $selectedTab)
                                Spacer()
                            }
                            .padding(.vertical, Spacing.xs)

                            // Tab content
                            if selectedTab == .home {
                                homeTabContent
                            } else {
                                transactionsTabContent
                            }
                        }
                        .padding(.horizontal, Spacing.screenHorizontalCompact)
                        .padding(.top, Spacing.md)
                        .padding(.bottom, state != .zeroState ? 120 : Spacing.xl) // Space for sticky footer
                    }

                    // Sticky footer - only show when not in zero state
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

    // MARK: - Header (Figma: node-id=1:32816)
    // Logo + "Hi, [Name]" (14px neutral) + Avatar (32px circle, brand bg) + Menu icon

    private var headerSection: some View {
        HStack(spacing: Spacing.sm) {
            // Logo - 24px keyhole icon
            FlentLogo(size: 24)

            // Greeting - 14px regular, neutral500
            Text("Hi, \(viewModel.firstName)")
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral500)

            Spacer()

            // Avatar - 32px circle with brand background
            Button {
                coordinator.navigate(to: .profile)
            } label: {
                Circle()
                    .fill(AppColors.brand500)
                    .frame(width: 32, height: 32)
                    .overlay(
                        Text(viewModel.firstName.prefix(1).uppercased())
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white)
                    )
            }
            .accessibilityLabel("Profile")

            // Menu hamburger icon
            Button {
                // Toggle menu
            } label: {
                Image(systemName: "line.3.horizontal")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 32, height: 32)
            }
            .accessibilityLabel("Menu")
        }
    }

    // MARK: - Home Tab Content
    // Welcome: "Welcome to" (white 28px) + "Flent Secured" (orange 28px)

    @ViewBuilder
    private var homeTabContent: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Welcome message - 28px regular
            VStack(alignment: .leading, spacing: 0) {
                Text("Welcome to")
                    .font(.system(size: 28, weight: .regular))
                    .foregroundColor(.white)
                    .tracking(-0.5)
                Text("Flent Secured")
                    .font(.system(size: 28, weight: .regular))
                    .foregroundColor(AppColors.brand500)
                    .tracking(-0.5)
            }
            .padding(.top, Spacing.xs)

            // State-specific content
            stateContent
        }
    }

    // MARK: - Transactions Tab Content

    private var transactionsTabContent: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Title - 28px regular white
            Text("Transactions")
                .font(.system(size: 28, weight: .regular))
                .foregroundColor(.white)
                .tracking(-0.5)
                .padding(.top, Spacing.xs)

            // Transaction list placeholder - empty state
            VStack(spacing: Spacing.md) {
                Image(systemName: "doc.text")
                    .font(.system(size: 40))
                    .foregroundColor(AppColors.black400)

                Text("No transactions yet")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)

                Text("Your payment history will appear here")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.black300)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.xxl)
        }
    }

    // MARK: - Sticky Footer (Figma: node-id=1:33091)
    // Background: #202020, "Due in X Days" + Amount, "View Details" pill button

    private var stickyFooter: some View {
        HStack(spacing: Spacing.md) {
            // Due info
            VStack(alignment: .leading, spacing: 2) {
                Text("Due in \(viewModel.daysUntilDue) Days")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppColors.neutral500)
                Text(viewModel.rentAmount)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
            }

            Spacer()

            // View Details pill button - brand500 bg, white text, rd-40
            Button(action: {
                coordinator.navigate(to: .paymentMethods)
            }) {
                Text("View Details")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                    .background(AppColors.brand500)
                    .clipShape(Capsule())
            }
            .accessibilityLabel("View payment details")
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
        .padding(.vertical, Spacing.md)
        .background(
            AppColors.black500
                .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: -5)
        )
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

    // MARK: - Zero State (Figma: node-id=1:32816)
    // Setup Progress Card: Background #202020, border 1px #4D4D4D, rd-12

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
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppColors.neutral500)
                    .tracking(1.5)

                // Pill buttons for quick actions
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.sm) {
                        GetStartedPillButton(icon: "sparkles", title: "Add UPI method") {
                            coordinator.navigate(to: .paymentMethods)
                        }
                        GetStartedPillButton(icon: "creditcard", title: "Add Credit Card") {
                            coordinator.navigate(to: .paymentMethods)
                        }
                    }
                }
            }

            // Landlord invitation warning (conditional)
            if !viewModel.landlordInvited {
                landlordInvitationCard
            }

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
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(1.5)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.warning)

                    Text("Your landlord declined the invite")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                }

                Text("Some landlords prefer to understand before joining. You can continue paying rent.")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                    .fixedSize(horizontal: false, vertical: true)

                Button(action: {
                    // Contact support
                }) {
                    Text("Contact support")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppColors.brand500)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.xs)
                        .background(AppColors.brand500.opacity(0.15))
                        .clipShape(Capsule())
                }
                .padding(.top, Spacing.xxs)
            }
            .padding(Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.warning.opacity(0.3), lineWidth: 1)
            )
        }
    }

    // MARK: - Stats Section (Figma)
    // Background: #202020, icon with circular border, value in orange 32px light

    private var statsSection: some View {
        HStack(spacing: Spacing.sm) {
            // On-time payments
            HomeStatsCard(
                icon: "checkmark.circle",
                iconColor: AppColors.success,
                title: "On-Time",
                subtitle: "Payments made",
                value: "\(viewModel.onTimePayments)"
            )

            // Cashback earned
            HomeStatsCard(
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
            Text("ABOUT YOUR HOME")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(1.5)

            VStack(alignment: .leading, spacing: 0) {
                HomePropertyDetailRow(icon: "building.2", label: "Property Name", value: viewModel.propertyName)
                Divider()
                    .background(AppColors.black400.opacity(0.5))
                HomePropertyDetailRow(icon: "mappin.and.ellipse", label: "Address", value: viewModel.propertyAddress)
                Divider()
                    .background(AppColors.black400.opacity(0.5))
                HomePropertyDetailRow(icon: "indianrupeesign.circle", label: "Monthly Rent", value: viewModel.rentAmount)
            }
            .padding(Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
    }

    // MARK: - Active State

    private var activeStateContent: some View {
        VStack(spacing: Spacing.lg) {
            // Rent Due Card
            rentDueCard

            // Cashback Card (only show if there's cashback)
            if viewModel.hasCashback {
                cashbackCard
            }

            // Quick Actions
            quickActions

            // Recent Transactions
            recentTransactions
        }
    }

    private var rentDueCard: some View {
        VStack(spacing: Spacing.md) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text("Rent Due")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500)

                    Text(viewModel.rentAmount)
                        .font(.system(size: 32, weight: .light))
                        .foregroundColor(.white)
                        .monospacedDigit()
                }

                Spacer()

                VStack(alignment: .trailing, spacing: Spacing.xxs) {
                    Text("Due in")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500)

                    Text("\(viewModel.daysUntilDue) days")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(AppColors.brand500)
                }
            }

            PrimaryButton(title: "Pay Rent") {
                coordinator.navigate(to: .paymentMethods)
            }
            .accessibilityIdentifier("pay_rent_button")
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.black400, lineWidth: 1)
        )
    }

    private var cashbackCard: some View {
        HStack(spacing: Spacing.sm) {
            ZStack {
                Circle()
                    .fill(AppColors.brand500.opacity(0.15))
                    .frame(width: 40, height: 40)

                Image(systemName: "gift.fill")
                    .font(.system(size: 18))
                    .foregroundColor(AppColors.brand500)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Cashback Available")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)

                Text(viewModel.cashbackAvailable)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(AppColors.success)
            }

            Spacer()

            Text("Will be applied")
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(AppColors.black300)
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.black400, lineWidth: 1)
        )
    }

    private var quickActions: some View {
        HStack(spacing: Spacing.sm) {
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
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Text("RECENT TRANSACTIONS")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppColors.neutral500)
                    .tracking(1.5)

                Spacer()

                TextButton(title: "See All") {
                    coordinator.navigate(to: .transactions)
                }
            }

            // Placeholder for transactions
            VStack(spacing: Spacing.sm) {
                Image(systemName: "doc.text")
                    .font(.system(size: 32))
                    .foregroundColor(AppColors.black400)

                Text("No recent transactions")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.xl)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
    }

    // MARK: - Late Payment

    private var latePaymentContent: some View {
        VStack(spacing: Spacing.lg) {
            // Warning Banner - yellow tint
            HStack(spacing: Spacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(AppColors.warning)

                Text("Pay by the 7th to earn cashback!")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.warning)

                Spacer()
            }
            .padding(Spacing.md)
            .background(AppColors.warning.opacity(0.1))
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.warning.opacity(0.3), lineWidth: 1)
            )

            rentDueCard
            quickActions
        }
    }

    // MARK: - Missed Payment

    private var missedPaymentContent: some View {
        VStack(spacing: Spacing.lg) {
            // Overdue Banner - red tint
            HStack(spacing: Spacing.sm) {
                Image(systemName: "exclamationmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(AppColors.error)

                Text("Your rent is overdue. Pay now to avoid penalties.")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.error)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer()
            }
            .padding(Spacing.md)
            .background(AppColors.error.opacity(0.1))
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.error.opacity(0.3), lineWidth: 1)
            )

            rentDueCard
            quickActions
        }
    }

    // MARK: - Paid State

    private func paidStateContent(settlementStatus: SettlementStatus) -> some View {
        VStack(spacing: Spacing.lg) {
            // Success Card
            VStack(spacing: Spacing.md) {
                ZStack {
                    Circle()
                        .fill(AppColors.success.opacity(0.15))
                        .frame(width: 64, height: 64)

                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 40))
                        .foregroundColor(AppColors.success)
                }

                Text("Rent Paid!")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(.white)

                Text("\(viewModel.rentAmount) paid on Jan 5")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)

                // Settlement Status
                HStack(spacing: Spacing.xs) {
                    switch settlementStatus {
                    case .pending:
                        Image(systemName: "clock")
                            .foregroundColor(AppColors.black300)
                        Text("Settlement pending")
                    case .processing:
                        ProgressView()
                            .scaleEffect(0.7)
                            .tint(AppColors.brand500)
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
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(AppColors.black300)
            }
            .frame(maxWidth: .infinity)
            .padding(Spacing.lg)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.black400, lineWidth: 1)
            )

            // Cashback Earned
            HStack(spacing: Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(AppColors.success.opacity(0.15))
                        .frame(width: 36, height: 36)

                    Image(systemName: "gift.fill")
                        .font(.system(size: 16))
                        .foregroundColor(AppColors.success)
                }

                Text("You earned")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)

                Text("250 cashback!")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AppColors.success)

                Spacer()
            }
            .padding(Spacing.md)
            .background(AppColors.success.opacity(0.08))
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.success.opacity(0.2), lineWidth: 1)
            )

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
                ZStack {
                    Circle()
                        .fill(AppColors.brand500.opacity(0.15))
                        .frame(width: 48, height: 48)

                    Image(systemName: icon)
                        .font(.system(size: 20))
                        .foregroundColor(AppColors.brand500)
                }

                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppColors.neutral500)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
    }
}

// MARK: - Get Started Pill Button (for GET STARTED section)
// Background: #202020, border: #4D4D4D, rd-40 (pill)

struct GetStartedPillButton: View {
    let icon: String
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.brand500)
                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm)
            .background(AppColors.black500)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
    }
}

// MARK: - Home Stats Card (Figma)
// Background: #202020, icon with circular border, value in orange 32px light

struct HomeStatsCard: View {
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
                    .font(.system(size: 18))
                    .foregroundColor(iconColor)
            }

            // Labels
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                Text(subtitle)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            // Value - 32px light orange
            Text(value)
                .font(.system(size: 32, weight: .light))
                .foregroundColor(AppColors.brand500)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.black400, lineWidth: 1)
        )
    }
}

// MARK: - Home Property Detail Row

struct HomePropertyDetailRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(AppColors.neutral500)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                Text(value)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
            }

            Spacer()
        }
        .padding(.vertical, Spacing.sm)
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
