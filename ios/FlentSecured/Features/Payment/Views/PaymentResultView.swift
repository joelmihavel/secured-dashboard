/// PaymentResultView.swift
/// Flent Secured v2 - Payment Result Screen
///
/// Shows payment success or failure
///
/// Figma: Pay Rent / Success and Failure screens

import SwiftUI

struct PaymentResultView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel: PaymentResultViewModel
    @State private var showShareSheet = false

    init(paymentId: String, success: Bool) {
        self._viewModel = State(initialValue: PaymentResultViewModel(
            paymentId: paymentId,
            isSuccess: success
        ))
    }

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: Spacing.xxl) {
                Spacer()

                // Result Content
                if viewModel.isSuccess {
                    successContent
                } else {
                    failureContent
                }

                Spacer()

                // Actions
                if viewModel.isSuccess {
                    VStack(spacing: Spacing.md) {
                        PrimaryButton(title: "Done") {
                            coordinator.popToRoot()
                            coordinator.navigate(to: .home(state: .paidThisMonth(settlementStatus: .processing)))
                        }

                        TextButton(title: "View Receipt") {
                            Task {
                                await viewModel.generateReceipt()
                                if viewModel.receiptUrl != nil {
                                    showShareSheet = true
                                }
                            }
                        }
                    }
                } else {
                    VStack(spacing: Spacing.md) {
                        PrimaryButton(title: "Try Again") {
                            coordinator.pop()
                        }

                        TextButton(title: "Contact Support") {
                            // Open support
                        }
                    }
                }
            }
            .screenPadding()
        }
        .navigationBarHidden(true)
        .navigationBarBackButtonHidden(true)
        .task {
            await viewModel.loadPaymentDetails()
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = viewModel.receiptUrl {
                ShareSheet(items: [url])
            }
        }
    }

    private var successContent: some View {
        VStack(spacing: Spacing.lg) {
            // Success Icon
            ZStack {
                Circle()
                    .fill(AppColors.success.opacity(0.2))
                    .frame(width: 120, height: 120)

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 80))
                    .foregroundColor(AppColors.success)
            }
            .accessibilityIdentifier("payment_success_icon")

            // Text
            VStack(spacing: Spacing.sm) {
                Text("Payment Successful!")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text("₹25,000")
                    .font(Typography.amountLarge)
                    .foregroundColor(AppColors.success)

                Text("Jan 26, 2026 at 10:30 AM")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
            }

            // Cashback Badge
            HStack(spacing: Spacing.xs) {
                Image(systemName: "gift.fill")
                    .foregroundColor(AppColors.accentPrimary)

                Text("+₹250 cashback earned!")
                    .font(Typography.bodySmMedium)
                    .foregroundColor(AppColors.accentPrimary)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm)
            .background(AppColors.accentPrimary.opacity(0.1))
            .cornerRadius(Radius.pill)
        }
    }

    private var failureContent: some View {
        VStack(spacing: Spacing.lg) {
            // Failure Icon
            ZStack {
                Circle()
                    .fill(AppColors.error.opacity(0.2))
                    .frame(width: 120, height: 120)

                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 80))
                    .foregroundColor(AppColors.error)
            }
            .accessibilityIdentifier("payment_failure_icon")

            // Text
            VStack(spacing: Spacing.sm) {
                Text("Payment Failed")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text("Your payment couldn't be processed. Please try again.")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }
}

#Preview("Success") {
    PaymentResultView(paymentId: "test-123", success: true)
        .environment(AppCoordinator())
}

#Preview("Failure") {
    PaymentResultView(paymentId: "test-123", success: false)
        .environment(AppCoordinator())
}
