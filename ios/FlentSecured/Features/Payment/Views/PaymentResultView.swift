/// PaymentResultView.swift
/// Flent Secured v2 - Payment Result Screen
///
/// Figma: node-id=1:35238 (Success), node-id=1:35361 (Failed)
/// - Receipt card with ticket cutout pattern
/// - PAID stamp (green #06C270) / FAILED stamp (red #FF8080)
/// - Transaction details with # prefix
/// - Cashback badge (success only)
/// - Error messages with credit card icons (failure)
/// - Download Receipt button

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
                    actionButtons

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

    /// Figma: node-id=1:35238
    /// - Receipt card with paperclip decoration
    /// - Header: "Payment" (white) / "Successful" (orange)
    /// - PAID stamp: green (#06C270), 64x64, rotated -15deg
    /// - Transaction rows with # prefix
    /// - Cashback pill: dark bg, white text
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

                // Dashed divider
                DashedDivider()

                // Transaction Details
                VStack(spacing: Spacing.sm) {
                    ReceiptRow(label: "Amount paid", value: viewModel.formattedAmount)
                    ReceiptRow(label: "Date", value: viewModel.formattedDate)
                    ReceiptRow(label: "Method", value: viewModel.paymentMethod)
                    ReceiptRow(label: "Transaction ID", value: viewModel.transactionId)
                }

                // Cashback pill - Figma: dark bg (#202020), rounded pill
                if viewModel.cashbackAmount > 0 {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "gift.fill")
                            .font(.system(size: 14))
                            .foregroundColor(AppColors.brand500)

                        Text("\u{20B9}\(viewModel.formattedCashback) cashback earned")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
                    .frame(maxWidth: .infinity)
                    .background(AppColors.black500)
                    .cornerRadius(Radius.pill)
                }

                // Payable rent row
                ReceiptRow(label: "Payable Rent", value: viewModel.formattedPayableRent, isHighlighted: true)
            }
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
    }

    // MARK: - Failure Receipt Card

    /// Figma: node-id=1:35361
    /// - Receipt card with paperclip decoration
    /// - Header: "Payment" (white) / "Failed" (red #FF8080)
    /// - FAILED stamp: red (#FF8080), 64x64, rotated -15deg
    /// - Error messages with credit card icons
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

                // Dashed divider
                DashedDivider()

                // Error Messages with icons
                VStack(alignment: .leading, spacing: Spacing.md) {
                    PaymentErrorRow(
                        icon: "creditcard.fill",
                        text: "Something didn't go through this time."
                    )
                    PaymentErrorRow(
                        icon: "checkmark.shield.fill",
                        text: "Your money is safe and hasn't been deducted."
                    )
                    PaymentErrorRow(
                        icon: "clock.arrow.circlepath",
                        text: "If your account was debited, it will be automatically reversed within 3-5 business days."
                    )
                }
            }
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: Spacing.md) {
            if viewModel.isSuccess {
                // Download Receipt button
                PrimaryButton(
                    title: "Download Receipt",
                    isLoading: viewModel.isLoadingReceipt
                ) {
                    Task {
                        await viewModel.generateReceipt()
                        if viewModel.receiptUrl != nil {
                            showShareSheet = true
                        }
                    }
                }

                // Contact Support link
                Button(action: {
                    // Open support
                }) {
                    Text("Contact Support")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.neutral500)
                }

                // Back to home link
                Button(action: {
                    // Pop to root - the initial route will be determined by AppCoordinator
                    // based on AppState which should reflect the successful payment
                    coordinator.popToRoot()
                }) {
                    Text("Back to home")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.brand500)
                        .underline()
                }
            } else {
                // Contact Support button (primary on failure)
                PrimaryButton(title: "Contact Support") {
                    // Open support
                }

                // Try Again link
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
    }
}

// MARK: - Dashed Divider

/// Figma: dashed line divider for receipt cards
struct DashedDivider: View {
    var color: Color = AppColors.black400

    var body: some View {
        GeometryReader { geometry in
            Path { path in
                path.move(to: CGPoint(x: 0, y: 0))
                path.addLine(to: CGPoint(x: geometry.size.width, y: 0))
            }
            .stroke(style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
            .foregroundColor(color)
        }
        .frame(height: 1)
    }
}

// MARK: - Payment Error Row

/// Error message row for failed payment state
/// Figma: node-id=1:35361
/// - Icon: 20px SF Symbol in brand orange
/// - Text: 14px regular in neutral/300
struct PaymentErrorRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(AppColors.brand500)
                .frame(width: 24)

            Text(text)
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral300)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Previews

#Preview("Payment Success") {
    PaymentResultView(paymentId: "test-123", success: true)
        .environment(AppCoordinator())
}

#Preview("Payment Failure") {
    PaymentResultView(paymentId: "test-123", success: false)
        .environment(AppCoordinator())
}
