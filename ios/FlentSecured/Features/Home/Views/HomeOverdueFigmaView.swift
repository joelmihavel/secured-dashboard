/// HomeOverdueFigmaView.swift
/// Pixel-perfect implementation of Figma overdue/late payment states:
/// - 41:3677 "Home --Overdue by 10 Days" - Yellow warning state
/// - 41:3885 "Home --Missed December Rent" - Red error state
/// - 41:4093 "Home --Multiple Payments Overdue" - Critical error state
///
/// Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
/// Design Width: 393pt (iPhone 14 Pro)

import SwiftUI

// MARK: - Overdue State Type

enum OverdueStateType {
    /// Yellow warning: "Your rent is overdue by X days"
    /// Shows: "Cashback may be impacted if delayed further"
    case lateByDays(days: Int)

    /// Red error: "You missed your [Month] Rent"
    /// Shows: "Your payment streak has been broken"
    case missedMonthRent(month: String)

    /// Critical error: "Multiple payments are overdue"
    /// Shows: "Account benefits may be restricted"
    case multipleOverdue

    var warningColor: Color {
        switch self {
        case .lateByDays:
            return AppColors.warning
        case .missedMonthRent, .multipleOverdue:
            return AppColors.error
        }
    }

    var bannerText: String {
        switch self {
        case .lateByDays:
            return "Cashback may be impacted if delayed further"
        case .missedMonthRent:
            return "Your payment streak has been broken"
        case .multipleOverdue:
            return "Account benefits may be restricted"
        }
    }

    var headlineWhite: String {
        switch self {
        case .lateByDays:
            return "Your rent is overdue"
        case .missedMonthRent:
            return "You missed your"
        case .multipleOverdue:
            return "Multiple payments"
        }
    }

    var headlineColored: String {
        switch self {
        case .lateByDays(let days):
            return "by \(days) days"
        case .missedMonthRent(let month):
            return "\(month) Rent"
        case .multipleOverdue:
            return "are overdue"
        }
    }
}

// MARK: - Main Overdue View

struct HomeOverdueFigmaView: View {
    /// When true, uses exact Figma mock data for pixel-perfect comparison
    var isVisualTestMode: Bool = true

    /// The overdue state type
    var overdueState: OverdueStateType = .lateByDays(days: 10)

    // MARK: - State
    @State private var selectedTab: OverdueTab = .recentPayments
    @State private var currentCardIndex: Int = 0
    @State private var viewModel = HomeViewModel()

    enum OverdueTab: String, CaseIterable {
        case recentPayments = "Recent Payments"
        case cashbacks = "Cashbacks"
    }

    // MARK: - Mock Data (Figma exact values)
    private struct FigmaMockData {
        static let userName = "Rishabh"
        static let rentAmount = "32,500"
        static let dueInDays = 10
    }

    private var userName: String {
        guard !isVisualTestMode else { return FigmaMockData.userName }
        let name = viewModel.firstName
        return (name.isEmpty || name == "there") ? FigmaMockData.userName : name
    }

    var body: some View {
        ZStack {
            // Background - Figma: #131313
            AppColors.black700
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Scrollable Content
                ScrollView(showsIndicators: false) {
                    VStack(spacing: Spacing.lg) { // 24pt
                        // Header
                        HomeHeaderFigma(userName: userName)

                        // Warning Banner
                        OverdueWarningBanner(state: overdueState)

                        // Headline
                        OverdueHeadline(state: overdueState)

                        // "Paying with:" label
                        HStack {
                            Text("Paying with:")
                                .font(Typography.bodyMd2)
                                .foregroundColor(AppColors.neutral600)
                            Spacer()
                        }
                        .padding(.horizontal, Spacing.xl)

                        // Payment Card (Credit Card in Figma for overdue states)
                        CreditCardCarouselOverdue(currentIndex: $currentCardIndex)

                        // Tab Selector
                        OverdueTabSelector(selectedTab: $selectedTab)

                        // Tab Content
                        if selectedTab == .recentPayments {
                            RecentPaymentsListOverdue()
                        } else {
                            // Cashbacks tab content
                            CashbackStatsSection()
                        }
                    }
                    .padding(.bottom, 120) // Space for footer
                }

                // Sticky Footer
                OverdueFooter(
                    rentAmount: FigmaMockData.rentAmount,
                    dueInDays: FigmaMockData.dueInDays
                )
            }
        }
        .task {
            await viewModel.loadDashboard()
        }
    }
}

// MARK: - Warning Banner

struct OverdueWarningBanner: View {
    let state: OverdueStateType

    var body: some View {
        HStack(spacing: Spacing.xs) { // 8pt
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 12))
                .foregroundColor(state.warningColor)

            Text(state.bannerText)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(state.warningColor)
        }
        .padding(.horizontal, Spacing.md) // 16pt
        .padding(.vertical, Spacing.xs) // 8pt
        .background(state.warningColor.opacity(0.15))
        .clipShape(Capsule())
        .padding(.horizontal, Spacing.xl)
    }
}

// MARK: - Overdue Headline

struct OverdueHeadline: View {
    let state: OverdueStateType

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(state.headlineWhite)
                .font(Typography.h4)
                .foregroundColor(Color(hex: "BABABA"))

            Text(state.headlineColored)
                .font(Typography.h4)
                .foregroundColor(state.warningColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.xl) // 32pt
    }
}

// MARK: - Credit Card Carousel (Overdue variant)
/// Shows VISA card as primary payment method

struct CreditCardCarouselOverdue: View {
    @Binding var currentIndex: Int

    private let cards = [
        CreditCardData(
            brand: "VISA",
            lastFour: "2341",
            expiry: "06/26",
            cvvMasked: "***",
            isSelected: true
        ),
        CreditCardData(
            brand: "Mastercard",
            lastFour: "5678",
            expiry: "12/25",
            cvvMasked: "***",
            isSelected: false
        )
    ]

    var body: some View {
        VStack(spacing: Spacing.md) { // 16pt
            // Card carousel
            TabView(selection: $currentIndex) {
                ForEach(Array(cards.enumerated()), id: \.offset) { index, card in
                    CreditCardView(card: card)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 200)
            .padding(.horizontal, Spacing.xl)

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

// MARK: - Credit Card Data Model

struct CreditCardData: Identifiable {
    let id = UUID()
    let brand: String
    let lastFour: String
    let expiry: String
    let cvvMasked: String
    let isSelected: Bool
}

// MARK: - Credit Card View
/// Dark gradient card showing VISA/Mastercard details

struct CreditCardView: View {
    let card: CreditCardData

    var body: some View {
        HStack(spacing: 0) {
            // Main card
            VStack(alignment: .leading, spacing: 0) {
                // Header: Brand + SELECTED badge
                HStack {
                    Text(card.brand)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)

                    Spacer()

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

                // Card number (masked)
                Text("**** \(card.lastFour)")
                    .font(.system(size: 24, weight: .regular, design: .monospaced))
                    .foregroundColor(AppColors.neutral300)
                    .padding(.bottom, Spacing.md)

                // Expiry and CVV
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    HStack {
                        Text("EXPIRY")
                            .font(.system(size: 10, weight: .regular))
                            .foregroundColor(AppColors.neutral600)

                        Text(card.expiry)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(AppColors.brand500)
                    }

                    HStack {
                        Text("CVV")
                            .font(.system(size: 10, weight: .regular))
                            .foregroundColor(AppColors.neutral600)

                        Text(card.cvvMasked)
                            .font(.system(size: 14, weight: .regular))
                            .foregroundColor(AppColors.neutral500)
                    }
                }

                Spacer()

                // Footer
                HStack {
                    HStack(spacing: Spacing.xxs) {
                        Text("CREDIT CARD")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.neutral300)

                        Image(systemName: "pencil")
                            .font(.system(size: 10))
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
            .padding(Spacing.lg)
            .frame(width: 220)
            .background(
                ZStack {
                    // Gradient background for credit card
                    LinearGradient(
                        colors: [
                            Color(hex: "2A2A2A"),
                            Color(hex: "1A1A1A")
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )

                    // Pattern overlay
                    Image("card_pattern")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .opacity(0.08)
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))

            // Peek area
            Rectangle()
                .fill(Color.clear)
                .frame(width: 40)
        }
    }
}

// MARK: - Tab Selector (Overdue variant)

struct OverdueTabSelector: View {
    @Binding var selectedTab: HomeOverdueFigmaView.OverdueTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(HomeOverdueFigmaView.OverdueTab.allCases, id: \.self) { tab in
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
        .padding(.horizontal, Spacing.xl)
    }
}

// MARK: - Recent Payments List (Overdue variant)

struct RecentPaymentsListOverdue: View {
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
        VStack(spacing: Spacing.md) {
            ForEach(payments) { payment in
                RecentPaymentRow(payment: payment)
            }
        }
        .padding(.horizontal, Spacing.xl)
    }
}

// MARK: - Overdue Footer
/// Shows "Due in X Days" and "Review & pay" button

struct OverdueFooter: View {
    let rentAmount: String
    let dueInDays: Int

    var body: some View {
        HStack {
            // Left: Due info
            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("Due in \(dueInDays) Days")
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

            // Right: Review & pay button
            Button {
                // Navigate to payment
            } label: {
                Text("Review & pay")
                    .font(Typography.bodyMdMedium)
                    .foregroundColor(.white)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                    .background(AppColors.brand500)
                    .clipShape(Capsule())
            }
        }
        .padding(.horizontal, Spacing.xl)
        .padding(.top, Spacing.md)
        .padding(.bottom, Spacing.xxl) // Safe area
        .background(AppColors.black500)
    }
}

// MARK: - Previews

#Preview("Overdue by 10 Days - 41:3677") {
    HomeOverdueFigmaView(
        isVisualTestMode: true,
        overdueState: .lateByDays(days: 10)
    )
}

#Preview("Missed December Rent - 41:3885") {
    HomeOverdueFigmaView(
        isVisualTestMode: true,
        overdueState: .missedMonthRent(month: "December")
    )
}

#Preview("Multiple Payments Overdue - 41:4093") {
    HomeOverdueFigmaView(
        isVisualTestMode: true,
        overdueState: .multipleOverdue
    )
}
