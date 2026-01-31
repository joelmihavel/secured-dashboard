/// HomeView.swift
/// Flent Secured v2 - Home Screen (Pixel-Perfect Implementation)
///
/// Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
///
/// All Home Screen States (20 total):
///
/// EMPTY STATES (Pre-Verification) - 9 states:
/// - 41:4569  zeroState - Base empty state, setup incomplete
/// - 41:3186  setupPaymentUPI - Setup payment with UPI focus
/// - 41:7005  setupPayment - Setup payment methods
/// - 41:5792  emptyWithUPIPayments - Has UPI, has payments
/// - 41:5998  emptyWithUPIPaid - Has UPI, paid rent
/// - 41:6204  emptyWithUPINoPayments - Has UPI, no payments
/// - 41:6385  emptyWithCashback - Has UPI, has cashback
/// - 41:6598  emptyWithCashbackPaid - Has UPI, cashback, paid
/// - 41:6811  emptyNoCashback - Has UPI, no cashback
///
/// ACTIVE STATES (Post-Verification) - 2 main states:
/// - 41:3267, 41:7246  activeQualified - QUALIFIED user (UPI/NetBanking only)
/// - 41:3472, 41:7460  activeComplete - COMPLETE user (all methods)
///
/// PAYMENT ISSUE STATES - 3 states:
/// - 41:3677  latePayment - After due date, before 7th (yellow warning)
/// - 41:3885  missedPayment - After 7th, overdue (red error)
/// - 41:4093  multipleMissedPayments - Multiple months overdue
///
/// LANDLORD INVITATION STATES - 5 substates (shown within empty states):
/// - 41:4765  sent - Invitation just sent
/// - 41:4969  pendingUnder24hrs - Pending, cooldown active
/// - 41:5175  pendingOver24hrs - Pending, can resend
/// - 41:5381  failed - Invitation failed
/// - 41:5587  declined - Landlord declined
///
/// Design Specifications:
/// - Background: #131313 (black700)
/// - Card Background: #1A1A1A (black600) / #202020 (black500)
/// - Border: #4D4D4D (black400), 1px
/// - Cashback Accent: #70BF73 (success)
/// - Brand Accent: #FF9A6D (brand500)
/// - Corner Radius: 12px (rd-md)
/// - Screen Padding: 24px horizontal (screenHorizontalCompact)

import SwiftUI

// MARK: - Home View

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

            // Optional dotted grid pattern (30% opacity per design)
            DottedGridPattern(dotOpacity: 0.3)
                .ignoresSafeArea()

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

                        // Tab content with loading/skeleton states
                        if viewModel.isLoading {
                            skeletonContent
                        } else if selectedTab == .home {
                            homeTabContent
                        } else {
                            transactionsTabContent
                        }
                    }
                    .padding(.horizontal, Spacing.screenHorizontalCompact)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, shouldShowStickyFooter ? 120 : Spacing.xl)
                }
                .refreshable {
                    await viewModel.refresh()
                }

                // Sticky footer - conditional based on state
                if shouldShowStickyFooter {
                    stickyFooter
                }
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadDashboard()
            viewModel.startRealtimeSubscription()
        }
        .onDisappear {
            viewModel.stopRealtimeSubscription()
        }
    }

    // MARK: - Computed Properties

    private var shouldShowStickyFooter: Bool {
        switch state {
        case .zeroState:
            return false
        case .paidThisMonth:
            return false
        default:
            return true
        }
    }

    // MARK: - Header Section
    /// Figma: node-id=1:32816
    /// Layout: Logo (24px) | Greeting (14px regular) | Spacer | Bell? | Avatar (32px) | Menu (20px)

    private var headerSection: some View {
        HStack(spacing: Spacing.sm) {
            // Logo - 24px keyhole icon
            FlentLogo(size: 24)

            // Greeting - 14px regular, neutral500
            Text("Hi, \(viewModel.firstName)")
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral500)

            Spacer()

            // Notification bell (if unread)
            if viewModel.unreadNotificationCount > 0 {
                Button {
                    // Show notifications
                } label: {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bell.fill")
                            .font(.system(size: 18))
                            .foregroundColor(.white)
                            .frame(width: 32, height: 32)

                        // Badge
                        Text("\(min(viewModel.unreadNotificationCount, 9))")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 16, height: 16)
                            .background(AppColors.error)
                            .clipShape(Circle())
                            .offset(x: 4, y: -4)
                    }
                }
                .accessibilityLabel("Notifications, \(viewModel.unreadNotificationCount) unread")
            }

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
                coordinator.navigate(to: .settings)
            } label: {
                Image(systemName: "line.3.horizontal")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 32, height: 32)
            }
            .accessibilityLabel("Menu")
        }
    }

    // MARK: - Skeleton Loading Content

    private var skeletonContent: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Welcome skeleton
            VStack(alignment: .leading, spacing: Spacing.xs) {
                SkeletonView(height: 28)
                    .frame(width: 140)
                SkeletonView(height: 28)
                    .frame(width: 180)
            }
            .padding(.top, Spacing.xs)

            // Card skeleton
            HomeSkeletonCard()

            // Stats skeleton
            HStack(spacing: Spacing.sm) {
                HomeSkeletonStatsCard()
                HomeSkeletonStatsCard()
            }

            // Property skeleton
            HomeSkeletonPropertyCard()
        }
    }

    // MARK: - Home Tab Content

    @ViewBuilder
    private var homeTabContent: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Welcome message - 28px regular
            welcomeMessage

            // State-specific content
            stateContent
        }
    }

    /// Welcome message with two-line layout
    /// "Welcome to" (white) + "Flent Secured" (brand500)
    private var welcomeMessage: some View {
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

            // Transaction list or empty state
            if viewModel.recentPayments.isEmpty {
                transactionsEmptyState
            } else {
                transactionsList
            }
        }
    }

    private var transactionsEmptyState: some View {
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

    private var transactionsList: some View {
        LazyVStack(spacing: Spacing.sm) {
            ForEach(viewModel.recentPayments) { payment in
                TransactionRow(payment: payment)
                    .onTapGesture {
                        coordinator.navigate(to: .transactionDetail(id: payment.id))
                    }
            }
        }
    }

    // MARK: - Sticky Footer
    /// Figma: node-id=1:33091
    /// Shows due info and pay button

    private var stickyFooter: some View {
        HStack(spacing: Spacing.md) {
            // Due info
            VStack(alignment: .leading, spacing: 2) {
                Text(viewModel.dueInText)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(dueTextColor)
                Text(viewModel.rentAmount)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
            }

            Spacer()

            // Pay Now / View Details button
            Button(action: {
                coordinator.navigate(to: .paymentMethods)
            }) {
                Text(footerButtonTitle)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                    .background(footerButtonColor)
                    .clipShape(Capsule())
            }
            .accessibilityLabel(footerButtonTitle)
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
        .padding(.vertical, Spacing.md)
        .background(
            AppColors.black500
                .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: -5)
        )
    }

    private var dueTextColor: Color {
        switch state {
        case .latePayment:
            return AppColors.warning
        case .missedPayment, .multipleMissedPayments:
            return AppColors.error
        default:
            return AppColors.neutral500
        }
    }

    private var footerButtonTitle: String {
        switch state {
        case .latePayment, .missedPayment, .multipleMissedPayments:
            return "Pay Now"
        default:
            return "View Details"
        }
    }

    private var footerButtonColor: Color {
        switch state {
        case .missedPayment, .multipleMissedPayments:
            return AppColors.error
        case .latePayment:
            return AppColors.warning
        default:
            return AppColors.brand500
        }
    }

    // MARK: - State Content Router

    @ViewBuilder
    private var stateContent: some View {
        switch state {
        // MARK: - Empty States (Figma: 41:4569 - 41:6811)
        case .zeroState:
            ZeroStateContent(viewModel: viewModel, coordinator: coordinator)

        case .setupPaymentUPI:
            SetupPaymentUPIContent(viewModel: viewModel, coordinator: coordinator)

        case .setupPayment:
            SetupPaymentContent(viewModel: viewModel, coordinator: coordinator)

        case .emptyWithUPIPayments:
            EmptyWithUPIContent(
                viewModel: viewModel,
                coordinator: coordinator,
                hasPayments: true,
                hasCashback: false,
                isPaid: false
            )

        case .emptyWithUPIPaid:
            EmptyWithUPIContent(
                viewModel: viewModel,
                coordinator: coordinator,
                hasPayments: true,
                hasCashback: false,
                isPaid: true
            )

        case .emptyWithUPINoPayments:
            EmptyWithUPIContent(
                viewModel: viewModel,
                coordinator: coordinator,
                hasPayments: false,
                hasCashback: false,
                isPaid: false
            )

        case .emptyWithCashback:
            EmptyWithUPIContent(
                viewModel: viewModel,
                coordinator: coordinator,
                hasPayments: true,
                hasCashback: true,
                isPaid: false
            )

        case .emptyWithCashbackPaid:
            EmptyWithUPIContent(
                viewModel: viewModel,
                coordinator: coordinator,
                hasPayments: true,
                hasCashback: true,
                isPaid: true
            )

        case .emptyNoCashback:
            EmptyWithUPIContent(
                viewModel: viewModel,
                coordinator: coordinator,
                hasPayments: false,
                hasCashback: false,
                isPaid: false
            )

        // MARK: - Active States (Figma: 41:3267, 41:3472, 41:7246, 41:7460)
        case .activeQualified:
            ActiveStateContent(
                viewModel: viewModel,
                coordinator: coordinator,
                showAllMethods: false
            )

        case .activeComplete:
            ActiveStateContent(
                viewModel: viewModel,
                coordinator: coordinator,
                showAllMethods: true
            )

        // MARK: - Payment Issue States (Figma: 41:3677, 41:3885, 41:4093)
        case .latePayment:
            LatePaymentContent(viewModel: viewModel, coordinator: coordinator)

        case .missedPayment:
            MissedPaymentContent(viewModel: viewModel, coordinator: coordinator)

        case .multipleMissedPayments(let months, let totalAmount):
            MultipleMissedPaymentsContent(
                viewModel: viewModel,
                coordinator: coordinator,
                months: months,
                totalAmount: totalAmount
            )

        // MARK: - Paid State
        case .paidThisMonth(let settlementStatus):
            PaidStateContent(
                viewModel: viewModel,
                coordinator: coordinator,
                settlementStatus: settlementStatus
            )
        }
    }
}

// MARK: - Zero State Content
/// Figma: 41:4569 - zeroState
/// Shows setup progress, quick actions, landlord status, stats, and property

private struct ZeroStateContent: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
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

            // Quick Setup Actions
            QuickSetupActionsSection(viewModel: viewModel, coordinator: coordinator)

            // Landlord invitation status card (if applicable)
            if viewModel.landlordInvitationStatus != .notSent {
                LandlordInvitationStatusCard(viewModel: viewModel, coordinator: coordinator)
            }

            // Stats cards
            StatsSection(viewModel: viewModel)

            // Property details
            PropertyDetailsSection(viewModel: viewModel)
        }
    }
}

// MARK: - Setup Payment UPI Content
/// Figma: 41:3186 - Home --Empty State / Setup Payment --UPI

private struct SetupPaymentUPIContent: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
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

            // UPI Setup Card
            PaymentMethodSetupCard(
                focusMethod: .upi,
                coordinator: coordinator
            )

            // Stats and property sections
            StatsSection(viewModel: viewModel)
            PropertyDetailsSection(viewModel: viewModel)
        }
    }
}

// MARK: - Setup Payment Content
/// Figma: 41:7005 - setupPayment

private struct SetupPaymentContent: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
        VStack(spacing: Spacing.lg) {
            // Payment Methods Setup Card
            VStack(alignment: .leading, spacing: Spacing.md) {
                Text("SET UP PAYMENT METHODS")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppColors.neutral500)
                    .tracking(1.5)

                Text("Choose how you want to pay rent")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.black200)

                VStack(spacing: Spacing.sm) {
                    // UPI Option
                    PaymentMethodSetupRow(
                        icon: "indianrupeesign.circle.fill",
                        title: "UPI",
                        subtitle: "Instant payments, 1% cashback",
                        isLocked: false
                    ) {
                        coordinator.navigate(to: .paymentMethods)
                    }

                    // Net Banking Option
                    PaymentMethodSetupRow(
                        icon: "building.columns.fill",
                        title: "Net Banking",
                        subtitle: "Bank transfer, 1% cashback",
                        isLocked: false
                    ) {
                        coordinator.navigate(to: .paymentMethods)
                    }

                    // Credit Card Option (Locked)
                    PaymentMethodSetupRow(
                        icon: "creditcard.fill",
                        title: "Credit Card",
                        subtitle: "Locked - Complete verification first",
                        isLocked: true
                    ) {
                        // No action - locked
                    }
                }
            }
            .padding(Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.black400, lineWidth: 1)
            )

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

            // Property details
            PropertyDetailsSection(viewModel: viewModel)
        }
    }
}

// MARK: - Empty With UPI Content
/// Figma: 41:5792, 41:5998, 41:6204, 41:6385, 41:6598, 41:6811
/// Handles multiple empty state variants with UPI

private struct EmptyWithUPIContent: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator
    let hasPayments: Bool
    let hasCashback: Bool
    let isPaid: Bool

    var body: some View {
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

            // UPI Payment Method Chip (Active)
            HStack(spacing: Spacing.sm) {
                PaymentMethodChip(
                    icon: "indianrupeesign.circle.fill",
                    title: "UPI",
                    isActive: true
                )
                Spacer()
            }

            // Cashback Card (if applicable)
            if hasCashback {
                CashbackCard(viewModel: viewModel)
            } else if !isPaid {
                // No cashback explainer
                NoCashbackExplainerCard(landlordInvited: viewModel.landlordInvited)
            }

            // If paid this month, show success state
            if isPaid {
                RentPaidBanner(viewModel: viewModel)
            }

            // Recent Payments or Pay Rent CTA
            if hasPayments {
                RecentTransactionsSection(viewModel: viewModel, coordinator: coordinator)
            } else {
                PayRentCTACard(viewModel: viewModel, coordinator: coordinator)
            }

            // Landlord invitation status (if applicable)
            if viewModel.landlordInvitationStatus != .notSent &&
               viewModel.landlordInvitationStatus != .accepted {
                LandlordInvitationStatusCard(viewModel: viewModel, coordinator: coordinator)
            }

            // Stats and property
            StatsSection(viewModel: viewModel)
            PropertyDetailsSection(viewModel: viewModel)
        }
    }
}

// MARK: - Active State Content
/// Figma: 41:3267, 41:7246 (activeQualified), 41:3472, 41:7460 (activeComplete)

private struct ActiveStateContent: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator
    let showAllMethods: Bool

    var body: some View {
        VStack(spacing: Spacing.lg) {
            // Rent Due Card
            RentDueCard(viewModel: viewModel, coordinator: coordinator)

            // Cashback Card (only show if there's cashback)
            if viewModel.hasCashback {
                CashbackCard(viewModel: viewModel)
            }

            // Payment Methods Preview
            PaymentMethodsPreview(
                showAllMethods: showAllMethods,
                coordinator: coordinator
            )

            // Quick Actions
            QuickActions(coordinator: coordinator)

            // Recent Transactions
            RecentTransactionsSection(viewModel: viewModel, coordinator: coordinator)
        }
    }
}

// MARK: - Late Payment Content
/// Figma: 41:3677 - latePayment

private struct LatePaymentContent: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
        VStack(spacing: Spacing.lg) {
            // Warning Banner - yellow tint
            HStack(spacing: Spacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(AppColors.warning)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Pay by the 7th to earn cashback!")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.warning)

                    Text("You have \(viewModel.daysUntilCashbackExpiry) days left")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.warning.opacity(0.8))
                }

                Spacer()
            }
            .padding(Spacing.md)
            .background(AppColors.warning.opacity(0.1))
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.warning.opacity(0.3), lineWidth: 1)
            )

            // Rent Due Card with urgency
            LateRentDueCard(viewModel: viewModel, coordinator: coordinator)

            // Quick Actions
            QuickActions(coordinator: coordinator)
        }
    }
}

// MARK: - Missed Payment Content
/// Figma: 41:3885 - missedPayment

private struct MissedPaymentContent: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
        VStack(spacing: Spacing.lg) {
            // Overdue Banner - red tint
            HStack(spacing: Spacing.sm) {
                Image(systemName: "exclamationmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(AppColors.error)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Your rent is overdue")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.error)

                    Text("Pay now to avoid penalties and maintain your credit score.")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.error.opacity(0.8))
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer()
            }
            .padding(Spacing.md)
            .background(AppColors.error.opacity(0.1))
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.error.opacity(0.3), lineWidth: 1)
            )

            // Overdue Rent Card
            OverdueRentCard(viewModel: viewModel, coordinator: coordinator)

            // Quick Actions
            QuickActions(coordinator: coordinator)

            // Support contact
            SupportContactCard(coordinator: coordinator)
        }
    }
}

// MARK: - Multiple Missed Payments Content
/// Figma: 41:4093 - multipleMissedPayments

private struct MultipleMissedPaymentsContent: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator
    let months: Int
    let totalAmount: Double

    var body: some View {
        VStack(spacing: Spacing.lg) {
            // Critical error banner
            HStack(spacing: Spacing.sm) {
                Image(systemName: "exclamationmark.octagon.fill")
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.error)

                VStack(alignment: .leading, spacing: 2) {
                    Text("\(months) months overdue")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppColors.error)

                    Text("Your account may be suspended. Please clear dues immediately.")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.error.opacity(0.8))
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer()
            }
            .padding(Spacing.md)
            .background(AppColors.error.opacity(0.15))
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.error.opacity(0.4), lineWidth: 1)
            )

            // Total Outstanding Card
            TotalOutstandingCard(
                viewModel: viewModel,
                coordinator: coordinator,
                months: months,
                totalAmount: totalAmount
            )

            // Support contact card with emphasis
            SupportContactCard(coordinator: coordinator)
        }
    }
}

// MARK: - Paid State Content

private struct PaidStateContent: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator
    let settlementStatus: SettlementStatus

    var body: some View {
        VStack(spacing: Spacing.lg) {
            // Success Card
            PaidSuccessCard(viewModel: viewModel, settlementStatus: settlementStatus)

            // Cashback Earned (if applicable)
            if viewModel.lastPaymentCashback > 0 {
                CashbackEarnedCard(viewModel: viewModel)
            }

            // Settlement Status Card
            SettlementStatusCard(status: settlementStatus)

            // Quick Actions
            QuickActions(coordinator: coordinator)

            // Recent Transactions
            RecentTransactionsSection(viewModel: viewModel, coordinator: coordinator)
        }
    }
}

// MARK: - Reusable Sub-Components

// MARK: - Quick Setup Actions Section

private struct QuickSetupActionsSection: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("GET STARTED")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(1.5)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.sm) {
                    if !viewModel.bankDetailsComplete {
                        GetStartedPillButton(icon: "building.columns", title: "Add Bank Details") {
                            coordinator.navigate(to: .addBank)
                        }
                    }

                    if !viewModel.addressProofComplete {
                        GetStartedPillButton(icon: "doc.badge.plus", title: "Upload Address Proof") {
                            coordinator.navigate(to: .addUtility)
                        }
                    }

                    if !viewModel.landlordInvited && viewModel.landlordInvitationStatus == .notSent {
                        GetStartedPillButton(icon: "person.badge.plus", title: "Invite Landlord") {
                            coordinator.navigate(to: .inviteLandlord)
                        }
                    }

                    GetStartedPillButton(icon: "sparkles", title: "Add UPI") {
                        coordinator.navigate(to: .paymentMethods)
                    }
                }
            }
        }
    }
}

// MARK: - Landlord Invitation Status Card
/// Figma: 41:4765, 41:4969, 41:5175, 41:5381, 41:5587

private struct LandlordInvitationStatusCard: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("LANDLORD INVITATION")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(1.5)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: landlordInvitationIcon)
                        .font(.system(size: 14))
                        .foregroundColor(landlordInvitationColor)

                    Text(landlordInvitationTitle)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                }

                Text(landlordInvitationSubtitle)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                    .fixedSize(horizontal: false, vertical: true)

                // Action buttons based on UI state
                landlordInvitationActionButtons
            }
            .padding(Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(landlordInvitationBorderColor.opacity(0.3), lineWidth: 1)
            )
        }
    }

    @ViewBuilder
    private var landlordInvitationActionButtons: some View {
        switch viewModel.landlordInvitationUIState {
        case .notSent:
            EmptyView()

        case .sent:
            EmptyView()

        case .pendingUnder24hrs(let hoursRemaining):
            HStack(spacing: Spacing.xs) {
                Image(systemName: "clock")
                    .font(.system(size: 12))
                    .foregroundColor(AppColors.black300)

                Text("You can resend in \(hoursRemaining) hours")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.black300)
            }
            .padding(.top, Spacing.xxs)

        case .pendingOver24hrs(let daysSince):
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Sent \(daysSince) \(daysSince == 1 ? "day" : "days") ago")
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(AppColors.black300)

                Button(action: {
                    Task { await viewModel.resendLandlordInvitation() }
                }) {
                    Text("Resend invitation")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppColors.brand500)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.xs)
                        .background(AppColors.brand500.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
            .padding(.top, Spacing.xxs)

        case .failed(let reason):
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text(reason)
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(AppColors.error.opacity(0.8))

                HStack(spacing: Spacing.sm) {
                    Button(action: {
                        coordinator.navigate(to: .inviteLandlord)
                    }) {
                        Text("Edit details")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppColors.brand500)
                            .padding(.horizontal, Spacing.md)
                            .padding(.vertical, Spacing.xs)
                            .background(AppColors.brand500.opacity(0.15))
                            .clipShape(Capsule())
                    }

                    Button(action: {
                        coordinator.navigate(to: .helpFAQ)
                    }) {
                        Text("Contact support")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppColors.neutral500)
                            .padding(.horizontal, Spacing.md)
                            .padding(.vertical, Spacing.xs)
                            .background(AppColors.black400.opacity(0.3))
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.top, Spacing.xxs)

        case .declined:
            Button(action: {
                coordinator.navigate(to: .helpFAQ)
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

        case .accepted:
            EmptyView()
        }
    }

    private var landlordInvitationIcon: String {
        switch viewModel.landlordInvitationUIState {
        case .notSent:
            return "person.badge.plus"
        case .sent:
            return "paperplane.fill"
        case .pendingUnder24hrs, .pendingOver24hrs:
            return "clock.fill"
        case .failed:
            return "exclamationmark.triangle.fill"
        case .declined:
            return "exclamationmark.triangle.fill"
        case .accepted:
            return "checkmark.circle.fill"
        }
    }

    private var landlordInvitationColor: Color {
        switch viewModel.landlordInvitationUIState {
        case .notSent:
            return AppColors.neutral500
        case .sent, .pendingUnder24hrs, .pendingOver24hrs:
            return AppColors.brand500
        case .failed:
            return AppColors.error
        case .declined:
            return AppColors.warning
        case .accepted:
            return AppColors.success
        }
    }

    private var landlordInvitationBorderColor: Color {
        switch viewModel.landlordInvitationUIState {
        case .failed:
            return AppColors.error
        case .declined:
            return AppColors.warning
        case .accepted:
            return AppColors.success
        default:
            return AppColors.black400
        }
    }

    private var landlordInvitationTitle: String {
        switch viewModel.landlordInvitationUIState {
        case .notSent:
            return "Invite your landlord"
        case .sent:
            return "Invitation sent"
        case .pendingUnder24hrs, .pendingOver24hrs:
            return "Invitation pending"
        case .failed:
            return "Invitation failed"
        case .declined:
            return "Your landlord declined the invite"
        case .accepted:
            return "Landlord verified"
        }
    }

    private var landlordInvitationSubtitle: String {
        switch viewModel.landlordInvitationUIState {
        case .notSent:
            return "Invite your landlord to unlock cashback rewards."
        case .sent:
            return "Your landlord will receive an invitation shortly."
        case .pendingUnder24hrs, .pendingOver24hrs:
            return "Waiting for your landlord to accept. They'll receive an SMS and WhatsApp message."
        case .failed:
            return "We couldn't deliver the invitation. Check the contact details and retry."
        case .declined:
            return "Some landlords prefer to understand before joining. You can continue paying rent."
        case .accepted:
            return "Your landlord has verified their details. You're eligible for cashback!"
        }
    }
}

// MARK: - Stats Section

private struct StatsSection: View {
    let viewModel: HomeViewModel

    var body: some View {
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
                iconColor: AppColors.success,
                title: "Cashback",
                subtitle: "Available",
                value: viewModel.cashbackAvailable,
                valueColor: AppColors.success
            )
        }
    }
}

// MARK: - Property Details Section

private struct PropertyDetailsSection: View {
    let viewModel: HomeViewModel

    var body: some View {
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
                Divider()
                    .background(AppColors.black400.opacity(0.5))
                HomePropertyDetailRow(icon: "calendar", label: "Due Date", value: "\(viewModel.rentDueDay)\(viewModel.rentDueOrdinal) of every month")
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
}

// MARK: - Rent Due Card

private struct RentDueCard: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
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
                        .foregroundColor(viewModel.cashbackEligible ? AppColors.success : AppColors.brand500)

                    if viewModel.cashbackEligible {
                        Text("Cashback eligible")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(AppColors.success)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(AppColors.success.opacity(0.15))
                            .clipShape(Capsule())
                    }
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
}

// MARK: - Cashback Card

private struct CashbackCard: View {
    let viewModel: HomeViewModel

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ZStack {
                Circle()
                    .fill(AppColors.success.opacity(0.15))
                    .frame(width: 40, height: 40)

                Image(systemName: "gift.fill")
                    .font(.system(size: 18))
                    .foregroundColor(AppColors.success)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Cashback Available")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)

                Text(viewModel.cashbackAvailable)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(AppColors.success)
            }

            Spacer()

            Text("Will be applied")
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(AppColors.black300)
        }
        .padding(Spacing.md)
        .background(AppColors.success.opacity(0.08))
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.success.opacity(0.2), lineWidth: 1)
        )
    }
}

// MARK: - No Cashback Explainer Card

private struct NoCashbackExplainerCard: View {
    let landlordInvited: Bool

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ZStack {
                Circle()
                    .fill(AppColors.black400.opacity(0.3))
                    .frame(width: 40, height: 40)

                Image(systemName: "gift")
                    .font(.system(size: 18))
                    .foregroundColor(AppColors.neutral500)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("No cashback yet")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)

                Text(landlordInvited ?
                     "Pay rent before the 7th to earn 1% cashback" :
                     "Cashback requires landlord verification")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Spacer()
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

// MARK: - Rent Paid Banner

private struct RentPaidBanner: View {
    let viewModel: HomeViewModel

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 24))
                .foregroundColor(AppColors.success)

            VStack(alignment: .leading, spacing: 2) {
                Text("Rent Paid!")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(AppColors.success)

                Text("\(viewModel.rentAmount) paid on \(viewModel.lastPaymentDate)")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Spacer()
        }
        .padding(Spacing.md)
        .background(AppColors.success.opacity(0.1))
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.success.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Pay Rent CTA Card

private struct PayRentCTACard: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
        VStack(spacing: Spacing.md) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text("Rent Due")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500)

                    Text(viewModel.rentAmount)
                        .font(.system(size: 28, weight: .light))
                        .foregroundColor(.white)
                        .monospacedDigit()
                }

                Spacer()

                if viewModel.cashbackEligible {
                    VStack(alignment: .trailing, spacing: Spacing.xxs) {
                        Text("Pay by the 7th")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.success)

                        Text("Earn \(viewModel.formatCurrency(viewModel.tenancy?.monthlyRent ?? 0 * 0.01)) cashback")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppColors.success)
                    }
                }
            }

            PrimaryButton(title: "Pay Rent") {
                coordinator.navigate(to: .paymentMethods)
            }
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

// MARK: - Payment Methods Preview

private struct PaymentMethodsPreview: View {
    let showAllMethods: Bool
    let coordinator: AppCoordinator

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Text("PAYMENT METHODS")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppColors.neutral500)
                    .tracking(1.5)

                Spacer()

                TextButton(title: "Manage") {
                    coordinator.navigate(to: .paymentMethods)
                }
            }

            HStack(spacing: Spacing.sm) {
                // UPI - Always available for qualified users
                PaymentMethodChip(
                    icon: "indianrupeesign.circle.fill",
                    title: "UPI",
                    isActive: true
                )

                // Net Banking - Always available for qualified users
                PaymentMethodChip(
                    icon: "building.columns.fill",
                    title: "Netbanking",
                    isActive: true
                )

                if showAllMethods {
                    // Credit Card - Only for complete users
                    PaymentMethodChip(
                        icon: "creditcard.fill",
                        title: "Card",
                        isActive: true
                    )
                }
            }
        }
    }
}

// MARK: - Quick Actions

private struct QuickActions: View {
    let coordinator: AppCoordinator

    var body: some View {
        HStack(spacing: Spacing.sm) {
            QuickActionButton(icon: "clock.arrow.circlepath", title: "History") {
                coordinator.navigate(to: .transactions)
            }

            QuickActionButton(icon: "doc.text", title: "Receipt") {
                // Show latest receipt
            }

            QuickActionButton(icon: "questionmark.circle", title: "Help") {
                coordinator.navigate(to: .helpFAQ)
            }
        }
    }
}

// MARK: - Recent Transactions Section

private struct RecentTransactionsSection: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
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

            if viewModel.recentPayments.isEmpty {
                // Empty state
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
            } else {
                // Show last 3 transactions
                VStack(spacing: 0) {
                    ForEach(Array(viewModel.recentPayments.prefix(3).enumerated()), id: \.element.id) { index, payment in
                        TransactionRow(payment: payment)
                            .onTapGesture {
                                coordinator.navigate(to: .transactionDetail(id: payment.id))
                            }

                        if index < min(2, viewModel.recentPayments.count - 1) {
                            Divider()
                                .background(AppColors.black400.opacity(0.5))
                        }
                    }
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
    }
}

// MARK: - Late Rent Due Card

private struct LateRentDueCard: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
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
                    if viewModel.daysUntilDue < 0 {
                        Text("Overdue")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.error)

                        Text("\(abs(viewModel.daysUntilDue)) days")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(AppColors.error)
                    } else {
                        Text("Due in")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.neutral500)

                        Text("\(viewModel.daysUntilDue) days")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(AppColors.warning)
                    }
                }
            }

            PrimaryButton(title: "Pay Now") {
                coordinator.navigate(to: .paymentMethods)
            }
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.warning.opacity(0.5), lineWidth: 1)
        )
    }
}

// MARK: - Overdue Rent Card

private struct OverdueRentCard: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator

    var body: some View {
        VStack(spacing: Spacing.md) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text("Rent Overdue")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.error)

                    Text(viewModel.rentAmount)
                        .font(.system(size: 32, weight: .light))
                        .foregroundColor(.white)
                        .monospacedDigit()
                }

                Spacer()

                VStack(alignment: .trailing, spacing: Spacing.xxs) {
                    Text("Overdue by")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.error)

                    Text("\(abs(viewModel.daysUntilDue)) days")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppColors.error)
                }
            }

            // Pay Now button with error styling
            Button(action: {
                coordinator.navigate(to: .paymentMethods)
            }) {
                Text("Pay Now")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(AppColors.error)
                    .cornerRadius(Radius.sm)
                    .padding(4)
                    .background(AppColors.error.opacity(0.7))
                    .cornerRadius(Radius.md)
            }
            .buttonStyle(PressableButtonStyle())
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.error.opacity(0.5), lineWidth: 1)
        )
    }
}

// MARK: - Total Outstanding Card

private struct TotalOutstandingCard: View {
    let viewModel: HomeViewModel
    let coordinator: AppCoordinator
    let months: Int
    let totalAmount: Double

    var body: some View {
        VStack(spacing: Spacing.md) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text("Total Outstanding")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.error)

                    Text(viewModel.formatCurrency(totalAmount))
                        .font(.system(size: 32, weight: .light))
                        .foregroundColor(.white)
                        .monospacedDigit()
                }

                Spacer()

                VStack(alignment: .trailing, spacing: Spacing.xxs) {
                    Text("Months overdue")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.error)

                    Text("\(months)")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(AppColors.error)
                }
            }

            // Pay All Dues button
            Button(action: {
                coordinator.navigate(to: .paymentMethods)
            }) {
                Text("Pay All Dues - \(viewModel.formatCurrency(totalAmount))")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(AppColors.error)
                    .cornerRadius(Radius.sm)
                    .padding(4)
                    .background(AppColors.error.opacity(0.7))
                    .cornerRadius(Radius.md)
            }
            .buttonStyle(PressableButtonStyle())
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.error.opacity(0.5), lineWidth: 2)
        )
    }
}

// MARK: - Support Contact Card

private struct SupportContactCard: View {
    let coordinator: AppCoordinator

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "headphones")
                .font(.system(size: 20))
                .foregroundColor(AppColors.brand500)

            VStack(alignment: .leading, spacing: 2) {
                Text("Need help?")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)

                Text("Contact our support team for payment assistance")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Spacer()

            Button(action: {
                coordinator.navigate(to: .helpFAQ)
            }) {
                Text("Contact")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppColors.brand500)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.xs)
                    .background(AppColors.brand500.opacity(0.15))
                    .clipShape(Capsule())
            }
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

// MARK: - Payment Method Setup Card

private struct PaymentMethodSetupCard: View {
    let focusMethod: PaymentMethodType
    let coordinator: AppCoordinator

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack {
                Text("SET UP \(focusMethod.rawValue.uppercased()) PAYMENTS")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppColors.neutral500)
                    .tracking(1.5)

                Spacer()

                Text("1 of 2 methods")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.black300)
            }

            HStack(spacing: Spacing.sm) {
                Image(systemName: focusMethod.icon)
                    .font(.system(size: 24))
                    .foregroundColor(AppColors.brand500)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Set up \(focusMethod.rawValue) payments")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.white)

                    Text(focusMethod.description)
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.brand500)
            }
            .padding(Spacing.md)
            .background(AppColors.brand500.opacity(0.1))
            .cornerRadius(Radius.sm)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .stroke(AppColors.brand500.opacity(0.3), lineWidth: 1)
            )
            .onTapGesture {
                coordinator.navigate(to: .paymentMethods)
            }
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

// MARK: - Paid Success Card

private struct PaidSuccessCard: View {
    let viewModel: HomeViewModel
    let settlementStatus: SettlementStatus

    var body: some View {
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

            Text("\(viewModel.rentAmount) paid on \(viewModel.lastPaymentDate)")
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral500)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.lg)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.success.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Cashback Earned Card

private struct CashbackEarnedCard: View {
    let viewModel: HomeViewModel

    var body: some View {
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

            Text("\(viewModel.formatCurrency(viewModel.lastPaymentCashback)) cashback!")
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
    }
}

// MARK: - Settlement Status Card

private struct SettlementStatusCard: View {
    let status: SettlementStatus

    var body: some View {
        HStack(spacing: Spacing.sm) {
            // Status indicator
            switch status {
            case .pending:
                Image(systemName: "clock")
                    .foregroundColor(AppColors.black300)
            case .processing:
                ProgressView()
                    .scaleEffect(0.8)
                    .tint(AppColors.brand500)
            case .completed:
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(AppColors.success)
            case .failed:
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundColor(AppColors.error)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(settlementStatusTitle)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)

                Text(settlementStatusSubtitle)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Spacer()

            if status == .completed {
                Button(action: {
                    // Download receipt
                }) {
                    Text("Receipt")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppColors.brand500)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.xs)
                        .background(AppColors.brand500.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.black400, lineWidth: 1)
        )
    }

    private var settlementStatusTitle: String {
        switch status {
        case .pending:
            return "Settlement pending"
        case .processing:
            return "Transferring to landlord..."
        case .completed:
            return "Transferred to landlord"
        case .failed:
            return "Transfer failed"
        }
    }

    private var settlementStatusSubtitle: String {
        switch status {
        case .pending:
            return "Your payment is being processed"
        case .processing:
            return "Usually completes within 24 hours"
        case .completed:
            return "Your landlord has received the payment"
        case .failed:
            return "We're looking into this. Contact support if needed."
        }
    }
}

// MARK: - Supporting Views

// MARK: - Transaction Row

struct TransactionRow: View {
    let payment: PaymentData

    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, yyyy"
        return formatter
    }

    private var formattedDate: String {
        // Parse ISO date and format
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = isoFormatter.date(from: payment.createdAt) {
            return dateFormatter.string(from: date)
        }
        return payment.paymentMonth
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            // Status icon
            ZStack {
                Circle()
                    .fill(payment.paymentStatus.color.opacity(0.15))
                    .frame(width: 40, height: 40)

                Image(systemName: payment.paymentStatus.iconName)
                    .font(.system(size: 16))
                    .foregroundColor(payment.paymentStatus.color)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Rent Payment")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)

                Text(formattedDate)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(formatCurrency(payment.totalAmount))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)

                Text(payment.paymentStatus.displayName)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(payment.paymentStatus.color)
            }
        }
        .contentShape(Rectangle())
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "\u{20B9}\(Int(amount))"
    }
}

// MARK: - Payment Method Chip

struct PaymentMethodChip: View {
    let icon: String
    let title: String
    let isActive: Bool

    var body: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(isActive ? AppColors.brand500 : AppColors.black400)

            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(isActive ? .white : AppColors.neutral500)
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .background(isActive ? AppColors.black500 : AppColors.black600)
        .cornerRadius(Radius.xxl)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.xxl)
                .stroke(isActive ? AppColors.brand500.opacity(0.5) : AppColors.black400, lineWidth: 1)
        )
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

// MARK: - Get Started Pill Button

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

// MARK: - Home Stats Card

struct HomeStatsCard: View {
    let icon: String
    let iconColor: Color
    let title: String
    let subtitle: String
    let value: String
    var valueColor: Color = AppColors.brand500

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

            // Value - 32px light
            Text(value)
                .font(.system(size: 32, weight: .light))
                .foregroundColor(valueColor)
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

// MARK: - Skeleton Views

struct HomeSkeletonCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    SkeletonView(height: 14)
                        .frame(width: 80)
                    SkeletonView(height: 32)
                        .frame(width: 140)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: Spacing.xs) {
                    SkeletonView(height: 14)
                        .frame(width: 60)
                    SkeletonView(height: 20)
                        .frame(width: 80)
                }
            }

            SkeletonView(height: 56, cornerRadius: Radius.md)
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
    }
}

struct HomeSkeletonStatsCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            SkeletonView(height: 40, cornerRadius: 20)
                .frame(width: 40)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                SkeletonView(height: 12)
                    .frame(width: 60)
                SkeletonView(height: 12)
                    .frame(width: 80)
            }

            SkeletonView(height: 32)
                .frame(width: 60)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
    }
}

struct HomeSkeletonPropertyCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            SkeletonView(height: 12)
                .frame(width: 120)

            VStack(spacing: 0) {
                ForEach(0..<3, id: \.self) { index in
                    HStack(spacing: Spacing.sm) {
                        SkeletonView(height: 20, cornerRadius: 4)
                            .frame(width: 20)

                        VStack(alignment: .leading, spacing: Spacing.xxs) {
                            SkeletonView(height: 12)
                                .frame(width: 80)
                            SkeletonView(height: 14)
                                .frame(width: 140)
                        }

                        Spacer()
                    }
                    .padding(.vertical, Spacing.sm)

                    if index < 2 {
                        Divider()
                            .background(AppColors.black400.opacity(0.5))
                    }
                }
            }
            .padding(Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
        }
    }
}

// MARK: - Payment Method Setup Row

struct PaymentMethodSetupRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let isLocked: Bool
    let action: () -> Void

    var body: some View {
        Button(action: {
            if !isLocked { action() }
        }) {
            HStack(spacing: Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(isLocked ? AppColors.black400 : AppColors.brand500)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(isLocked ? AppColors.neutral500 : .white)

                    Text(subtitle)
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(isLocked ? AppColors.black300 : AppColors.neutral500)
                }

                Spacer()

                if isLocked {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 12))
                        .foregroundColor(AppColors.black400)
                } else {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppColors.brand500)
                }
            }
            .padding(Spacing.md)
            .background(isLocked ? AppColors.black600 : AppColors.black500)
            .cornerRadius(Radius.sm)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
        .disabled(isLocked)
    }
}

// MARK: - Previews

#Preview("Active Complete") {
    HomeView(state: .activeComplete)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Active Qualified (UPI Only)") {
    HomeView(state: .activeQualified)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Zero State") {
    HomeView(state: .zeroState)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Late Payment") {
    HomeView(state: .latePayment)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Missed Payment") {
    HomeView(state: .missedPayment)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Multiple Missed Payments") {
    HomeView(state: .multipleMissedPayments(months: 2, totalAmount: 50000))
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Paid - Processing") {
    HomeView(state: .paidThisMonth(settlementStatus: .processing))
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Paid - Completed") {
    HomeView(state: .paidThisMonth(settlementStatus: .completed))
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Setup Payment") {
    HomeView(state: .setupPayment)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Empty With UPI Payments") {
    HomeView(state: .emptyWithUPIPayments)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Empty With Cashback") {
    HomeView(state: .emptyWithCashback)
        .environment(AppCoordinator())
        .environment(AppState())
}
