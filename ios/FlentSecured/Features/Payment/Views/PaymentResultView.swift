/// PaymentResultView.swift
/// Flent Secured v2 - Payment Result Screens
///
/// Figma Nodes:
/// - 41:9388 - Payment Successful (with cashback, confetti)
/// - 41:9460 - Payment Processing (realtime status) - Handled in PaymentProcessingView
/// - 41:9511 - Payment Failed
/// - 41:9563 - Success No Cashback (after 7th payment)
/// - 41:9635 - Payment Refunded (refund timeline)
///
/// Features:
/// - Receipt card with ticket edge design
/// - PAID/FAILED/REFUNDED stamps
/// - Share receipt functionality
/// - Confetti animation for success with cashback
/// - Error messaging for failures
/// - Refund timeline for refunded payments

import SwiftUI

// MARK: - Payment Result State

enum PaymentResultState: Equatable {
    case successWithCashback
    case successNoCashback
    case failed
    case refunded

    var isPositive: Bool {
        self == .successWithCashback || self == .successNoCashback
    }
}

// MARK: - Payment Result View

/// Main payment result screen
/// Figma: node-id=41:9388, 41:9511, 41:9563, 41:9635
struct PaymentResultView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel: PaymentResultViewModel
    @State private var showShareSheet = false
    @State private var showConfetti = false
    @State private var confettiPieces: [ConfettiPiece] = []

    private let resultState: PaymentResultState

    init(paymentId: String, success: Bool, hasCashback: Bool = true, refunded: Bool = false) {
        self._viewModel = State(initialValue: PaymentResultViewModel(
            paymentId: paymentId,
            isSuccess: success && !refunded,
            isRefunded: refunded
        ))

        if refunded {
            self.resultState = .refunded
        } else if success {
            self.resultState = hasCashback ? .successWithCashback : .successNoCashback
        } else {
            self.resultState = .failed
        }
    }

    var body: some View {
        ZStack {
            // Background
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            // Confetti animation for success with cashback
            if showConfetti && resultState == .successWithCashback {
                ConfettiOverlay(pieces: confettiPieces)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }

            ScrollView(showsIndicators: false) {
                VStack(spacing: Spacing.xl) {
                    Spacer()
                        .frame(height: Spacing.xxl)

                    // Status Animation - Figma: Icon in circle with status
                    statusSection

                    // Receipt Card - Based on state
                    switch resultState {
                    case .successWithCashback:
                        successReceiptCard(hasCashback: true)
                    case .successNoCashback:
                        successReceiptCard(hasCashback: false)
                    case .failed:
                        failureReceiptCard
                    case .refunded:
                        refundedSection
                    }

                    // Action Buttons
                    actionButtons

                    Spacer()
                        .frame(height: Spacing.xl)
                }
                .padding(.horizontal, Spacing.screenHorizontalCompact)
            }
        }
        .navigationBarHidden(true)
        .navigationBarBackButtonHidden(true)
        .task {
            await viewModel.loadPaymentDetails()

            // Trigger confetti for success with cashback after brief delay
            if resultState == .successWithCashback {
                try? await Task.sleep(nanoseconds: 300_000_000)
                generateConfetti()
                withAnimation(.spring(response: 0.3)) {
                    showConfetti = true
                }
            }
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = viewModel.receiptUrl {
                ShareSheet(items: [url])
            } else {
                ShareSheet(items: [generateReceiptText()])
            }
        }
        .onAppear {
            // Trigger haptic feedback based on result
            if resultState.isPositive {
                HapticManager.shared.notification(.success)
            } else {
                HapticManager.shared.notification(.error)
            }
        }
    }

    // MARK: - Status Section

    /// Figma: Status icon in circle + title + subtitle
    private var statusSection: some View {
        VStack(spacing: Spacing.md) {
            // Icon circle - Figma: 80x80 with icon
            ZStack {
                Circle()
                    .fill(statusColor.opacity(0.2))
                    .frame(width: 80, height: 80)

                Image(systemName: statusIconName)
                    .font(.system(size: 40, weight: .medium))
                    .foregroundColor(statusColor)
                    .symbolEffect(.bounce, value: resultState)
            }

            // Title - Figma: 24px semibold white
            Text(statusTitle)
                .font(.system(size: 24, weight: .semibold))
                .foregroundColor(.white)

            // Subtitle - Figma: 14px regular neutral/500
            Text(statusSubtitle)
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral500)
                .multilineTextAlignment(.center)
        }
    }

    private var statusIconName: String {
        switch resultState {
        case .successWithCashback, .successNoCashback:
            return "checkmark.circle.fill"
        case .failed:
            return "xmark.circle.fill"
        case .refunded:
            return "arrow.uturn.backward.circle.fill"
        }
    }

    private var statusColor: Color {
        switch resultState {
        case .successWithCashback, .successNoCashback:
            return AppColors.success
        case .failed:
            return AppColors.error
        case .refunded:
            return AppColors.warning
        }
    }

    private var statusTitle: String {
        switch resultState {
        case .successWithCashback, .successNoCashback:
            return "Payment Successful"
        case .failed:
            return "Payment Failed"
        case .refunded:
            return "Payment Refunded"
        }
    }

    private var statusSubtitle: String {
        switch resultState {
        case .successWithCashback:
            return "Your rent has been paid successfully"
        case .successNoCashback:
            return "Your rent has been paid"
        case .failed:
            return "We couldn't process your payment"
        case .refunded:
            return "Your payment has been refunded"
        }
    }

    // MARK: - Success Receipt Card

    /// Figma: node-id=41:9388 (with cashback), node-id=41:9563 (no cashback)
    /// Receipt card with ticket cutout edges, PAID stamp, and transaction details
    private func successReceiptCard(hasCashback: Bool) -> some View {
        ReceiptCard {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Header with stamp - Figma: Split color title + stamp
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

                // Transaction Details - Figma: Receipt rows with # prefix
                VStack(spacing: Spacing.sm) {
                    ReceiptRow(label: "Amount paid", value: viewModel.formattedAmount)
                    ReceiptRow(label: "Date", value: viewModel.formattedDate)
                    ReceiptRow(label: "Method", value: viewModel.paymentMethod)
                    ReceiptRow(label: "Transaction ID", value: viewModel.transactionId)
                }

                // Cashback pill or late payment notice
                if hasCashback && viewModel.cashbackAmount > 0 {
                    // Cashback earned pill - Figma: Dark bg pill with gift icon
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
                } else if !hasCashback {
                    // No cashback info pill - Figma: Warning-tinted pill
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "info.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(AppColors.warning)

                        Text("Cashback not available for late payments")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(AppColors.neutral500)
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
                    .frame(maxWidth: .infinity)
                    .background(AppColors.warning.opacity(0.1))
                    .cornerRadius(Radius.pill)
                }

                // Payable rent row - Figma: Highlighted total row
                ReceiptRow(
                    label: "Payable Rent",
                    value: viewModel.formattedPayableRent,
                    isHighlighted: true
                )
            }
        }
    }

    // MARK: - Failure Receipt Card

    /// Figma: node-id=41:9511
    /// Receipt card with FAILED stamp and error messages
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

                // Error Messages with icons - Figma: Icon + text rows
                VStack(alignment: .leading, spacing: Spacing.md) {
                    PaymentInfoRow(
                        icon: "creditcard.fill",
                        iconColor: AppColors.brand500,
                        text: "Something didn't go through this time."
                    )
                    PaymentInfoRow(
                        icon: "checkmark.shield.fill",
                        iconColor: AppColors.success,
                        text: "Your money is safe and hasn't been deducted."
                    )
                    PaymentInfoRow(
                        icon: "clock.arrow.circlepath",
                        iconColor: AppColors.warning,
                        text: "If your account was debited, it will be automatically reversed within 3-5 business days."
                    )
                }
            }
        }
    }

    // MARK: - Refunded Section

    /// Figma: node-id=41:9635 - Payment Refunded with timeline
    private var refundedSection: some View {
        VStack(spacing: Spacing.lg) {
            // Receipt Card with refund details
            ReceiptCard {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    // Header with stamp
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Payment")
                                .font(.system(size: 24, weight: .regular))
                                .foregroundColor(.white)
                            Text("Refunded")
                                .font(.system(size: 24, weight: .regular))
                                .foregroundColor(AppColors.warning)
                        }

                        Spacer()

                        PaymentStamp(status: .refunded)
                    }

                    // Dashed divider
                    DashedDivider()

                    // Refund Details
                    VStack(spacing: Spacing.sm) {
                        ReceiptRow(label: "Original Amount", value: viewModel.formattedAmount)
                        ReceiptRow(label: "Refund Amount", value: viewModel.formattedAmount)
                        ReceiptRow(label: "Refund Date", value: viewModel.formattedDate)
                        ReceiptRow(label: "Transaction ID", value: viewModel.transactionId)
                    }
                }
            }

            // Refund Timeline Card
            refundTimelineCard
        }
    }

    /// Refund timeline showing status progression
    private var refundTimelineCard: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Refund Timeline")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white)

            VStack(spacing: 0) {
                RefundTimelineRow(
                    icon: "arrow.uturn.backward.circle.fill",
                    title: "Refund Initiated",
                    subtitle: viewModel.formattedDate,
                    isCompleted: true,
                    isLast: false
                )

                RefundTimelineRow(
                    icon: "hourglass.circle.fill",
                    title: "Processing by Bank",
                    subtitle: "Your bank is processing the refund",
                    isCompleted: true,
                    isLast: false
                )

                RefundTimelineRow(
                    icon: "checkmark.circle.fill",
                    title: "Credit to Account",
                    subtitle: "Expected within 3-5 business days",
                    isCompleted: false,
                    isLast: true
                )
            }
        }
        .padding(Spacing.md)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.card)
    }

    // MARK: - Action Buttons

    /// Bottom action buttons based on result state
    /// Figma: Secondary button style (dark bg with orange border) for all main CTAs
    private var actionButtons: some View {
        VStack(spacing: Spacing.md) {
            switch resultState {
            case .successWithCashback, .successNoCashback:
                // Download Receipt button - Figma 41:9563: Secondary style (dark with orange border)
                PrimaryButton(
                    title: "Download Receipt",
                    isLoading: viewModel.isLoadingReceipt,
                    style: .secondary
                ) {
                    Task {
                        await viewModel.generateReceipt()
                        showShareSheet = true
                    }
                }

                // Contact Support text link - Figma: neutral500 text
                Button(action: { openSupport() }) {
                    Text("Contact Support")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.neutral500)
                }

            case .failed:
                // Contact Support button - Figma 41:9511: Secondary style
                PrimaryButton(
                    title: "Contact Support",
                    style: .secondary
                ) {
                    openSupport()
                }

                // Try Again text link - Figma: neutral500 text
                Button(action: {
                    coordinator.pop()
                    coordinator.pop()
                }) {
                    Text("Try Again")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.neutral500)
                }

            case .refunded:
                // Contact Support button - Figma 41:9635: Secondary style
                PrimaryButton(
                    title: "Contact Support",
                    style: .secondary
                ) {
                    openSupport()
                }

                // Try Again text link - Figma: neutral500 text
                Button(action: {
                    coordinator.popToRoot()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        coordinator.navigate(to: .payment)
                    }
                }) {
                    Text("Try Again")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.neutral500)
                }
            }
        }
    }

    private func openSupport() {
        if let url = URL(string: "mailto:support@flent.app") {
            UIApplication.shared.open(url)
        }
    }

    // MARK: - Confetti Generation

    private func generateConfetti() {
        let colors: [Color] = [
            AppColors.brand500,
            AppColors.success,
            AppColors.warning,
            Color.white,
            Color.yellow,
            Color.orange
        ]

        confettiPieces = (0..<60).map { _ in
            ConfettiPiece(
                x: CGFloat.random(in: 0...UIScreen.main.bounds.width),
                color: colors.randomElement() ?? AppColors.brand500,
                delay: Double.random(in: 0...0.8),
                size: CGFloat.random(in: 6...12)
            )
        }
    }

    private func generateReceiptText() -> String {
        """
        Flent Secured - Payment Receipt

        Status: \(statusTitle)
        Amount: \(viewModel.formattedAmount)
        Date: \(viewModel.formattedDate)
        Method: \(viewModel.paymentMethod)
        Transaction ID: \(viewModel.transactionId)

        Thank you for using Flent Secured!
        """
    }
}

// MARK: - Payment Info Row

/// Info message row with icon and text
struct PaymentInfoRow: View {
    let icon: String
    let iconColor: Color
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(iconColor)
                .frame(width: 24)

            Text(text)
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral300)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Refund Timeline Row

struct RefundTimelineRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let isCompleted: Bool
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            // Timeline indicator
            VStack(spacing: 0) {
                // Icon circle
                ZStack {
                    Circle()
                        .fill(isCompleted ? AppColors.success.opacity(0.2) : AppColors.black500)
                        .frame(width: 32, height: 32)

                    Image(systemName: icon)
                        .font(.system(size: 14))
                        .foregroundColor(isCompleted ? AppColors.success : AppColors.neutral500)
                }

                // Connecting line (if not last)
                if !isLast {
                    Rectangle()
                        .fill(isCompleted ? AppColors.success : AppColors.black400)
                        .frame(width: 2, height: 32)
                }
            }

            // Content
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(isCompleted ? .white : AppColors.neutral500)

                Text(subtitle)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }
            .padding(.top, 4)

            Spacer()
        }
    }
}

// MARK: - Confetti Components

struct ConfettiPiece: Identifiable {
    let id = UUID()
    let x: CGFloat
    let color: Color
    let delay: Double
    let size: CGFloat
}

struct ConfettiOverlay: View {
    let pieces: [ConfettiPiece]

    var body: some View {
        GeometryReader { geometry in
            ForEach(pieces) { piece in
                ConfettiPieceView(piece: piece, screenHeight: geometry.size.height)
            }
        }
    }
}

struct ConfettiPieceView: View {
    let piece: ConfettiPiece
    let screenHeight: CGFloat

    @State private var yOffset: CGFloat = -50
    @State private var rotation: Double = 0
    @State private var xWobble: CGFloat = 0
    @State private var opacity: Double = 1

    var body: some View {
        Rectangle()
            .fill(piece.color)
            .frame(width: piece.size, height: piece.size * 1.5)
            .rotationEffect(.degrees(rotation))
            .offset(x: piece.x + xWobble, y: yOffset)
            .opacity(opacity)
            .onAppear {
                // Fall animation
                withAnimation(.easeIn(duration: 3.0).delay(piece.delay)) {
                    yOffset = screenHeight + 100
                    rotation = Double.random(in: 360...1080)
                    opacity = 0
                }

                // Wobble animation
                withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) {
                    xWobble = CGFloat.random(in: -20...20)
                }
            }
    }
}

// MARK: - Previews

#Preview("Payment Success with Cashback") {
    PaymentResultView(paymentId: "test-123", success: true, hasCashback: true)
        .environment(AppCoordinator())
}

#Preview("Payment Success No Cashback") {
    PaymentResultView(paymentId: "test-123", success: true, hasCashback: false)
        .environment(AppCoordinator())
}

#Preview("Payment Failure") {
    PaymentResultView(paymentId: "test-123", success: false)
        .environment(AppCoordinator())
}

#Preview("Payment Refunded") {
    PaymentResultView(paymentId: "test-123", success: false, refunded: true)
        .environment(AppCoordinator())
}
