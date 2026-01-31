/// TransactionDetailView.swift
/// Flent Secured v2 - Transaction Detail Screen
///
/// Figma: 41-9388 (Success), 41-9460 (Processing), 41-9511 (Failed), 41-9635 (Refunded)
/// Receipt-style card with stamp badge, payment details, and action buttons

import SwiftUI

struct TransactionDetailView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel: TransactionDetailViewModel
    @State private var showShareSheet = false

    init(transactionId: String) {
        self._viewModel = State(initialValue: TransactionDetailViewModel(transactionId: transactionId))
    }

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            if viewModel.isLoading {
                ProgressView()
                    .tint(AppColors.accentPrimary)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        // Back Button
                        Button {
                            coordinator.pop()
                        } label: {
                            Image(systemName: "arrow.left")
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(AppColors.textPrimary)
                        }
                        .padding(.bottom, Spacing.md)

                        // Receipt Card
                        ReceiptCardView(
                            status: viewModel.status,
                            amountPaid: viewModel.totalAmount,
                            date: viewModel.formattedShortDate,
                            method: viewModel.paymentMethod,
                            transactionId: viewModel.transactionId,
                            cashbackApplied: viewModel.cashbackAmount,
                            payableRent: viewModel.rentAmount,
                            hasCashback: viewModel.hasCashbackApplied
                        )

                        Spacer()
                            .frame(height: Spacing.md)

                        // Action Buttons
                        VStack(spacing: Spacing.md) {
                            if viewModel.canGenerateReceipt {
                                // Download Receipt Button
                                Button {
                                    Task {
                                        await viewModel.generateReceipt()
                                        if viewModel.receiptUrl != nil {
                                            showShareSheet = true
                                        }
                                    }
                                } label: {
                                    HStack {
                                        Spacer()
                                        Text(viewModel.isGeneratingReceipt ? "Generating..." : "Download Receipt")
                                            .font(Typography.button)
                                            .foregroundColor(AppColors.textPrimary)
                                        Spacer()
                                    }
                                    .padding(.vertical, Spacing.md)
                                    .background(AppColors.backgroundSecondary)
                                    .cornerRadius(Radius.button)
                                }
                                .disabled(viewModel.isGeneratingReceipt)
                            }

                            // Contact Support Button
                            Button {
                                // Contact support action
                            } label: {
                                Text("Contact Support")
                                    .font(Typography.bodyMd2)
                                    .foregroundColor(AppColors.textSecondary)
                            }

                            // Try Again (for failed/refunded)
                            if viewModel.status == .failed || viewModel.status == .refunded {
                                Button {
                                    coordinator.pop()
                                } label: {
                                    Text("Try Again")
                                        .font(Typography.bodyMd2)
                                        .foregroundColor(AppColors.accentPrimary)
                                }
                            }
                        }
                    }
                    .screenPadding()
                    .padding(.top, Spacing.xl)
                    .padding(.bottom, Spacing.xxl)
                }
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadTransaction()
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = viewModel.receiptUrl {
                ShareSheet(items: [url])
            }
        }
    }
}

// MARK: - Receipt Card View

struct ReceiptCardView: View {
    let status: PaymentStatus
    let amountPaid: String
    let date: String
    let method: String
    let transactionId: String
    let cashbackApplied: Double
    let payableRent: String
    let hasCashback: Bool

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Receipt Background with torn edge effect
            VStack(spacing: 0) {
                // Torn top edge
                ReceiptTornEdge()
                    .fill(AppColors.backgroundSecondary)
                    .frame(height: 12)

                // Main content
                VStack(spacing: Spacing.lg) {
                    // Header with stamp
                    HStack {
                        Spacer()
                        StatusStampView(status: status)
                    }
                    .padding(.top, Spacing.sm)

                    // Title
                    VStack(spacing: Spacing.xxs) {
                        Text("Payment")
                            .font(Typography.h5)
                            .foregroundColor(AppColors.textPrimary)

                        Text(statusSubtitle)
                            .font(Typography.h5)
                            .foregroundColor(statusColor)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    // Content based on status
                    if status.isSuccess {
                        successContent
                    } else if status.isPending {
                        pendingContent
                    } else {
                        failedContent
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.bottom, Spacing.lg)
                .background(AppColors.backgroundSecondary)

                // Torn bottom edge
                ReceiptTornEdge()
                    .fill(AppColors.backgroundSecondary)
                    .frame(height: 12)
                    .rotationEffect(.degrees(180))
            }

            // Paper clip decoration
            PaperClipView()
                .offset(x: Spacing.md, y: -Spacing.xs)
        }
    }

    // MARK: - Success Content

    private var successContent: some View {
        VStack(spacing: Spacing.sm) {
            // Amount paid
            ReceiptRow(label: "Amount paid", value: amountPaid)

            // Date
            ReceiptRow(label: "Date", value: date)

            // Method
            ReceiptRow(label: "Method", value: method)

            // Transaction ID
            ReceiptRow(label: "Transaction ID", value: transactionId.prefix(12).uppercased() + "...")

            // Cashback pill or message
            if hasCashback {
                CashbackPillView(amount: cashbackApplied)
            } else {
                CashbackMessageView(message: "Pay by the 7th to earn cashback.")
            }

            // Payable Rent
            ReceiptRow(label: "Payable Rent", value: payableRent, isHighlighted: true)
        }
    }

    // MARK: - Pending Content

    private var pendingContent: some View {
        VStack(spacing: Spacing.md) {
            StatusMessageCard(
                message: "We've received your payment request."
            )

            StatusMessageCard(
                message: "This can take a few minutes depending on your bank."
            )

            StatusMessageCard(
                message: "You'll see confirmation here once it's complete."
            )
        }
    }

    // MARK: - Failed Content

    private var failedContent: some View {
        VStack(spacing: Spacing.md) {
            if status == .refunded {
                StatusMessageCard(
                    message: "Your payment was not completed and the amount has been returned to your account."
                )

                StatusMessageCard(
                    message: "Refunds usually reflect within 3-5 business days."
                )
            } else {
                StatusMessageCard(
                    message: "Something didn't go through this time."
                )

                StatusMessageCard(
                    message: "Your money is safe and hasn't been deducted."
                )

                StatusMessageCard(
                    message: "If money was debited, it will automatically be refunded within 3-5 business days"
                )
            }
        }
    }

    // MARK: - Computed Properties

    private var statusSubtitle: String {
        switch status {
        case .success, .settled: return "Succesful"
        case .processing, .initiated: return "Processing"
        case .failed: return "Failed"
        case .refunded: return "Refunded"
        }
    }

    private var statusColor: Color {
        switch status {
        case .success, .settled: return AppColors.success
        case .processing, .initiated: return AppColors.accentPrimary
        case .failed: return AppColors.error
        case .refunded: return AppColors.textSecondary
        }
    }
}

// MARK: - Transaction Receipt Row

private struct TransactionReceiptRow: View {
    let label: String
    let value: String
    var isHighlighted: Bool = false

    var body: some View {
        HStack {
            HStack(spacing: Spacing.xs) {
                Text("#")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textMuted)
                Text(label)
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textMuted)
            }

            Spacer()

            Text(value)
                .font(isHighlighted ? Typography.bodyMdMedium : Typography.bodySmMedium)
                .foregroundColor(isHighlighted ? AppColors.accentPrimary : AppColors.textPrimary)
        }
    }
}

// MARK: - Status Stamp View

struct StatusStampView: View {
    let status: PaymentStatus

    var body: some View {
        ZStack {
            // Dashed circle border
            Circle()
                .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [4, 3]))
                .foregroundColor(stampColor)
                .frame(width: 72, height: 72)

            // Inner content
            VStack(spacing: 2) {
                // Stars
                HStack(spacing: 2) {
                    ForEach(0..<3, id: \.self) { _ in
                        Image(systemName: "star.fill")
                            .font(.system(size: 6))
                    }
                }

                Text(stampText)
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1)

                // Bottom stars
                HStack(spacing: 2) {
                    ForEach(0..<3, id: \.self) { _ in
                        Image(systemName: "star.fill")
                            .font(.system(size: 6))
                    }
                }
            }
            .foregroundColor(stampColor)
        }
    }

    private var stampText: String {
        switch status {
        case .success, .settled: return "PAID"
        case .processing, .initiated: return "PENDING"
        case .failed: return "FAILED"
        case .refunded: return "REFUNDED"
        }
    }

    private var stampColor: Color {
        switch status {
        case .success, .settled: return AppColors.success
        case .processing, .initiated: return AppColors.textMuted
        case .failed: return AppColors.error
        case .refunded: return AppColors.textMuted
        }
    }
}

// MARK: - Paper Clip View

struct PaperClipView: View {
    var body: some View {
        // Simplified paper clip shape
        ZStack {
            RoundedRectangle(cornerRadius: 4)
                .stroke(AppColors.textMuted.opacity(0.5), lineWidth: 2)
                .frame(width: 16, height: 40)
                .offset(y: 10)

            RoundedRectangle(cornerRadius: 3)
                .stroke(AppColors.textMuted.opacity(0.5), lineWidth: 2)
                .frame(width: 10, height: 24)
                .offset(y: 2)
        }
    }
}

// MARK: - Receipt Torn Edge

struct ReceiptTornEdge: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let zigzagHeight: CGFloat = rect.height
        let zigzagWidth: CGFloat = 12

        path.move(to: CGPoint(x: 0, y: zigzagHeight))

        var x: CGFloat = 0
        while x < rect.width {
            path.addLine(to: CGPoint(x: x + zigzagWidth / 2, y: 0))
            path.addLine(to: CGPoint(x: x + zigzagWidth, y: zigzagHeight))
            x += zigzagWidth
        }

        path.addLine(to: CGPoint(x: rect.width, y: zigzagHeight))
        path.closeSubpath()

        return path
    }
}

// MARK: - Cashback Pill View

struct CashbackPillView: View {
    let amount: Double

    var body: some View {
        HStack {
            Spacer()
            Text("\(TransactionCurrencyFormatter.formatRupees(amount)) cashback applied")
                .font(Typography.caption)
                .foregroundColor(AppColors.textPrimary)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.xs)
                .background(AppColors.backgroundElevated)
                .cornerRadius(Radius.pill)
            Spacer()
        }
        .padding(.vertical, Spacing.xs)
    }
}

// MARK: - Cashback Message View

struct CashbackMessageView: View {
    let message: String

    var body: some View {
        HStack {
            Spacer()
            Text(message)
                .font(Typography.caption)
                .foregroundColor(AppColors.textMuted)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.xs)
                .background(AppColors.backgroundElevated)
                .cornerRadius(Radius.pill)
            Spacer()
        }
        .padding(.vertical, Spacing.xs)
    }
}

// MARK: - Status Message Card

struct StatusMessageCard: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            // Credit card icon
            Image(systemName: "creditcard.fill")
                .font(.system(size: 24))
                .foregroundColor(AppColors.accentPrimary)
                .frame(width: 32, height: 32)

            Text(message)
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.leading)

            Spacer()
        }
        .padding(Spacing.md)
        .background(AppColors.backgroundElevated.opacity(0.5))
        .cornerRadius(Radius.sm)
    }
}

// MARK: - Currency Formatter Helper

private enum TransactionCurrencyFormatter {
    static func formatRupees(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "\u{20B9}\(Int(amount))"
    }
}

// MARK: - Detail Row (Legacy - kept for compatibility)

struct DetailRow: View {
    let label: String
    let value: String
    var valueColor: Color = AppColors.textPrimary
    var isTotal: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(isTotal ? Typography.bodyMd : Typography.bodySm)
                .foregroundColor(AppColors.textSecondary)
            Spacer()
            Text(value)
                .font(isTotal ? Typography.bodyMdMedium : Typography.bodySmMedium)
                .foregroundColor(valueColor)
        }
    }
}

#Preview("Success with Cashback") {
    TransactionDetailView(transactionId: "test-123")
        .environment(AppCoordinator())
}

#Preview("Receipt Card - Success") {
    ZStack {
        AppColors.backgroundPrimary.ignoresSafeArea()
        ReceiptCardView(
            status: .success,
            amountPaid: "\u{20B9} 32,175",
            date: "4 Nov 2026",
            method: "UPI (joel@oksbi)",
            transactionId: "SEC12345678",
            cashbackApplied: 350,
            payableRent: "\u{20B9} 32,175",
            hasCashback: true
        )
        .padding()
    }
}

#Preview("Receipt Card - Processing") {
    ZStack {
        AppColors.backgroundPrimary.ignoresSafeArea()
        ReceiptCardView(
            status: .processing,
            amountPaid: "\u{20B9} 32,500",
            date: "4 Nov 2026",
            method: "UPI",
            transactionId: "SEC12345678",
            cashbackApplied: 0,
            payableRent: "\u{20B9} 32,500",
            hasCashback: false
        )
        .padding()
    }
}

#Preview("Receipt Card - Failed") {
    ZStack {
        AppColors.backgroundPrimary.ignoresSafeArea()
        ReceiptCardView(
            status: .failed,
            amountPaid: "\u{20B9} 32,500",
            date: "4 Nov 2026",
            method: "UPI",
            transactionId: "SEC12345678",
            cashbackApplied: 0,
            payableRent: "\u{20B9} 32,500",
            hasCashback: false
        )
        .padding()
    }
}
