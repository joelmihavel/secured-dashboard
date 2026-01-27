/// PaymentResultView.swift
/// Flent Secured v2 - Payment Result Screen
///
/// Figma: node-id=1:35238 (Success), node-id=1:35361 (Failed)
/// - Receipt card with ticket cutout
/// - PAID/FAILED stamp
/// - Transaction details with # prefix
/// - Cashback badge (success)
/// - Error messages with icons (failure)

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

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: Spacing.xl) {
                    Spacer()
                        .frame(height: Spacing.xxl)

                    // Receipt Card
                    if viewModel.isSuccess {
                        successReceiptCard
                    } else {
                        failureReceiptCard
                    }

                    // Action Buttons
                    VStack(spacing: Spacing.md) {
                        if viewModel.isSuccess {
                            PrimaryButton(title: "Download Receipt") {
                                Task {
                                    await viewModel.generateReceipt()
                                    if viewModel.receiptUrl != nil {
                                        showShareSheet = true
                                    }
                                }
                            }

                            Button(action: {
                                // Contact support
                            }) {
                                Text("Contact Support")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(AppColors.neutral500)
                            }

                            Button(action: {
                                coordinator.popToRoot()
                                coordinator.navigate(to: .home(state: .paidThisMonth(settlementStatus: .processing)))
                            }) {
                                Text("Back to home")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(AppColors.brand500)
                                    .underline()
                            }
                        } else {
                            PrimaryButton(title: "Contact Support") {
                                // Open support
                            }

                            Button(action: {
                                coordinator.pop()
                            }) {
                                Text("Try Again")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(AppColors.brand500)
                                    .underline()
                            }
                        }
                    }
                    .padding(.horizontal, Spacing.screenHorizontalCompact)

                    Spacer()
                        .frame(height: Spacing.xl)
                }
            }
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

    // MARK: - Success Receipt Card

    private var successReceiptCard: some View {
        ReceiptCard {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Header with stamp
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Payment")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(.white)
                        Text("Successful")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(AppColors.brand500)
                    }

                    Spacer()

                    PaymentStamp(status: .paid)
                }

                // Divider
                Rectangle()
                    .fill(AppColors.black400)
                    .frame(height: 1)

                // Transaction Details
                VStack(spacing: Spacing.sm) {
                    ReceiptRow(label: "Amount paid", value: viewModel.formattedAmount)
                    ReceiptRow(label: "Date", value: viewModel.formattedDate)
                    ReceiptRow(label: "Method", value: viewModel.paymentMethod)
                    ReceiptRow(label: "Transaction ID", value: viewModel.transactionId)
                }

                // Cashback pill
                if viewModel.cashbackAmount > 0 {
                    Text("₹\(viewModel.formattedCashback) cashback applied")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.sm)
                        .frame(maxWidth: .infinity)
                        .background(AppColors.black500)
                        .cornerRadius(Radius.pill)
                }

                // Payable rent
                ReceiptRow(label: "Payable Rent", value: viewModel.formattedPayableRent)
            }
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
    }

    // MARK: - Failure Receipt Card

    private var failureReceiptCard: some View {
        ReceiptCard {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Header with stamp
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Payment")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(.white)
                        Text("Failed")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(AppColors.error)
                    }

                    Spacer()

                    PaymentStamp(status: .failed)
                }

                // Divider
                Rectangle()
                    .fill(AppColors.black400)
                    .frame(height: 1)

                // Error Messages
                VStack(alignment: .leading, spacing: Spacing.md) {
                    PaymentErrorRow(text: "Something didn't go through this time.")
                    PaymentErrorRow(text: "Your money is safe and hasn't been deducted.")
                    PaymentErrorRow(text: "If your account was debited, it will be automatically reversed within 3-5 business days.")
                }
            }
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
    }
}

// MARK: - Payment Error Row

struct PaymentErrorRow: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Image(systemName: "creditcard.fill")
                .font(.system(size: 20))
                .foregroundColor(AppColors.brand500)

            Text(text)
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral300)
                .fixedSize(horizontal: false, vertical: true)
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
