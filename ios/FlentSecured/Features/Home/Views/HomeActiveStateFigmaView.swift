/// HomeActiveStateFigmaView.swift
/// Pixel-perfect implementation of Figma active home states:
/// - 41:3267 "Home --Active Qualified" (UPI/NetBanking only)
/// - 41:3472 "Home --Active Complete" (All payment methods)
/// - 41:5792 "Home --Empty with UPI Payments"
///
/// Common layout:
/// - Header with greeting and avatar
/// - "Your rent is due in X days" headline
/// - Payment card carousel with SELECTED badge
/// - Tab selector: "Recent Payments" | "Cashbacks"
/// - Transaction list or Cashback stats
/// - Sticky footer with "Review & pay"
///
/// Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
/// Design Width: 393pt (iPhone 14 Pro)

import SwiftUI

// MARK: - Payment Method Type for Active States

enum ActivePaymentMethod {
    case upi(bankName: String, accountMasked: String, upiId: String)
    case card(brand: String, lastFour: String, expiry: String)
    case netBanking(bankName: String, accountMasked: String)

    var displayLabel: String {
        switch self {
        case .upi: return "UPI"
        case .card: return "CREDIT CARD"
        case .netBanking: return "NET BANKING"
        }
    }
}

// MARK: - Main Active State View

struct HomeActiveStateFigmaView: View {
    /// Visual testing mode with mock data
    var isVisualTestMode: Bool = true

    /// Primary payment method to show (determines card style)
    var primaryPaymentMethod: ActivePaymentMethod = .upi(
        bankName: "ICICI a/c",
        accountMasked: "xxx23",
        upiId: "rishabh@***"
    )

    /// Whether to show all payment methods (Complete) or just UPI/NetBanking (Qualified)
    var isCompleteUser: Bool = false

    // MARK: - State
    @State private var selectedTab: ActiveTab = .recentPayments
    @State private var currentCardIndex: Int = 0
    @State private var viewModel = HomeViewModel()

    enum ActiveTab: String, CaseIterable {
        case recentPayments = "Recent Payments"
        case cashbacks = "Cashbacks"
    }

    // MARK: - Mock Data
    private struct FigmaMockData {
        static let userName = "Rishabh"
        static let daysUntilDue = 10
        static let rentAmount = "32,500"
    }

    private var userName: String {
        guard !isVisualTestMode else { return FigmaMockData.userName }
        let name = viewModel.firstName
        return (name.isEmpty || name == "there") ? FigmaMockData.userName : name
    }

    private var daysUntilDue: Int {
        guard !isVisualTestMode else { return FigmaMockData.daysUntilDue }
        return viewModel.daysUntilDue == 0 ? FigmaMockData.daysUntilDue : viewModel.daysUntilDue
    }

    var body: some View {
        ZStack {
            // Background
            AppColors.black700
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Scrollable content
                ScrollView(showsIndicators: false) {
                    VStack(spacing: Spacing.lg) { // 24pt
                        // Header
                        HomeHeaderFigma(userName: userName)

                        // Headline
                        ActiveStateHeadline(daysUntilDue: daysUntilDue)

                        // "Paying with:" label
                        HStack {
                            Text("Paying with:")
                                .font(Typography.bodyMd2)
                                .foregroundColor(AppColors.neutral600)
                            Spacer()
                        }
                        .padding(.horizontal, Spacing.xl)

                        // Payment Card Carousel
                        ActivePaymentCardCarousel(
                            primaryMethod: primaryPaymentMethod,
                            isCompleteUser: isCompleteUser,
                            currentIndex: $currentCardIndex
                        )

                        // Tab Selector
                        ActiveTabSelector(selectedTab: $selectedTab)

                        // Tab Content
                        if selectedTab == .recentPayments {
                            ActiveRecentPaymentsList()
                        } else {
                            CashbackStatsSection()
                        }
                    }
                    .padding(.bottom, 120) // Footer space
                }

                // Sticky Footer
                ActiveFooter(
                    rentAmount: FigmaMockData.rentAmount,
                    daysUntilDue: daysUntilDue
                )
            }
        }
        .task {
            await viewModel.loadDashboard()
        }
    }
}

// MARK: - Active State Headline

struct ActiveStateHeadline: View {
    let daysUntilDue: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Your rent is due")
                .font(Typography.h4)
                .foregroundColor(Color(hex: "BABABA"))

            Text("in \(daysUntilDue) days")
                .font(Typography.h4)
                .foregroundColor(AppColors.brand500)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.xl)
    }
}

// MARK: - Active Payment Card Carousel

struct ActivePaymentCardCarousel: View {
    let primaryMethod: ActivePaymentMethod
    let isCompleteUser: Bool
    @Binding var currentIndex: Int

    var body: some View {
        VStack(spacing: Spacing.md) {
            // Card carousel
            TabView(selection: $currentIndex) {
                // Primary card
                ActivePaymentCardView(method: primaryMethod, isSelected: true)
                    .tag(0)

                // Secondary cards based on user type
                if isCompleteUser {
                    // Show card option for complete users
                    ActivePaymentCardView(
                        method: .card(brand: "VISA", lastFour: "2341", expiry: "06/26"),
                        isSelected: false
                    )
                    .tag(1)
                }

                // Net banking as additional option
                ActivePaymentCardView(
                    method: .netBanking(bankName: "HDFC", accountMasked: "xxx89"),
                    isSelected: false
                )
                .tag(isCompleteUser ? 2 : 1)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 200)
            .padding(.horizontal, Spacing.xl)

            // Dots indicator
            let totalCards = isCompleteUser ? 3 : 2
            HStack(spacing: Spacing.xs) {
                ForEach(0..<totalCards, id: \.self) { index in
                    Circle()
                        .fill(index == currentIndex ? AppColors.brand500 : AppColors.black400)
                        .frame(width: 6, height: 6)
                }
            }
        }
    }
}

// MARK: - Active Payment Card View

struct ActivePaymentCardView: View {
    let method: ActivePaymentMethod
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 0) {
            // Main card content
            VStack(alignment: .leading, spacing: 0) {
                // Header with logo/brand and SELECTED badge
                HStack {
                    cardBrandView
                    Spacer()
                    if isSelected {
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

                // Card details based on type
                cardDetailsView

                Spacer()

                // Footer
                HStack {
                    HStack(spacing: Spacing.xxs) {
                        Text(method.displayLabel)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.neutral300)

                        Image(systemName: "pencil")
                            .font(.system(size: 10))
                            .foregroundColor(AppColors.neutral500)
                    }

                    Spacer()

                    Image("flent-logo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 20, height: 24)
                }
            }
            .padding(Spacing.lg)
            .frame(width: 220)
            .background(cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))

            // Peek area for next card
            Rectangle()
                .fill(Color.clear)
                .frame(width: 40)
        }
    }

    @ViewBuilder
    private var cardBrandView: some View {
        switch method {
        case .upi:
            Image("upi_logo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: 20)
        case .card(let brand, _, _):
            Text(brand)
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(.white)
        case .netBanking(let bankName, _):
            Text(bankName)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white)
        }
    }

    @ViewBuilder
    private var cardDetailsView: some View {
        switch method {
        case .upi(let bankName, let accountMasked, let upiId):
            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("\(bankName) - \(accountMasked)")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.neutral300)

                Text(upiId)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.neutral500)
            }

        case .card(_, let lastFour, let expiry):
            VStack(alignment: .leading, spacing: Spacing.md) {
                Text("**** \(lastFour)")
                    .font(.system(size: 24, weight: .regular, design: .monospaced))
                    .foregroundColor(AppColors.neutral300)

                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    HStack {
                        Text("EXPIRY")
                            .font(.system(size: 10, weight: .regular))
                            .foregroundColor(AppColors.neutral600)
                        Text(expiry)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(AppColors.brand500)
                    }
                    HStack {
                        Text("CVV")
                            .font(.system(size: 10, weight: .regular))
                            .foregroundColor(AppColors.neutral600)
                        Text("***")
                            .font(.system(size: 14, weight: .regular))
                            .foregroundColor(AppColors.neutral500)
                    }
                }
            }

        case .netBanking(let bankName, let accountMasked):
            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("\(bankName) Bank")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.neutral300)

                Text("A/C: \(accountMasked)")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.neutral500)
            }
        }
    }

    private var cardBackground: some View {
        ZStack {
            // Base gradient
            switch method {
            case .card:
                LinearGradient(
                    colors: [Color(hex: "2A2A2A"), Color(hex: "1A1A1A")],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            default:
                AppColors.black600
            }

            // Pattern overlay
            Image("card_pattern")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .opacity(0.08)
        }
    }
}

// MARK: - Active Tab Selector

struct ActiveTabSelector: View {
    @Binding var selectedTab: HomeActiveStateFigmaView.ActiveTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(HomeActiveStateFigmaView.ActiveTab.allCases, id: \.self) { tab in
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

// MARK: - Active Recent Payments List

struct ActiveRecentPaymentsList: View {
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

// MARK: - Active Footer

struct ActiveFooter: View {
    let rentAmount: String
    let daysUntilDue: Int

    var body: some View {
        HStack {
            // Left: Due info
            VStack(alignment: .leading, spacing: Spacing.xxs) {
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
        .padding(.bottom, Spacing.xxl)
        .background(AppColors.black500)
    }
}

// MARK: - Previews

#Preview("Active Qualified (UPI) - 41:3267") {
    HomeActiveStateFigmaView(
        isVisualTestMode: true,
        primaryPaymentMethod: .upi(
            bankName: "ICICI a/c",
            accountMasked: "xxx23",
            upiId: "rishabh@***"
        ),
        isCompleteUser: false
    )
}

#Preview("Active Complete (Card) - 41:3472") {
    HomeActiveStateFigmaView(
        isVisualTestMode: true,
        primaryPaymentMethod: .card(
            brand: "VISA",
            lastFour: "2341",
            expiry: "06/26"
        ),
        isCompleteUser: true
    )
}

#Preview("Empty with UPI Payments - 41:5792") {
    HomeActiveStateFigmaView(
        isVisualTestMode: true,
        primaryPaymentMethod: .upi(
            bankName: "ICICI a/c",
            accountMasked: "xxx23",
            upiId: "rishabh@***"
        ),
        isCompleteUser: false
    )
}
