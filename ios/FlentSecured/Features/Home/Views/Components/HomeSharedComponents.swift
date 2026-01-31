/// HomeSharedComponents.swift
/// Shared pixel-perfect components used across all Home screen states
///
/// Components extracted from Figma design for reuse:
/// - HomeHeaderFigma: Logo + greeting + avatar header
/// - GradientBorderButton: Orange gradient button with shadow
/// - RecentPaymentRow: Transaction row with status indicator
/// - CashbackStatsSection: Cashback metrics display
///
/// Figma File: HZaVuwWn6B6jOjrmxZ7Kzv

import SwiftUI

// MARK: - Home Header (Figma: 41:4758)
/// "Hi, Rishabh" greeting with Flent logo and user avatar
/// Used in all Home screen states

struct HomeHeaderFigmaShared: View {
    let userName: String

    var body: some View {
        HStack {
            // Logo + Greeting
            HStack(spacing: Spacing.md) { // 16pt gap
                // Flent Logo - 26.7x32
                Image("flent-logo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: DesignScale.scaled(26.7), height: DesignScale.scaled(32))

                // Greeting text - 14px Regular, #CBCBCB
                Text("Hi, \(userName)")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.neutral300)
            }

            Spacer()

            // Avatar - 32x32 circle with gradient
            Image("avatar_placeholder")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: DesignScale.scaled(32), height: DesignScale.scaled(32))
                .clipShape(Circle())
        }
        .padding(.horizontal, Spacing.xl) // 32pt
        .padding(.vertical, Spacing.lg) // 24pt
    }
}

// MARK: - Gradient Border Button (Figma button style)
/// Button with gradient background, orange border, and shadow

struct GradientBorderButtonShared: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Spacing.xs) {
                // Top bar indicator (2px, #4D4D4D)
                RoundedRectangle(cornerRadius: Radius.pill)
                    .fill(AppColors.black400)
                    .frame(width: 24, height: 2)

                // Button content
                Text(title)
                    .font(Typography.bodyMdMedium)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(Spacing.md)
                    .background(
                        LinearGradient(
                            colors: [AppColors.black500, Color(hex: "0D0D0D")],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.sm)
                            .stroke(AppColors.brand500, lineWidth: 0.1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
                    .shadow(color: Color(hex: "995C41").opacity(0.24), radius: 6, x: 0, y: 6)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Recent Payment Data Model

struct RecentPaymentDataShared: Identifiable {
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

// MARK: - Recent Payment Row

struct RecentPaymentRowShared: View {
    let payment: RecentPaymentDataShared

    var body: some View {
        HStack(spacing: Spacing.sm) { // 12pt
            // Avatar/icon with gradient
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

// MARK: - Cashback Stats Section (Shared)
/// Shows CASHBACK ACCRUED, All-time Total, and Cashback Rate

struct CashbackStatsSectionShared: View {
    var cashbackAccrued: String = "325"
    var cashbackAccruedDecimal: String = "50"
    var allTimeTotal: String = "3,256"
    var allTimeTotalDecimal: String = "00"
    var cashbackRate: String = "0.8%"

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

                Text(cashbackAccrued)
                    .font(.system(size: 48, weight: .light))
                    .foregroundColor(AppColors.success)

                Text(".\(cashbackAccruedDecimal)")
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

                        Text(allTimeTotal)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(AppColors.success)

                        Text(".\(allTimeTotalDecimal)")
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
                        Text(cashbackRate)
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

// MARK: - Setup Item Row (Shared)
/// Checklist item with indicator dot and connecting line

struct SetupItemRowShared: View {
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

// MARK: - Sticky Footer (Shared)
/// Common footer with due info and action button

struct HomeStickyFooterShared: View {
    let rentAmount: String
    let dueLabel: String
    let buttonTitle: String
    var buttonColor: Color = AppColors.brand500
    let action: () -> Void

    var body: some View {
        HStack {
            // Left: Due info
            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(dueLabel)
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

            // Right: Action button
            Button(action: action) {
                Text(buttonTitle)
                    .font(Typography.bodyMdMedium)
                    .foregroundColor(.white)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                    .background(buttonColor)
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

#Preview("Home Header") {
    VStack {
        HomeHeaderFigmaShared(userName: "Rishabh")
    }
    .background(AppColors.black700)
}

#Preview("Gradient Button") {
    VStack {
        GradientBorderButtonShared(title: "Finish Setup") {}
            .padding()
    }
    .background(AppColors.black700)
}

#Preview("Payment Row") {
    VStack {
        RecentPaymentRowShared(
            payment: RecentPaymentDataShared(
                month: "September rent",
                status: .paid,
                date: "15 Sep, 9:40am",
                amount: "32,500"
            )
        )
        .padding()
    }
    .background(AppColors.black700)
}

#Preview("Cashback Stats") {
    VStack {
        CashbackStatsSectionShared()
    }
    .background(AppColors.black700)
}

#Preview("Sticky Footer") {
    VStack {
        Spacer()
        HomeStickyFooterShared(
            rentAmount: "32,500",
            dueLabel: "Due in 28 Days",
            buttonTitle: "Review"
        ) {}
    }
    .background(AppColors.black700)
}
