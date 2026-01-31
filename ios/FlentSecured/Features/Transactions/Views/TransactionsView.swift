/// TransactionsView.swift
/// Flent Secured v2 - Transaction History Screen
///
/// Figma: 41-5792, 41-5998 - Recent Payments list
/// Shows payment history with filtering

import SwiftUI

struct TransactionsView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel: TransactionsViewModel

    init() {
        self._viewModel = State(initialValue: TransactionsViewModel(tenancyId: ""))
    }

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Back Button
                Button {
                    coordinator.pop()
                } label: {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(AppColors.textPrimary)
                }

                // Header
                HStack {
                    Text("Transaction History")
                        .font(Typography.h4)
                        .foregroundColor(AppColors.textPrimary)

                    Spacer()

                    // Filter Picker
                    Menu {
                        ForEach(TransactionsViewModel.Filter.allCases, id: \.self) { filter in
                            Button {
                                viewModel.selectedFilter = filter
                            } label: {
                                HStack {
                                    Text(filter.rawValue)
                                    if viewModel.selectedFilter == filter {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        HStack(spacing: Spacing.xxs) {
                            Text(viewModel.selectedFilter.rawValue)
                                .font(Typography.bodySm)
                            Image(systemName: "chevron.down")
                                .font(.system(size: 12))
                        }
                        .foregroundColor(AppColors.textSecondary)
                    }
                }

                // Transactions List
                if viewModel.isLoading {
                    VStack(spacing: Spacing.md) {
                        ProgressView()
                            .tint(AppColors.accentPrimary)
                        Text("Loading transactions...")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textMuted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, Spacing.xxl)
                } else if viewModel.isEmpty {
                    VStack(spacing: Spacing.md) {
                        Image(systemName: "clock.arrow.circlepath")
                            .font(.system(size: 48))
                            .foregroundColor(AppColors.textMuted)

                        Text("No transactions yet")
                            .font(Typography.bodyMd2)
                            .foregroundColor(AppColors.textSecondary)

                        Text("Your payment history will appear here")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textMuted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, Spacing.xxl)
                } else {
                    ScrollView {
                        LazyVStack(spacing: Spacing.zero) {
                            ForEach(viewModel.filteredTransactions) { transaction in
                                TransactionListItemView(transaction: transaction) {
                                    coordinator.navigate(to: .transactionDetail(id: transaction.id))
                                }
                            }

                            // Load more
                            if viewModel.hasMorePages {
                                ProgressView()
                                    .tint(AppColors.accentPrimary)
                                    .padding(.vertical, Spacing.lg)
                                    .onAppear {
                                        Task {
                                            await viewModel.loadMoreTransactions()
                                        }
                                    }
                            }
                        }
                    }
                }
            }
            .screenPadding()
            .padding(.top, Spacing.xl)
        }
        .navigationBarHidden(true)
        .task {
            if let tenancyId = appState.currentTenancy?.id {
                viewModel = TransactionsViewModel(tenancyId: tenancyId)
            }
            await viewModel.loadTransactions()
        }
        .refreshable {
            await viewModel.refresh()
        }
    }
}

// MARK: - Transaction List Item View
/// Figma: Transaction row with gradient avatar, title, status, and amount

struct TransactionListItemView: View {
    let transaction: PaymentData
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.md) {
                // Gradient Avatar
                TransactionAvatarView()

                // Details
                VStack(alignment: .leading, spacing: Spacing.xxxs) {
                    // Title: Month + "rent"
                    Text(transaction.rentTitle)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    // Status with date
                    HStack(spacing: Spacing.xxs) {
                        // Status dot
                        Circle()
                            .fill(statusColor)
                            .frame(width: 6, height: 6)

                        Text(statusText)
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textSecondary)
                    }
                }

                Spacer()

                // Amount - right aligned
                Text(transaction.formattedAmountWithSpace)
                    .font(Typography.bodyMdMedium)
                    .foregroundColor(AppColors.textPrimary)
            }
            .padding(.vertical, Spacing.md)
        }
        .buttonStyle(.plain)
    }

    private var statusColor: Color {
        switch transaction.paymentStatus {
        case .success, .settled: return AppColors.success
        case .failed, .refunded: return AppColors.error
        case .initiated, .processing: return AppColors.warning
        }
    }

    private var statusText: String {
        let status = transaction.paymentStatus.shortDisplayName
        let date = transaction.formattedDateTime
        return "\(status) - \(date)"
    }
}

// MARK: - Transaction Avatar View
/// Gradient circle avatar for transaction list items

struct TransactionAvatarView: View {
    var body: some View {
        Circle()
            .fill(
                LinearGradient(
                    colors: [
                        Color(hex: "FF9A6D"),  // Orange
                        Color(hex: "FF6B9D")   // Pink
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .frame(width: 44, height: 44)
    }
}

// MARK: - Transaction Card (Legacy - kept for compatibility)

struct TransactionCard: View {
    let transaction: PaymentData
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.md) {
                // Gradient Avatar
                TransactionAvatarView()

                // Details
                VStack(alignment: .leading, spacing: Spacing.xxxs) {
                    Text(transaction.rentTitle)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    HStack(spacing: Spacing.xxs) {
                        Circle()
                            .fill(statusColor)
                            .frame(width: 6, height: 6)

                        Text("\(transaction.paymentStatus.shortDisplayName) - \(transaction.formattedDateTime)")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textSecondary)
                    }
                }

                Spacer()

                Text(transaction.formattedAmountWithSpace)
                    .font(Typography.bodyMdMedium)
                    .foregroundColor(AppColors.textPrimary)
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.card)
        }
    }

    private var statusColor: Color {
        switch transaction.paymentStatus {
        case .success, .settled: return AppColors.success
        case .failed, .refunded: return AppColors.error
        case .initiated, .processing: return AppColors.warning
        }
    }

    private var statusBackgroundColor: Color {
        statusColor.opacity(0.2)
    }
}

#Preview {
    TransactionsView()
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Transaction List Item") {
    ZStack {
        AppColors.backgroundPrimary.ignoresSafeArea()
        VStack(spacing: 0) {
            TransactionListItemView(
                transaction: PaymentData.previewSuccess,
                action: {}
            )
            TransactionListItemView(
                transaction: PaymentData.previewPending,
                action: {}
            )
            TransactionListItemView(
                transaction: PaymentData.previewFailed,
                action: {}
            )
        }
        .padding()
    }
}
