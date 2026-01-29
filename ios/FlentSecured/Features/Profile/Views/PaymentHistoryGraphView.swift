/// PaymentHistoryGraphView.swift
/// Flent Secured v2 - Payment History Graph Component
///
/// Figma: 41:8760 - My Profile / Main Screen - Payment History Chart
///
/// Design Specifications:
/// - Type: Vertical bar chart
/// - Bars: 7 months of data
/// - Bar Width: 24px
/// - Bar Radius: 4px corners
/// - On-Time Color: #22C55E (successApproved)
/// - Late Color: #EF4444 (error)
/// - Month Labels: 10px, neutral500
/// - Chart Height: 80-100px scaled by percentage
/// - Legend: Circular dots (8x8) with counts

import SwiftUI

// MARK: - Payment Month Data

struct PaymentMonthData: Identifiable {
    let id = UUID()
    let monthLabel: String
    let percentage: Int // 0-100
    let isOnTime: Bool
}

// MARK: - Payment History Graph View

struct PaymentHistoryGraphView: View {
    let monthsData: [PaymentMonthData]
    let onTimeCount: Int
    let lateCount: Int

    private let maxBarHeight: CGFloat = 80
    private let barWidth: CGFloat = 24
    private let barRadius: CGFloat = 4
    private let barSpacing: CGFloat = 8

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header
            Text("Payment History")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white)

            // Bar Chart
            HStack(alignment: .bottom, spacing: barSpacing) {
                ForEach(monthsData) { month in
                    PaymentBar(
                        month: month,
                        maxHeight: maxBarHeight,
                        barWidth: barWidth,
                        barRadius: barRadius
                    )
                }
            }
            .frame(height: maxBarHeight + 24) // Extra space for labels
            .frame(maxWidth: .infinity)

            // Legend
            HStack(spacing: Spacing.lg) {
                PaymentLegendItem(
                    color: AppColors.successApproved,
                    label: "On Time",
                    count: onTimeCount
                )

                PaymentLegendItem(
                    color: AppColors.error,
                    label: "Late",
                    count: lateCount
                )
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

// MARK: - Payment Bar

private struct PaymentBar: View {
    let month: PaymentMonthData
    let maxHeight: CGFloat
    let barWidth: CGFloat
    let barRadius: CGFloat

    private var barHeight: CGFloat {
        // Scale percentage to height (minimum 8pt for visibility)
        max(8, CGFloat(month.percentage) / 100.0 * maxHeight)
    }

    private var barColor: Color {
        month.isOnTime ? AppColors.successApproved : AppColors.error
    }

    var body: some View {
        VStack(spacing: 4) {
            // Bar
            RoundedRectangle(cornerRadius: barRadius)
                .fill(barColor)
                .frame(width: barWidth, height: barHeight)

            // Month label
            Text(month.monthLabel)
                .font(.system(size: 10, weight: .regular))
                .foregroundColor(AppColors.neutral500)
        }
        .accessibilityLabel("\(month.monthLabel): \(month.isOnTime ? "On time" : "Late") payment, \(month.percentage)%")
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
