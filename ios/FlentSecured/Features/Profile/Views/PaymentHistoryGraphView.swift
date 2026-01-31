/// PaymentHistoryGraphView.swift
/// Flent Secured v2 - Payment History Graph Component
///
/// Figma: 41:8760 - My Profile / Main Screen - YOUR PAYMENT HISTORY
///
/// Design Specifications from Figma:
/// - Section header: "YOUR PAYMENT HISTORY" (10px semibold, neutral500)
/// - Bar chart with month labels (JAN, FEB, MAR, APR, MAY)
/// - Current month highlighted (MAR with underline)
/// - Bar shapes: Rounded top corners only
/// - On-Time bars: White outline with "on time" label
/// - Late bars: White outline with "Paid late" label
/// - Not Paid bars: White outline with "Not Paid" label
/// - Legend shows bar states with tooltips

import SwiftUI

// MARK: - Payment Month Data

struct PaymentMonthData: Identifiable {
    let id = UUID()
    let monthLabel: String
    let percentage: Int // 0-100
    let isOnTime: Bool
    var isPaid: Bool = true
}

// MARK: - Payment History Graph View

struct PaymentHistoryGraphView: View {
    let monthsData: [PaymentMonthData]
    let onTimeCount: Int
    let lateCount: Int

    private let maxBarHeight: CGFloat = 80
    private let barWidth: CGFloat = 28
    private let barRadius: CGFloat = 4

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header - Figma: "YOUR PAYMENT HISTORY" (same style as section headers)
            Text("YOUR PAYMENT HISTORY")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(0.5)

            // Bar Chart - Figma: Bars with tooltip labels
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(monthsData.enumerated()), id: \.element.id) { index, month in
                    PaymentBar(
                        month: month,
                        maxHeight: maxBarHeight,
                        barWidth: barWidth,
                        barRadius: barRadius,
                        isCurrentMonth: index == 2 // MAR is highlighted in Figma
                    )
                }
            }
            .frame(height: maxBarHeight + 28) // Extra space for labels
            .frame(maxWidth: .infinity)
        }
        .padding(Spacing.md)
        .background(AppColors.black600)
        .cornerRadius(Radius.md)
    }
}

// MARK: - Payment Bar
// Figma: Bar with tooltip label, rounded top corners, outline style

private struct PaymentBar: View {
    let month: PaymentMonthData
    let maxHeight: CGFloat
    let barWidth: CGFloat
    let barRadius: CGFloat
    var isCurrentMonth: Bool = false

    private var barHeight: CGFloat {
        // Scale percentage to height (minimum 16pt for visibility)
        guard month.isPaid else { return 16 }
        return max(16, CGFloat(month.percentage) / 100.0 * maxHeight)
    }

    private var tooltipText: String {
        if !month.isPaid {
            return "Not Paid"
        }
        return month.isOnTime ? "on time" : "Paid late"
    }

    var body: some View {
        VStack(spacing: 6) {
            // Tooltip label - Figma: Small label above bar
            Text(tooltipText)
                .font(.system(size: 8, weight: .medium))
                .foregroundColor(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(AppColors.black500)
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(Color.white.opacity(0.3), lineWidth: 0.5)
                        )
                )

            // Bar - Figma: Outline style with rounded top corners
            UnevenRoundedRectangle(
                topLeadingRadius: barRadius,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: 0,
                topTrailingRadius: barRadius
            )
            .stroke(Color.white.opacity(0.6), lineWidth: 1)
            .frame(width: barWidth, height: barHeight)

            // Month label - Figma: Uppercase, current month has underline
            VStack(spacing: 2) {
                Text(month.monthLabel.uppercased())
                    .font(.system(size: 10, weight: isCurrentMonth ? .semibold : .regular))
                    .foregroundColor(isCurrentMonth ? AppColors.brand500 : AppColors.neutral500)

                // Current month indicator
                if isCurrentMonth {
                    Rectangle()
                        .fill(AppColors.brand500)
                        .frame(width: 20, height: 2)
                        .cornerRadius(1)
                }
            }
        }
        .accessibilityLabel("\(month.monthLabel): \(tooltipText), \(month.percentage)%")
    }
}

// MARK: - Payment Legend Item

private struct PaymentLegendItem: View {
    let color: Color
    let label: String
    let count: Int

    var body: some View {
        HStack(spacing: Spacing.xs) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)

            Text("\(label) (\(count))")
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(AppColors.neutral500)
        }
    }
}

// MARK: - Full-Featured Payment History Card

struct PaymentHistoryCard: View {
    let onTimeCount: Int
    let lateCount: Int
    let monthsData: [PaymentMonthData]

    var body: some View {
        PaymentHistoryGraphView(
            monthsData: monthsData,
            onTimeCount: onTimeCount,
            lateCount: lateCount
        )
    }
}

// MARK: - Payment Month Data (Extended)

extension PaymentMonthData {
    /// Create from payment data
    static func fromPayments(_ payments: [PaymentData], months: Int = 7) -> [PaymentMonthData] {
        // Generate last N months
        let calendar = Calendar.current
        let today = Date()

        var result: [PaymentMonthData] = []
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "MMM"

        for i in (0..<months).reversed() {
            guard let date = calendar.date(byAdding: .month, value: -i, to: today) else { continue }

            let monthFormatter = DateFormatter()
            monthFormatter.dateFormat = "yyyy-MM"
            let monthKey = monthFormatter.string(from: date)

            // Find payment for this month
            let payment = payments.first { $0.paymentMonth == monthKey }

            // Determine if on time (paid before 7th)
            var isOnTime = true
            var percentage = 0

            if let payment = payment {
                // Parse paid_at date to check if before 7th
                let isoFormatter = ISO8601DateFormatter()
                isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

                if let paidAt = isoFormatter.date(from: payment.createdAt) {
                    let dayOfPayment = calendar.component(.day, from: paidAt)
                    isOnTime = dayOfPayment <= 7
                }

                // Percentage based on payment status
                switch payment.paymentStatus {
                case .success, .settled:
                    percentage = 100
                case .initiated, .processing:
                    percentage = 80
                case .failed, .refunded:
                    percentage = 30
                }
            }

            result.append(PaymentMonthData(
                monthLabel: dateFormatter.string(from: date),
                percentage: percentage,
                isOnTime: isOnTime
            ))
        }

        return result
    }
}

// MARK: - Preview

#Preview("Payment History Graph") {
    VStack(spacing: Spacing.lg) {
        PaymentHistoryGraphView(
            monthsData: [
                PaymentMonthData(monthLabel: "Jul", percentage: 100, isOnTime: true),
                PaymentMonthData(monthLabel: "Aug", percentage: 100, isOnTime: true),
                PaymentMonthData(monthLabel: "Sep", percentage: 80, isOnTime: true),
                PaymentMonthData(monthLabel: "Oct", percentage: 100, isOnTime: true),
                PaymentMonthData(monthLabel: "Nov", percentage: 60, isOnTime: false),
                PaymentMonthData(monthLabel: "Dec", percentage: 100, isOnTime: true),
                PaymentMonthData(monthLabel: "Jan", percentage: 100, isOnTime: true)
            ],
            onTimeCount: 6,
            lateCount: 1
        )

        // Empty state
        PaymentHistoryGraphView(
            monthsData: [],
            onTimeCount: 0,
            lateCount: 0
        )
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}
