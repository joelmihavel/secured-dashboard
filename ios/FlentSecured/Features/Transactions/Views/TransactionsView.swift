/// TransactionsView.swift
/// Flent Secured v2 - Transaction History Screen
///
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
                        LazyVStack(spacing: Spacing.sm) {
                            ForEach(viewModel.groupedTransactions, id: \.month) { group in
                                Section {
                                    ForEach(group.transactions) { transaction in
                                        TransactionCard(transaction: transaction) {
                                            coordinator.navigate(to: .transactionDetail(id: transaction.id))
                                        }
                                    }
                                } header: {
                                    HStack {
                                        Text(group.transactions.first?.monthName ?? group.month)
                                            .font(Typography.label)
                                            .foregroundColor(AppColors.textMuted)
                                        Spacer()
                                    }
                                    .padding(.top, Spacing.md)
                                }
                            }

                            // Load more
                            if viewModel.hasMorePages {
                                ProgressView()
                                    .tint(AppColors.accentPrimary)
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

// MARK: - Transaction Card

struct TransactionCard: View {
    let transaction: PaymentData
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.md) {
                // Status Icon
                ZStack {
                    Circle()
                        .fill(statusBackgroundColor)
                        .frame(width: 44, height: 44)

                    Image(systemName: transaction.statusIcon)
                        .foregroundColor(statusColor)
                }

                // Details
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text("Rent Payment")
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text(transaction.formattedDate)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textSecondary)
                }

                Spacer()

                // Amount
                VStack(alignment: .trailing, spacing: Spacing.xxs) {
                    Text(transaction.formattedAmount)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text(transaction.paymentStatus.displayName)
                        .font(Typography.caption)
                        .foregroundColor(statusColor)
                }
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
