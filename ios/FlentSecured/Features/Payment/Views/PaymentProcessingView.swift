/// PaymentProcessingView.swift
/// Flent Secured v2 - Payment Processing Screen
///
/// Shows while payment is being processed
/// Uses Realtime subscription to track payment status
///
/// Figma: Pay Rent / Processing screens

import SwiftUI

struct PaymentProcessingView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel: PaymentProcessingViewModel

    init(paymentId: String) {
        self._viewModel = State(initialValue: PaymentProcessingViewModel(paymentId: paymentId))
    }

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                Spacer()

                // Animation
                VStack(spacing: Spacing.lg) {
                    // Loading Animation
                    ZStack {
                        Circle()
                            .stroke(AppColors.backgroundSecondary, lineWidth: 8)
                            .frame(width: 100, height: 100)

                        Circle()
                            .trim(from: 0, to: 0.7)
                            .stroke(AppColors.accentPrimary, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                            .frame(width: 100, height: 100)
                            .rotationEffect(.degrees(-90))
                            .animation(.linear(duration: 1).repeatForever(autoreverses: false), value: viewModel.stage)

                        Image(systemName: viewModel.stage.iconName)
                            .font(.system(size: 32))
                            .foregroundColor(AppColors.accentPrimary)
                    }

                    // Status Text
                    VStack(spacing: Spacing.xs) {
                        Text(viewModel.stage.title + viewModel.dots)
                            .font(Typography.h4)
                            .foregroundColor(AppColors.textPrimary)

                        Text(viewModel.stage.subtitle)
                            .font(Typography.bodyMd2)
                            .foregroundColor(AppColors.textSecondary)
                    }
                }

                Spacer()

                // Warning
                if viewModel.showWarning {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 14))
                            .foregroundColor(AppColors.warning)

                        Text("Please don't close the app while payment is processing")
                            .font(Typography.caption)
                            .foregroundColor(AppColors.textMuted)
                    }
                }
            }
            .screenPadding()
        }
        .navigationBarHidden(true)
        .navigationBarBackButtonHidden(true)
        .task {
            // Use actual status polling (which can be upgraded to Realtime)
            viewModel.startProcessing()
        }
        .onChange(of: viewModel.isCompleted) { _, isCompleted in
            if isCompleted {
                coordinator.navigate(to: .paymentResult(
                    paymentId: viewModel.paymentId,
                    success: viewModel.isSuccess
                ))
            }
        }
        .onDisappear {
            viewModel.stopProcessing()
        }
    }
}

#Preview {
    PaymentProcessingView(paymentId: "test-123")
        .environment(AppCoordinator())
}
