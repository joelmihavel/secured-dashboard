/// TransactionDetailView.swift
/// Flent Secured v2 - Transaction Detail Screen

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
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        // Back Button
                        Button {
                            coordinator.pop()
                        } label: {
                            Image(systemName: "arrow.left")
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(AppColors.textPrimary)
                        }

                        // Header
                        VStack(spacing: Spacing.md) {
                            // Status Icon
                            ZStack {
                                Circle()
                                    .fill(statusBackgroundColor)
                                    .frame(width: 80, height: 80)

                                Image(systemName: statusIcon)
                                    .font(.system(size: 32))
                                    .foregroundColor(statusColor)
                            }

                            // Amount
                            Text(viewModel.totalAmount)
                                .font(Typography.amountLarge)
                                .foregroundColor(AppColors.textPrimary)

                            // Status
                            Text(viewModel.statusDisplayName)
                                .font(Typography.bodyMd)
                                .foregroundColor(statusColor)

                            // Date
                            Text(viewModel.transactionDate)
                                .font(Typography.bodySm)
                                .foregroundColor(AppColors.textSecondary)
                        }
                        .frame(maxWidth: .infinity)

                        // Details Card
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text("Payment Details")
                                .font(Typography.label)
                                .foregroundColor(AppColors.textMuted)

                            VStack(spacing: Spacing.sm) {
                                DetailRow(label: "Rent Month", value: viewModel.paymentMonth)
                                DetailRow(label: "Rent Amount", value: viewModel.rentAmount)

                                if Double(viewModel.pgFee.dropFirst()) ?? 0 > 0 {
                                    DetailRow(label: "PG Fee", value: viewModel.pgFee)
                                }

                                if Double(viewModel.cashbackApplied.dropFirst()) ?? 0 > 0 {
                                    DetailRow(label: "Cashback Applied", value: "-\(viewModel.cashbackApplied)", valueColor: AppColors.success)
                                }

                                Divider()
                                    .background(AppColors.border)

                                DetailRow(label: "Total Paid", value: viewModel.totalAmount, isTotal: true)
                            }
                            .padding(Spacing.md)
                            .background(AppColors.backgroundSecondary)
                            .cornerRadius(Radius.card)
                        }

                        // Payment Method
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Payment Method")
                                .font(Typography.label)
                                .foregroundColor(AppColors.textMuted)

                            HStack {
                                Image(systemName: "creditcard")
                                    .foregroundColor(AppColors.textSecondary)
                                Text(viewModel.paymentMethod)
                                    .font(Typography.bodyMd)
                                    .foregroundColor(AppColors.textPrimary)
                            }
                            .padding(Spacing.md)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(AppColors.backgroundSecondary)
                            .cornerRadius(Radius.card)
                        }

                        Spacer()
                            .frame(height: Spacing.xl)

                        // Actions
                        if viewModel.canGenerateReceipt {
                            SecondaryButton(
                                title: viewModel.isGeneratingReceipt ? "Generating..." : "Download Receipt"
                            ) {
                                Task {
                                    await viewModel.generateReceipt()
                                    if viewModel.receiptUrl != nil {
                                        showShareSheet = true
                                    }
                                }
                            }
                        }
                    }
                    .screenPadding()
                    .padding(.top, Spacing.xl)
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

    private var statusIcon: String {
        switch viewModel.status {
        case .success, .settled: return "checkmark.circle.fill"
        case .failed, .refunded: return "xmark.circle.fill"
        case .initiated, .processing: return "clock.fill"
        }
    }

    private var statusColor: Color {
        switch viewModel.status {
        case .success, .settled: return AppColors.success
        case .failed, .refunded: return AppColors.error
        case .initiated, .processing: return AppColors.warning
        }
    }

    private var statusBackgroundColor: Color {
        statusColor.opacity(0.2)
    }
}

// MARK: - Detail Row

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

#Preview {
    TransactionDetailView(transactionId: "test-123")
        .environment(AppCoordinator())
}
