/// PaymentSummaryView.swift
/// Flent Secured v2 - Payment Summary Screen
///
/// Figma: Payment summary bottom sheet shown before final confirmation
/// Shows payment breakdown with rent, fees, cashback, and total
/// Allows user to review and confirm payment

import SwiftUI

struct PaymentSummaryView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(\.dismiss) private var dismiss

    let paymentId: String
    let rentAmountPaise: Int
    let pgFeePaise: Int
    let cashbackAppliedPaise: Int
    let paymentMethod: PaymentMethod
    let onConfirm: () -> Void

    init(
        paymentId: String = "",
        rentAmountPaise: Int = 2500000,
        pgFeePaise: Int = 0,
        cashbackAppliedPaise: Int = 0,
        paymentMethod: PaymentMethod = .upiIntent,
        onConfirm: @escaping () -> Void = {}
    ) {
        self.paymentId = paymentId
        self.rentAmountPaise = rentAmountPaise
        self.pgFeePaise = pgFeePaise
        self.cashbackAppliedPaise = cashbackAppliedPaise
        self.paymentMethod = paymentMethod
        self.onConfirm = onConfirm
    }

    // MARK: - Computed Properties

    private var totalPaise: Int {
        rentAmountPaise + pgFeePaise - cashbackAppliedPaise
    }

    private var formattedRent: String {
        formatCurrency(Double(rentAmountPaise) / 100.0)
    }

    private var formattedFee: String {
        formatCurrency(Double(pgFeePaise) / 100.0)
    }

    private var formattedCashback: String {
        formatCurrency(Double(cashbackAppliedPaise) / 100.0)
    }

    private var formattedTotal: String {
        formatCurrency(Double(totalPaise) / 100.0)
    }

    private var currentMonth: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: Date())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Header with drag handle
            VStack(spacing: Spacing.sm) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(AppColors.black400)
                    .frame(width: 40, height: 4)

                HStack {
                    Text("Payment Summary")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)

                    Spacer()

                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(AppColors.neutral500)
                            .frame(width: 32, height: 32)
                            .background(AppColors.black500)
                            .cornerRadius(Radius.sm)
                    }
                }
            }

            // Month Label
            HStack(spacing: Spacing.xs) {
                Image(systemName: "calendar")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.neutral500)

                Text("Rent for \(currentMonth)")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.neutral500)
            }

            // Amount Breakdown Card
            VStack(spacing: Spacing.md) {
                // Rent Amount
                SummaryRow(label: "Monthly Rent", value: formattedRent)

                // PG Fee (if any)
                if pgFeePaise > 0 {
                    SummaryRow(
                        label: "Payment Gateway Fee",
                        value: formattedFee,
                        valueColor: AppColors.neutral500
                    )
                }

                // Cashback (if any)
                if cashbackAppliedPaise > 0 {
                    SummaryRow(
                        label: "Cashback Applied",
                        value: "-\(formattedCashback)",
                        valueColor: AppColors.success
                    )
                }

                // Divider
                Rectangle()
                    .fill(AppColors.black400)
                    .frame(height: 1)

                // Total
                HStack {
                    Text("Total")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)

                    Spacer()

                    Text(formattedTotal)
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            .padding(Spacing.lg)
            .background(AppColors.black500)
            .cornerRadius(Radius.card)

            // Payment Method
            HStack(spacing: Spacing.md) {
                Image(systemName: paymentMethodIcon)
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.brand500)
                    .frame(width: 40, height: 40)
                    .background(AppColors.brand500.opacity(0.1))
                    .cornerRadius(Radius.sm)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Paying via")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500)

                    Text(paymentMethod.displayName)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.white)
                }

                Spacer()

                Button {
                    dismiss()
                } label: {
                    Text("Change")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.brand500)
                }
            }
            .padding(Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.card)

            Spacer()
                .frame(height: Spacing.sm)

            // Confirm Button - Figma: Secondary style (dark bg with orange border)
            PrimaryButton(
                title: "Confirm & Pay \(formattedTotal)",
                style: .secondary
            ) {
                onConfirm()
            }

            // Terms
            Text("By proceeding, you agree to the payment terms and conditions")
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(AppColors.neutral500)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
        .padding(.top, Spacing.md)
        .padding(.bottom, Spacing.xl)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.xl, corners: [.topLeft, .topRight])
    }

    // MARK: - Helpers

    private var paymentMethodIcon: String {
        switch paymentMethod {
        case .upiIntent, .upiCollect:
            return "link"
        case .creditCard, .debitCard:
            return "creditcard"
        case .netBanking:
            return "building.columns"
        case .wallet:
            return "wallet.pass"
        }
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "\u{20B9}\(Int(amount))"
    }
}

// MARK: - Summary Row

struct SummaryRow: View {
    let label: String
    let value: String
    var valueColor: Color = .white

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral500)

            Spacer()

            Text(value)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(valueColor)
        }
    }
}

// MARK: - Previews

#Preview("Payment Summary") {
    ZStack {
        AppColors.backgroundPrimary
            .ignoresSafeArea()

        VStack {
            Spacer()

            PaymentSummaryView(
                paymentId: "test-123",
                rentAmountPaise: 2500000,
                pgFeePaise: 45000,
                cashbackAppliedPaise: 25000,
                paymentMethod: .creditCard,
                onConfirm: {
                    print("Confirmed")
                }
            )
        }
    }
}

#Preview("Summary - No Fees") {
    ZStack {
        AppColors.backgroundPrimary
            .ignoresSafeArea()

        VStack {
            Spacer()

            PaymentSummaryView(
                paymentId: "test-123",
                rentAmountPaise: 2500000,
                pgFeePaise: 0,
                cashbackAppliedPaise: 0,
                paymentMethod: .upiIntent,
                onConfirm: {}
            )
        }
    }
}
