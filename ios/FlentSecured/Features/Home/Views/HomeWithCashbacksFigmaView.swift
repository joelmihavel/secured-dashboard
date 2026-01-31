/// HomeWithCashbacksFigmaView.swift
/// Pixel-perfect implementation of Figma node 41:6385 "Home --Empty State / With Cashbacks"
///
/// This view implements the Home screen with:
/// - UPI payment method selected (carousel card)
/// - "Recent Payments" / "Cashbacks" tab selector
/// - Cashback statistics section
/// - Setup progress card with countdown
/// - Sticky footer with Review button
///
/// Figma Reference:
/// - Node: 41:6385
/// - File: HZaVuwWn6B6jOjrmxZ7Kzv
/// - Design Width: 393pt (iPhone 14 Pro)

import SwiftUI

// MARK: - Main Home With Cashbacks View

struct HomeWithCashbacksFigmaView: View {
    // MARK: - Visual Testing Mode
    /// When true, uses exact Figma mock data for pixel-perfect comparison
    var isVisualTestMode: Bool = true

    // MARK: - State
    @State private var selectedTab: CashbackTab = .cashbacks
    @State private var currentCardIndex: Int = 0
    @State private var viewModel = HomeViewModel()
    @State private var countdownSeconds: Int = 28 * 3600 + 12 * 60 + 12 // 28:12:12

    enum CashbackTab: String, CaseIterable {
        case recentPayments = "Recent Payments"
        case cashbacks = "Cashbacks"
    }

    // MARK: - Mock Data (Figma exact values)
    private struct FigmaMockData {
        static let userName = "Rishabh"
        static let daysUntilDue = 10
        static let rentAmount = "32,500"
        static let daysInFooter = 28
        static let cashbackAccrued = "325"
        static let cashbackTotal = "3,256"
        static let cashbackRate = "0.8%"
        static let upiId = "rishabh@***"
        static let accountMasked = "xxx23"
        static let bankName = "ICICI a/c"
    }

    // Computed properties
    private var userName: String {
        guard !isVisualTestMode else { return FigmaMockData.userName }
        let name = viewModel.firstName
        return (name.isEmpty || name == "there") ? FigmaMockData.userName : name
    }

    private var daysUntilDue: Int {
        guard !isVisualTestMode else { return FigmaMockData.daysUntilDue }
        return viewModel.daysUntilDue == 0 ? FigmaMockData.daysUntilDue : viewModel.daysUntilDue
    }

    private var countdownFormatted: String {
        let hours = countdownSeconds / 3600
        let minutes = (countdownSeconds % 3600) / 60
        let seconds = countdownSeconds % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }

    var body: some View {
        ZStack {
            // Background - Figma: #131313
            AppColors.black700
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HomeHeaderFigma(userName: userName)

                // Scrollable Content
                ScrollView(showsIndicators: false) {
                    VStack(spacing: Spacing.lg) { // 24pt gap between sections
                        // Headline Section
                        HeadlineSectionCashback(daysUntilDue: daysUntilDue)

                        // Payment Card Carousel
                        PaymentCardCarousel(
                            currentIndex: $currentCardIndex,
                            isVisualTestMode: isVisualTestMode
                        )

                        // Tab Selector
                        CashbackTabSelector(selectedTab: $selectedTab)

                        // Tab Content
                        if selectedTab == .cashbacks {
                            CashbackStatsSection()
                        } else {
                            RecentPaymentsList()
                        }

                        // Setup Progress Card
                        SetupProgressCardCashback(
                            countdownTime: countdownFormatted,
                            bankDetailsComplete: true,
                            addressProofComplete: false,
                            landlordInvited: false
                        )
                    }
                    .padding(.bottom, 100) // Space for footer
                }

                // Sticky Footer
                CashbackFooter(
                    rentAmount: FigmaMockData.rentAmount,
                    daysUntilDue: FigmaMockData.daysInFooter
                )
            }
        }
        .task {
            await viewModel.loadDashboard()
        }
    }
}

// MARK: - Headline Section (Cashback variant)
/// "Your rent is due in 10 days" with "Paying with:" subtitle

struct HeadlineSectionCashback: View {
    let daysUntilDue: Int

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) { // 8pt gap
            // Main headline
            VStack(alignment: .leading, spacing: 0) {
                Text("Your rent is due")
                    .font(Typography.h4)
                    .foregroundColor(Color(hex: "BABABA"))

                Text("in \(daysUntilDue) days")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.brand500)
            }

            // "Paying with:" subtitle
            Text("Paying with:")
                .font(Typography.bodyMd2)
                .foregroundColor(AppColors.neutral600)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.xl) // 32pt
    }
}

// MARK: - Payment Card Carousel
/// Horizontal scrolling payment method cards with dots indicator

struct PaymentCardCarousel: View {
    @Binding var currentIndex: Int
    var isVisualTestMode: Bool = true

    // Mock cards for visual testing
    private let cards = [
        PaymentCardData(
            type: .upi,
            bankName: "ICICI a/c",
            accountMasked: "xxx23",
            upiId: "rishabh@***",
            isSelected: true
        ),
        PaymentCardData(
            type: .card,
            bankName: "SBI Card",
            accountMasked: "4532",
            upiId: nil,
            isSelected: false
        ),
        PaymentCardData(
            type: .netBanking,
            bankName: "HDFC",
            accountMasked: "xxx89",
            upiId: nil,
            isSelected: false
        )
    ]

    var body: some View {
        VStack(spacing: Spacing.md) { // 16pt
            // Card carousel
            TabView(selection: $currentIndex) {
                ForEach(Array(cards.enumerated()), id: \.offset) { index, card in
                    HomePaymentMethodCard(card: card)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 200) // Card height
            .padding(.horizontal, Spacing.xl) // 32pt

            // Dots indicator
            HStack(spacing: Spacing.xs) {
                ForEach(0..<cards.count, id: \.self) { index in
                    Circle()
                        .fill(index == currentIndex ? AppColors.brand500 : AppColors.black400)
                        .frame(width: 6, height: 6)
                }
            }
        }
    }
}

// MARK: - Payment Card Data Model

struct PaymentCardData: Identifiable {
    let id = UUID()
    let type: PaymentCardType
    let bankName: String
    let accountMasked: String
    let upiId: String?
    let isSelected: Bool

    enum PaymentCardType {
        case upi
        case card
        case netBanking
    }
}

// MARK: - Home Payment Method Card
/// Dark card showing UPI or card details with "SELECTED" badge

private struct HomePaymentMethodCard: View {
    let card: PaymentCardData

    var body: some View {
        HStack(spacing: 0) {
            // Main card content
            VStack(alignment: .leading, spacing: Spacing.lg) { // 24pt
                // Header with UPI logo and SELECTED badge
                HStack {
                    // UPI Logo
                    Image("upi_logo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(height: 20)

                    Spacer()

                    // SELECTED badge
                    if card.isSelected {
                        Text("SELECTED")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(AppColors.black400)
                            .clipShape(Capsule())
                    }
                }

                Spacer()

                // Account details
                VStack(alignment: .leading, spacing: Spacing.xxs) { // 4pt
                    // Bank + masked account
                    Text("\(card.bankName) - \(card.accountMasked)")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.neutral300)

                    // UPI ID (masked)
                    if let upiId = card.upiId {
                        Text(upiId)
                            .font(Typography.bodyMd2)
                            .foregroundColor(AppColors.neutral500)
                    }
                }

                // Footer with method type and Flent logo
                HStack {
                    HStack(spacing: Spacing.xxs) {
                        Text("UPI")
                            .font(Typography.bodyMd2)
                            .foregroundColor(AppColors.neutral300)

                        Image(systemName: "pencil")
                            .font(.system(size: 12))
                            .foregroundColor(AppColors.neutral500)
                    }

                    Spacer()

                    // Flent logo
                    Image("flent-logo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 20, height: 24)
                }
            }
            .padding(Spacing.lg) // 24pt
            .frame(width: 220)
            .background(
                ZStack {
                    AppColors.black600

                    // Pattern overlay
                    Image("card_pattern")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .opacity(0.1)
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))

            // Peek of next card
            Rectangle()
                .fill(Color.clear)
                .frame(width: 40)
        }
    }
}

// MARK: - Cashback Tab Selector
/// "Recent Payments" | "Cashbacks" pill selector

struct CashbackTabSelector: View {
    @Binding var selectedTab: HomeWithCashbacksFigmaView.CashbackTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(HomeWithCashbacksFigmaView.CashbackTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                } label: {
                    Text(tab.rawValue)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(selectedTab == tab ? .white : AppColors.neutral500)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.xs)
                        .background(
                            selectedTab == tab ?
                            AnyView(Capsule().fill(AppColors.black500)) :
                            AnyView(Color.clear)
                        )
                }
                .buttonStyle(.plain)
            }

            Spacer()
        }
        .padding(.horizontal, Spacing.xl) // 32pt
    }
}

// MARK: - Cashback Stats Section
/// Shows CASHBACK ACCRUED, All-time Total, and Cashback Rate

struct CashbackStatsSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) { // 24pt
            // Section label
            Text("CASHBACK ACCRUED")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppColors.neutral500)
                .tracking(1)

            // Main cashback amount
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text("\u{20B9}")
                    .font(.system(size: 24, weight: .regular))
                    .foregroundColor(AppColors.success)

                Text("325")
                    .font(.system(size: 48, weight: .light))
                    .foregroundColor(AppColors.success)

                Text(".50")
                    .font(.system(size: 24, weight: .regular))
                    .foregroundColor(AppColors.success.opacity(0.6))
            }

            // Stats rows
            VStack(spacing: Spacing.md) { // 16pt
                // All-time Total
                HStack {
                    Text("All-time Total")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.neutral500)

                    Spacer()

                    HStack(spacing: 2) {
                        Text("\u{20B9}")
                            .font(.system(size: 14, weight: .regular))
                            .foregroundColor(AppColors.success)

                        Text("3,256")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(AppColors.success)

                        Text(".00")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.success.opacity(0.6))
                    }
                }

                // Cashback Rate
                HStack {
                    Text("Cashback Rate")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.neutral500)

                    Spacer()

                    HStack(spacing: 2) {
                        Text("0.8%")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.white)

                        Text("Avg")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.neutral600)
                    }
                }
            }
        }
        .padding(.horizontal, Spacing.xl) // 32pt
    }
}

// MARK: - Recent Payments List
/// List of recent payment transactions

struct RecentPaymentsList: View {
    private let payments = [
        RecentPaymentData(
            month: "September rent",
            status: .paid,
            date: "15 Sep, 9:40am",
            amount: "32,500"
        ),
        RecentPaymentData(
            month: "August rent",
            status: .pending,
            date: "15 Sep, 9:40am",
            amount: "32,500"
        ),
        RecentPaymentData(
            month: "July rent",
            status: .failed,
            date: "15 Sep, 9:40am",
            amount: "32,500"
        )
    ]

    var body: some View {
        VStack(spacing: Spacing.md) { // 16pt
            ForEach(payments) { payment in
                RecentPaymentRow(payment: payment)
            }
        }
        .padding(.horizontal, Spacing.xl) // 32pt
    }
}

struct RecentPaymentData: Identifiable {
    let id = UUID()
    let month: String
    let status: PaymentStatus
    let date: String
    let amount: String

    enum PaymentStatus {
        case paid
        case pending
        case failed

        var color: Color {
            switch self {
            case .paid: return AppColors.success
            case .pending: return AppColors.brand500
            case .failed: return AppColors.error
            }
        }

        var label: String {
            switch self {
            case .paid: return "Paid"
            case .pending: return "Pending"
            case .failed: return "Failed"
            }
        }
    }
}

struct RecentPaymentRow: View {
    let payment: RecentPaymentData

    var body: some View {
        HStack(spacing: Spacing.sm) { // 12pt
            // Avatar/icon
            Circle()
                .fill(
                    LinearGradient(
                        colors: [AppColors.brand500, Color(hex: "FF6B6B")],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 40, height: 40)

            // Payment info
            VStack(alignment: .leading, spacing: 2) {
                Text(payment.month)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)

                HStack(spacing: 4) {
                    Circle()
                        .fill(payment.status.color)
                        .frame(width: 6, height: 6)

                    Text("\(payment.status.label) - \(payment.date)")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500)
                }
            }

            Spacer()

            // Amount
            Text("\u{20B9} \(payment.amount)")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white)
        }
    }
}

// MARK: - Setup Progress Card (Cashback variant)
/// Shows countdown and setup checklist

struct SetupProgressCardCashback: View {
    let countdownTime: String
    let bankDetailsComplete: Bool
    let addressProofComplete: Bool
    let landlordInvited: Bool

    private var setupItems: [(title: String, subtitle: String, isActive: Bool)] {
        [
            ("Add landlord's bank details", "enables secure payouts", bankDetailsComplete),
            ("Upload address proof", "for verification", addressProofComplete),
            ("Invite your landlord", "needed for cashback eligibility", landlordInvited)
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) { // 24pt
            // Countdown title
            HStack(spacing: 0) {
                Text("Complete setup in ")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.neutral300)

                Text(countdownTime)
                    .font(Typography.bodyMd2Medium)
                    .foregroundColor(AppColors.brand500)
                    .underline()

                Text(" to")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.neutral300)
            }

            Text("unlock Cashbacks")
                .font(Typography.bodyMd2)
                .foregroundColor(AppColors.neutral300)

            // Setup checklist
            VStack(spacing: Spacing.lg) { // 24pt
                ForEach(Array(setupItems.enumerated()), id: \.offset) { index, item in
                    SetupItemRowCashback(
                        title: item.title,
                        subtitle: item.subtitle,
                        isActive: item.isActive,
                        isLast: index == setupItems.count - 1
                    )
                }
            }

            // Finish Setup button
            GradientBorderButton(title: "Finish Setup") {}
        }
        .padding(.horizontal, Spacing.md) // 16pt
        .padding(.vertical, Spacing.lg) // 24pt
        .background(AppColors.black500)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .padding(.horizontal, Spacing.xl) // 32pt outer padding
    }
}

struct SetupItemRowCashback: View {
    let title: String
    let subtitle: String
    let isActive: Bool
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.xs) { // 8pt
            // Indicator + line
            VStack(spacing: 0) {
                Circle()
                    .fill(isActive ? AppColors.brand500 : AppColors.black400)
                    .frame(width: 20, height: 20)

                if !isLast {
                    Rectangle()
                        .fill(isActive ? AppColors.brand500.opacity(0.5) : AppColors.black400)
                        .frame(width: 2, height: 44)
                }
            }

            // Text content
            VStack(alignment: .leading, spacing: Spacing.xxs) { // 4pt
                Text(title)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.neutral300)

                Text(subtitle)
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.neutral600)
            }

            Spacer()
        }
    }
}

// MARK: - Cashback Footer
/// Sticky footer with due info and Review button

struct CashbackFooter: View {
    let rentAmount: String
    let daysUntilDue: Int

    var body: some View {
        HStack {
            // Left: Due info
            VStack(alignment: .leading, spacing: Spacing.xxs) { // 4pt
                Text("Due in \(daysUntilDue) Days")
                    .font(Typography.bodySmBold)
                    .foregroundColor(AppColors.neutral500)

                HStack(spacing: 2) {
                    Text("\u{20B9}")
                        .font(Typography.bodySmSemiBold)
                        .foregroundColor(AppColors.neutral100)

                    Text(rentAmount)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.neutral100)
                        .tracking(-0.48)
                }
            }

            Spacer()

            // Right: Review button
            Button {
                // Navigate to review
            } label: {
                Text("Review")
                    .font(Typography.bodyMdMedium)
                    .foregroundColor(.white)
                    .padding(.horizontal, Spacing.xl) // 32pt
                    .padding(.vertical, Spacing.sm) // 12pt
                    .background(AppColors.brand500)
                    .clipShape(Capsule())
            }
        }
        .padding(.horizontal, Spacing.xl) // 32pt
        .padding(.top, Spacing.md) // 16pt
        .padding(.bottom, Spacing.xxl) // 40pt for safe area
        .background(AppColors.black500)
    }
}

// MARK: - Preview

#Preview("Home with Cashbacks - 41:6385") {
    HomeWithCashbacksFigmaView()
}

#Preview("Cashbacks Tab Selected") {
    HomeWithCashbacksFigmaView(isVisualTestMode: true)
}
