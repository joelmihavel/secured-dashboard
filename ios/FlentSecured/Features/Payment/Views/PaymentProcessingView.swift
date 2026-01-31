/// PaymentProcessingView.swift
/// Flent Secured v2 - Payment Processing Screen
///
/// Figma: node-id=41:9460 - Payment Processing
/// Shows while payment is being processed
/// Uses Realtime subscription to track payment status
///
/// Features:
/// - Receipt card with PENDING stamp (matching result screen style)
/// - Info rows with card icons showing processing steps
/// - Contact Support button at bottom (secondary style)

import SwiftUI

struct PaymentProcessingView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel: PaymentProcessingViewModel

    init(paymentId: String) {
        self._viewModel = State(initialValue: PaymentProcessingViewModel(paymentId: paymentId))
    }

    var body: some View {
        ZStack {
            // Background
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern - consistent with other payment screens
            DottedGridPattern()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Navigation header with back button
                navigationHeader

                ScrollView(showsIndicators: false) {
                    VStack(spacing: Spacing.xl) {
                        Spacer()
                            .frame(height: Spacing.xxl)

                        // Receipt Card - Figma 41:9460
                        processingReceiptCard

                        Spacer()
                            .frame(height: Spacing.xl)
                    }
                    .padding(.horizontal, Spacing.screenHorizontalCompact)
                }

                // Bottom CTA - Figma: Secondary button style
                bottomCTA
            }
        }
        .navigationBarHidden(true)
        .navigationBarBackButtonHidden(true)
        .task {
            viewModel.startProcessing()
        }
        .onChange(of: viewModel.isCompleted) { _, isCompleted in
            if isCompleted {
                // Haptic feedback
                HapticManager.shared.notification(viewModel.isSuccess ? .success : .error)

                // Navigate after small delay for animation
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    coordinator.navigate(to: .paymentResult(
                        paymentId: viewModel.paymentId,
                        success: viewModel.isSuccess
                    ))
                }
            }
        }
        .onDisappear {
            viewModel.stopProcessing()
        }
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

    // MARK: - Processing Receipt Card

    /// Figma 41:9460: Receipt card with PENDING stamp and info rows
    private var processingReceiptCard: some View {
        ReceiptCard {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Header with stamp - Figma: "Payment" / "Processing" with PENDING stamp
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Payment")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(.white)
                        Text("Processing")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(AppColors.brand500)
                    }

                    Spacer()

                    // PENDING stamp
                    PendingStamp()
                }

                // Dashed divider
                DashedDivider()

                // Info Messages - Figma: Card icon + text rows
                VStack(alignment: .leading, spacing: Spacing.md) {
                    PaymentInfoRow(
                        icon: "creditcard.fill",
                        iconColor: AppColors.brand500,
                        text: "We've received your payment request."
                    )
                    PaymentInfoRow(
                        icon: "creditcard.fill",
                        iconColor: AppColors.brand500,
                        text: "This can take a few minutes depending on your bank."
                    )
                    PaymentInfoRow(
                        icon: "creditcard.fill",
                        iconColor: AppColors.brand500,
                        text: "You'll see confirmation here once it's complete."
                    )
                }
            }
        }
    }

    // MARK: - Bottom CTA

    private var bottomCTA: some View {
        VStack(spacing: Spacing.md) {
            // Contact Support button - Figma 41:9460: Secondary style
            PrimaryButton(
                title: "Contact Support",
                style: .secondary
            ) {
                if let url = URL(string: "mailto:support@flent.app") {
                    UIApplication.shared.open(url)
                }
            }
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
        .padding(.vertical, Spacing.lg)
    }

}

// MARK: - Pending Stamp

/// PENDING stamp for processing receipt card
/// Figma: node-id=41:9460
/// - Size: 64x64
/// - Rotation: -15 degrees
/// - Color: brand500 (orange)
struct PendingStamp: View {
    var body: some View {
        ZStack {
            // Outer stamp border with dashed pattern
            Circle()
                .stroke(AppColors.brand500, style: StrokeStyle(lineWidth: 2, dash: [4, 2]))
                .frame(width: 64, height: 64)

            // Inner circle
            Circle()
                .stroke(AppColors.brand500.opacity(0.5), lineWidth: 1)
                .frame(width: 54, height: 54)

            // Content
            VStack(spacing: 2) {
                // Stars row
                HStack(spacing: 3) {
                    ForEach(0..<3, id: \.self) { _ in
                        Image(systemName: "star.fill")
                            .font(.system(size: 5))
                            .foregroundColor(AppColors.brand500)
                    }
                }

                // Status icon - hourglass for pending
                Image(systemName: "hourglass")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(AppColors.brand500)

                // Status text
                Text("PENDING")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(AppColors.brand500)
                    .tracking(0.5)

                // Bottom stars row
                HStack(spacing: 3) {
                    ForEach(0..<3, id: \.self) { _ in
                        Image(systemName: "star.fill")
                            .font(.system(size: 5))
                            .foregroundColor(AppColors.brand500)
                    }
                }
            }
        }
        .rotationEffect(.degrees(-15))
    }
}

// MARK: - Preview

#Preview("Payment Processing") {
    PaymentProcessingView(paymentId: "test-123")
        .environment(AppCoordinator())
}
