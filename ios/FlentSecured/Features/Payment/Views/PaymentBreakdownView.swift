/// PaymentBreakdownView.swift
/// Flent Secured v2 - Payment Breakdown Screen
///
/// Figma Nodes:
/// - 41:9746 - Payment Breakdown (Overdue / No Cashback)
/// - 41:9681 - Payment Breakdown (Setup Required / Locked Cashback)
/// - 41:9635, 41:9460 - Payment states
/// - 41:9563, 41:9681 - Confirmation and success
///
/// Features:
/// - Status banner showing rent status (overdue, due in X days)
/// - Cashback status message
/// - Detailed rent breakdown with line items using "# Label" format
/// - Locked cashback indicator with orange text
/// - Pay now CTA button with formatted total
/// - Footer message about cashback eligibility
/// - isVisualTestMode pattern for Figma-accurate previews

import SwiftUI

// MARK: - Payment Breakdown State

enum PaymentBreakdownState {
    case dueSoon(days: Int)           // Rent due in X days, cashback available
    case setupRequired(days: Int)      // Setup needed to unlock cashback
    case overdue(days: Int)            // Rent overdue, no cashback
    case latePayment                   // After 7th, no cashback earning

    var headerText: String {
        switch self {
        case .dueSoon(let days):
            return "Rent due in \(days) day\(days == 1 ? "" : "s")"
        case .setupRequired(let days):
            return "Rent due in \(days) day\(days == 1 ? "" : "s")"
        case .overdue(let days):
            return "Rent overdue by \(days) day\(days == 1 ? "" : "s")"
        case .latePayment:
            return "Rent overdue by x days"
        }
    }

    var cashbackMessage: String {
        switch self {
        case .dueSoon:
            return "Pay now to earn 1% cashback"
        case .setupRequired:
            return "Complete setup to unlock 1% cashback"
        case .overdue, .latePayment:
            return "No cashback on this payment"
        }
    }

    var footerMessage: String {
        switch self {
        case .dueSoon:
            return "Pay on time to earn 1% cashback"
        case .setupRequired(let days):
            return "Finish setup in \(formatCountdown(hours: days * 24, minutes: 12, seconds: 12)) to be eligible for\n\u{20B9}350 cashback on this payment"
        case .overdue, .latePayment:
            return "Pay before the due date next month to\nearn 1% cashback"
        }
    }

    var showSetupCountdown: Bool {
        if case .setupRequired = self { return true }
        return false
    }

    var isCashbackLocked: Bool {
        switch self {
        case .overdue, .latePayment, .setupRequired:
            return true
        case .dueSoon:
            return false
        }
    }

    private func formatCountdown(hours: Int, minutes: Int, seconds: Int) -> String {
        return String(format: "%d:%02d:%02d", hours, minutes, seconds)
    }
}

// MARK: - Payment Breakdown Data Model

struct PaymentBreakdownData {
    let baseRent: Int
    let maintenance: Int
    var totalRent: Int { baseRent + maintenance }
    let cashback: Int
    var payableRent: Int { totalRent } // Cashback not applied when locked
    let isOverdue: Bool
    let daysOverdue: Int
    let daysDue: Int
    let cashbackEligible: Bool
    let setupComplete: Bool

    /// Formatted base rent with rupee symbol
    var formattedBaseRent: String {
        formatCurrency(baseRent)
    }

    /// Formatted maintenance with rupee symbol
    var formattedMaintenance: String {
        formatCurrency(maintenance)
    }

    /// Formatted total rent with rupee symbol
    var formattedTotalRent: String {
        formatCurrency(totalRent)
    }

    /// Formatted cashback with rupee symbol and negative sign
    var formattedCashback: String {
        "- \u{20B9} \(formatNumber(cashback))"
    }

    /// Formatted payable rent with rupee symbol
    var formattedPayableRent: String {
        formatCurrency(payableRent)
    }

    /// Formatted cashback available to unlock
    var formattedCashbackAvailable: String {
        "\u{20B9}\(formatNumber(cashback)) available to unlock"
    }

    private func formatCurrency(_ amount: Int) -> String {
        "\u{20B9} \(formatNumber(amount))"
    }

    private func formatNumber(_ number: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
    }

    /// Determine the breakdown state
    var state: PaymentBreakdownState {
        if isOverdue {
            return .overdue(days: daysOverdue)
        } else if !setupComplete {
            return .setupRequired(days: daysDue)
        } else if !cashbackEligible {
            return .latePayment
        } else {
            return .dueSoon(days: daysDue)
        }
    }

    // MARK: - Preview Helpers

    static var previewOverdue: PaymentBreakdownData {
        PaymentBreakdownData(
            baseRent: 30000,
            maintenance: 2500,
            cashback: 325,
            isOverdue: true,
            daysOverdue: 3,
            daysDue: 0,
            cashbackEligible: false,
            setupComplete: true
        )
    }

    static var previewSetupRequired: PaymentBreakdownData {
        PaymentBreakdownData(
            baseRent: 30000,
            maintenance: 2500,
            cashback: 350,
            isOverdue: false,
            daysOverdue: 0,
            daysDue: 28,
            cashbackEligible: true,
            setupComplete: false
        )
    }

    static var previewEligible: PaymentBreakdownData {
        PaymentBreakdownData(
            baseRent: 30000,
            maintenance: 2500,
            cashback: 325,
            isOverdue: false,
            daysOverdue: 0,
            daysDue: 5,
            cashbackEligible: true,
            setupComplete: true
        )
    }
}

// MARK: - Payment Breakdown View

/// Main payment breakdown screen showing rent details
/// Figma: node-id=41:9746, 41:9681
struct PaymentBreakdownView: View {
    @Environment(AppCoordinator.self) private var coordinator

    /// Visual test mode for Figma-accurate previews
    /// When true, uses FigmaMockData values instead of ViewModel data
    var isVisualTestMode: Bool = false

    let data: PaymentBreakdownData
    let onPayNow: () -> Void

    /// Figma mock data for visual testing
    /// Source: Figma node 41:9746
    private struct FigmaMockData {
        static let baseRent = 30000          // Figma: Rs 30,000
        static let maintenance = 2500        // Figma: Rs 2,500
        static let totalRent = 32500         // Figma: Rs 32,500
        static let cashback = 325            // Figma: Rs 325
        static let payableRent = 32500       // Figma: Rs 32,500
        static let daysOverdue = 3           // Figma: "Rent overdue by 3 days"
        static let daysDue = 10              // Figma: "Rent due in 10 days"
    }

    init(
        data: PaymentBreakdownData = .previewOverdue,
        isVisualTestMode: Bool = false,
        onPayNow: @escaping () -> Void = {}
    ) {
        self.data = data
        self.isVisualTestMode = isVisualTestMode
        self.onPayNow = onPayNow
    }

    // MARK: - Display Values (Visual Test Mode aware)

    private var displayBaseRent: Int {
        isVisualTestMode ? FigmaMockData.baseRent : data.baseRent
    }

    private var displayMaintenance: Int {
        isVisualTestMode ? FigmaMockData.maintenance : data.maintenance
    }

    private var displayTotalRent: Int {
        isVisualTestMode ? FigmaMockData.totalRent : data.totalRent
    }

    private var displayCashback: Int {
        isVisualTestMode ? FigmaMockData.cashback : data.cashback
    }

    private var displayPayableRent: Int {
        isVisualTestMode ? FigmaMockData.payableRent : data.payableRent
    }

    var body: some View {
        ZStack {
            // Background
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Navigation back button
                navigationHeader

                Spacer()
                    .frame(height: Spacing.xl)

                // Main content
                VStack(spacing: Spacing.lg) {
                    // Status Banner Card
                    statusBannerCard

                    // Breakdown Card
                    breakdownCard
                }
                .padding(.horizontal, Spacing.screenHorizontalCompact)

                Spacer()

                // Bottom CTA
                bottomCTA
            }
        }
        .navigationBarHidden(true)
        .navigationBarBackButtonHidden(true)
    }

    // MARK: - Navigation Header

    private var navigationHeader: some View {
        HStack {
            Button {
                HapticManager.shared.lightImpact()
                coordinator.pop()
            } label: {
                Image(systemName: "arrow.left")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 44, height: 44)
            }

            Spacer()
        }
        .padding(.horizontal, Spacing.xs)
    }

    // MARK: - Status Banner Card

    /// Figma: Top banner showing due/overdue status and cashback message
    private var statusBannerCard: some View {
        VStack(spacing: Spacing.xs) {
            // Status text (e.g., "Rent overdue by x days")
            Text(data.state.headerText)
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(AppColors.neutral500)

            // Cashback message (e.g., "No cashback on this payment")
            Text(data.state.cashbackMessage)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white)

            // Action pill (setup or cashback info)
            if data.state.showSetupCountdown {
                // Setup required - show unlock pill
                Text(data.formattedCashbackAvailable)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.brand500)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.xs)
                    .background(AppColors.backgroundSecondary)
                    .cornerRadius(Radius.pill)
            } else if !data.state.isCashbackLocked && data.cashbackEligible {
                // Eligible - show earn cashback pill
                Text("Earn \u{20B9}\(data.cashback) cashback")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.brand500)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.xs)
                    .background(AppColors.backgroundSecondary)
                    .cornerRadius(Radius.pill)
            } else {
                // Not eligible - show hint pill
                Text("Pay on time next month to earn 1% cashback")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.brand500)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.xs)
                    .background(AppColors.backgroundSecondary)
                    .cornerRadius(Radius.pill)
            }
        }
        .padding(.vertical, Spacing.lg)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Breakdown Card

    /// Figma: Light card (#EEEEEE) with rent breakdown rows
    /// Format: "# Label" prefix with orange hash, value right-aligned
    private var breakdownCard: some View {
        VStack(spacing: Spacing.md) {
            // Base rent row - Figma: "# Base rent" / "Rs 30,000"
            PaymentBreakdownRowView(
                label: "Base rent",
                value: formatCurrency(displayBaseRent)
            )

            // Maintenance row - Figma: "# Maintenance" / "Rs 2,500"
            PaymentBreakdownRowView(
                label: "Maintenance",
                value: formatCurrency(displayMaintenance)
            )

            // Dashed divider
            DashedDivider(color: AppColors.neutral300)
                .padding(.vertical, Spacing.xs)

            // Total rent row - Figma: "# Total Rent" / "Rs 32,500" (bold)
            PaymentBreakdownRowView(
                label: "Total Rent",
                value: formatCurrency(displayTotalRent),
                isHighlighted: true
            )

            // Cashback row - Figma: "# Cashback" with lock icon / "- Rs 325" (orange)
            PaymentBreakdownRowView(
                label: "Cashback",
                value: "- \(formatCurrency(displayCashback))",
                valueColor: AppColors.brand500, // Orange for cashback
                showLockIcon: data.state.isCashbackLocked
            )

            // Dashed divider
            DashedDivider(color: AppColors.neutral300)
                .padding(.vertical, Spacing.xs)

            // Payable rent row - Figma: "# Payable Rent" / "Rs 32,500" (bold)
            PaymentBreakdownRowView(
                label: "Payable Rent",
                value: formatCurrency(displayPayableRent),
                isHighlighted: true
            )
        }
        .padding(Spacing.lg)
        .background(AppColors.neutral100)
        .cornerRadius(Radius.card)
    }

    /// Format currency with rupee symbol and Indian number formatting
    private func formatCurrency(_ amount: Int) -> String {
        "\u{20B9} \(formatNumber(amount))"
    }

    // MARK: - Bottom CTA

    private var bottomCTA: some View {
        VStack(spacing: Spacing.sm) {
            // Pay button - Figma: "Pay Rs32,500 now" with secondary style (dark bg, orange border)
            PrimaryButton(
                title: "Pay \u{20B9}\(formatNumber(displayPayableRent)) now",
                style: .secondary // Dark gradient with orange border per Figma 41:9746
            ) {
                HapticManager.shared.mediumImpact()
                onPayNow()
            }

            // Footer message
            Text(data.state.footerMessage)
                .font(Typography.bodySm) // 12px Regular
                .foregroundColor(AppColors.neutral500)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
        .padding(.vertical, Spacing.lg)
    }

    // MARK: - Helpers

    private func formatNumber(_ number: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
    }
}

// MARK: - Preview

#Preview("Payment Breakdown - Overdue") {
    PaymentBreakdownView(
        data: .previewOverdue,
        onPayNow: { print("Pay now tapped") }
    )
    .environment(AppCoordinator())
}

#Preview("Payment Breakdown - Setup Required") {
    PaymentBreakdownView(
        data: .previewSetupRequired,
        onPayNow: { print("Pay now tapped") }
    )
    .environment(AppCoordinator())
}

#Preview("Payment Breakdown - Eligible") {
    PaymentBreakdownView(
        data: .previewEligible,
        onPayNow: { print("Pay now tapped") }
    )
    .environment(AppCoordinator())
}

#Preview("Payment Breakdown - Visual Test Mode") {
    PaymentBreakdownView(
        data: .previewOverdue,
        isVisualTestMode: true,
        onPayNow: { print("Pay now tapped") }
    )
    .environment(AppCoordinator())
}

// MARK: - Payment Breakdown Row View

/// Row component for payment breakdown
/// Figma: "# Label" format with orange hash prefix
///
/// Layout:
/// - Left: "#" (brand500/orange) + label text (neutral800/dark gray)
/// - Right: value text (neutral900/black)
/// - Highlighted: larger/bolder text for totals
/// - Lock icon: shown next to label when cashback is locked
struct PaymentBreakdownRowView: View {
    let label: String
    let value: String
    var labelColor: Color = AppColors.neutral800 // Dark gray for label
    var valueColor: Color = AppColors.neutral900 // Near-black for value
    var isHighlighted: Bool = false
    var showLockIcon: Bool = false

    var body: some View {
        HStack {
            // Left: "# Label" with optional lock icon
            HStack(spacing: Spacing.xs) {
                // Hash prefix - Figma: brand500 (orange)
                Text("#")
                    .font(isHighlighted ? Typography.bodyMdMedium : Typography.bodyMd2)
                    .foregroundColor(AppColors.brand500)

                // Label text
                Text(label)
                    .font(isHighlighted ? Typography.bodyMdMedium : Typography.bodyMd2)
                    .foregroundColor(labelColor)

                // Lock icon if cashback is locked
                if showLockIcon {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 12))
                        .foregroundColor(AppColors.neutral500)
                }
            }

            Spacer()

            // Right: Value
            Text(value)
                .font(isHighlighted ? Typography.bodyMd : Typography.bodyMd2Medium)
                .foregroundColor(valueColor)
        }
    }
}
