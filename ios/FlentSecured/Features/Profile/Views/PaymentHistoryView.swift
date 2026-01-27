/// PaymentHistoryView.swift
/// Flent Secured v2 - Payment History Screen
///
/// Displays list of past payments with filtering
/// - Filter by status (All, Successful, Pending, Failed)
/// - Grouped by month
/// - Navigate to transaction detail
///
/// Figma: Profile > Payment History

import SwiftUI

struct PaymentHistoryView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel: PaymentHistoryViewModel

    init() {
        self._viewModel = State(initialValue: PaymentHistoryViewModel(tenancyId: ""))
    }

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Header with back button
                HStack {
                    Button {
                        coordinator.pop()
                    } label: {
                        Image(systemName: "arrow.left")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(.white)
                    }

                    Spacer()
                }
                .padding(.top, Spacing.md)

                // Title and Filter Row
                HStack(alignment: .bottom) {
                    // Title - Split color
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Payment")
                            .font(.system(size: 32, weight: .light))
                            .foregroundColor(.white)
                        Text("History")
                            .font(.system(size: 32, weight: .light))
                            .foregroundColor(AppColors.brand500)
                    }

                    Spacer()

                    // Filter Menu
                    Menu {
                        ForEach(PaymentHistoryViewModel.Filter.allCases, id: \.self) { filter in
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
                        .padding(.horizontal, Spacing.sm)
                        .padding(.vertical, Spacing.xs)
                        .background(AppColors.black500)
                        .cornerRadius(Radius.sm)
                    }
                }

                // Summary Stats
                if !viewModel.isLoading && !viewModel.isEmpty {
                    PaymentStatsSummary(
                        totalPayments: viewModel.totalPayments,
                        successfulPayments: viewModel.successfulPayments,
                        totalAmount: viewModel.totalAmountPaid
                    )
                }

                // Content
                if viewModel.isLoading {
                    Spacer()
                    VStack(spacing: Spacing.md) {
                        ProgressView()
                            .tint(AppColors.accentPrimary)
                        Text("Loading payment history...")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textMuted)
                    }
                    .frame(maxWidth: .infinity)
                    Spacer()
                } else if viewModel.isEmpty {
                    Spacer()
                    VStack(spacing: Spacing.md) {
                        Image(systemName: "creditcard.slash")
                            .font(.system(size: 48))
                            .foregroundColor(AppColors.textMuted)

                        Text("No payments yet")
                            .font(Typography.bodyMd2)
                            .foregroundColor(AppColors.textSecondary)

                        Text("Your payment history will appear here once you make your first payment")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textMuted)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Spacing.lg)
                    Spacer()
                } else {
                    ScrollView {
                        LazyVStack(spacing: Spacing.sm) {
                            ForEach(viewModel.groupedPayments, id: \.month) { group in
                                Section {
                                    ForEach(group.payments) { payment in
                                        PaymentHistoryItemCard(payment: payment) {
                                            coordinator.navigate(to: .transactionDetail(id: payment.id))
                                        }
                                    }
                                } header: {
                                    HStack {
                                        Text(group.displayMonth)
                                            .font(Typography.label)
                                            .foregroundColor(AppColors.textMuted)

                                        Spacer()

                                        Text("\(group.payments.count) payment\(group.payments.count == 1 ? "" : "s")")
                                            .font(Typography.caption)
                                            .foregroundColor(AppColors.neutral500)
                                    }
                                    .padding(.top, Spacing.md)
                                    .padding(.bottom, Spacing.xs)
                                }
                            }

                            // Load more indicator
                            if viewModel.hasMorePages {
                                ProgressView()
                                    .tint(AppColors.accentPrimary)
                                    .padding(.vertical, Spacing.md)
                                    .onAppear {
                                        Task {
                                            await viewModel.loadMore()
                                        }
                                    }
                            }

                            // Bottom padding
                            Spacer()
                                .frame(height: Spacing.xl)
                        }
                    }
                    .refreshable {
                        await viewModel.refresh()
                    }
                }
            }
            .padding(.horizontal, Spacing.screenHorizontalCompact)
        }
        .navigationBarHidden(true)
        .task {
            if let tenancyId = appState.currentTenancy?.id {
                viewModel = PaymentHistoryViewModel(tenancyId: tenancyId)
            }
            await viewModel.loadPayments()
        }
    }
}

// MARK: - Payment Stats Summary

struct PaymentStatsSummary: View {
    let totalPayments: Int
    let successfulPayments: Int
    let totalAmount: String

    var body: some View {
        HStack(spacing: Spacing.md) {
            // Total Payments
            VStack(spacing: Spacing.xxs) {
                Text("\(totalPayments)")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundColor(.white)
                Text("Total")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.neutral500)
            }
            .frame(maxWidth: .infinity)

            // Divider
            Rectangle()
                .fill(AppColors.black400)
                .frame(width: 1, height: 40)

            // Successful Payments
            VStack(spacing: Spacing.xxs) {
                Text("\(successfulPayments)")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundColor(AppColors.success)
                Text("Successful")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.neutral500)
            }
            .frame(maxWidth: .infinity)

            // Divider
            Rectangle()
                .fill(AppColors.black400)
                .frame(width: 1, height: 40)

            // Total Amount
            VStack(spacing: Spacing.xxs) {
                Text(totalAmount)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(AppColors.brand500)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                Text("Paid")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.neutral500)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.black400, lineWidth: 1)
        )
    }
}

// MARK: - Payment History Card

struct PaymentHistoryItemCard: View {
    let payment: PaymentData
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.md) {
                // Status Icon
                ZStack {
                    Circle()
                        .fill(statusBackgroundColor)
                        .frame(width: 44, height: 44)

                    Image(systemName: payment.statusIcon)
                        .font(.system(size: 18))
                        .foregroundColor(statusColor)
                }

                // Details
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text("Rent Payment")
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text(payment.formattedDate)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textSecondary)
                }

                Spacer()

                // Amount and Status
                VStack(alignment: .trailing, spacing: Spacing.xxs) {
                    Text(payment.formattedAmount)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    HStack(spacing: Spacing.xxs) {
                        Circle()
                            .fill(statusColor)
                            .frame(width: 6, height: 6)

                        Text(payment.paymentStatus.displayName)
                            .font(Typography.caption)
                            .foregroundColor(statusColor)
                    }
                }

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.brand500)
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.card)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.card)
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
        .buttonStyle(CardButtonStyle())
    }

    private var statusColor: Color {
        switch payment.paymentStatus {
        case .success, .settled: return AppColors.success
        case .failed, .refunded: return AppColors.error
        case .initiated, .processing: return AppColors.warning
        }
    }

    private var statusBackgroundColor: Color {
        statusColor.opacity(0.2)
    }
}

// MARK: - Payment History ViewModel

@Observable
final class PaymentHistoryViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    // MARK: - Filter

    enum Filter: String, CaseIterable {
        case all = "All"
        case successful = "Successful"
        case pending = "Pending"
        case failed = "Failed"
    }

    // MARK: - Grouped Payments

    struct PaymentGroup {
        let month: String
        let payments: [PaymentData]

        var displayMonth: String {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM"
            if let date = formatter.date(from: month) {
                formatter.dateFormat = "MMMM yyyy"
                return formatter.string(from: date)
            }
            return month
        }
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var payments: [PaymentData] = []
    private(set) var hasMorePages = true

    var selectedFilter: Filter = .all {
        didSet { applyFilter() }
    }

    private var allPayments: [PaymentData] = []
    private var currentOffset = 0
    private let pageSize = 20

    // MARK: - Computed Properties

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var isEmpty: Bool {
        payments.isEmpty && !isLoading
    }

    var totalPayments: Int {
        allPayments.count
    }

    var successfulPayments: Int {
        allPayments.filter { $0.paymentStatus.isSuccess }.count
    }

    var totalAmountPaid: String {
        let total = allPayments
            .filter { $0.paymentStatus.isSuccess }
            .reduce(0.0) { $0 + $1.totalAmount }

        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 0

        if total >= 100000 {
            let lakhs = total / 100000.0
            return "\u{20B9}\(String(format: "%.1f", lakhs))L"
        }

        return formatter.string(from: NSNumber(value: total)) ?? "\u{20B9}\(Int(total))"
    }

    var groupedPayments: [PaymentGroup] {
        let grouped = Dictionary(grouping: payments) { $0.paymentMonth }

        return grouped
            .map { PaymentGroup(month: $0.key, payments: $0.value) }
            .sorted { $0.month > $1.month }
    }

    // MARK: - Dependencies

    private let tenancyId: String
    private let paymentService: PaymentServiceProtocol

    // MARK: - Initialization

    init(
        tenancyId: String,
        paymentService: PaymentServiceProtocol = AppEnvironment.shared.paymentService
    ) {
        self.tenancyId = tenancyId
        self.paymentService = paymentService
    }

    // MARK: - Actions

    @MainActor
    func loadPayments() async {
        state = .loading
        currentOffset = 0

        do {
            let fetchedPayments = try await paymentService.getPaymentHistory(
                tenancyId: tenancyId,
                limit: pageSize,
                offset: 0
            )

            allPayments = fetchedPayments
            applyFilter()
            hasMorePages = fetchedPayments.count >= pageSize
            state = .loaded
        } catch let error as PaymentServiceError {
            state = .error(error.errorDescription ?? "Failed to load payment history")
        } catch {
            state = .error("Unable to load payment history. Please try again.")
        }
    }

    @MainActor
    func loadMore() async {
        guard hasMorePages, !isLoading else { return }

        let nextOffset = currentOffset + pageSize

        do {
            let morePayments = try await paymentService.getPaymentHistory(
                tenancyId: tenancyId,
                limit: pageSize,
                offset: nextOffset
            )

            allPayments.append(contentsOf: morePayments)
            currentOffset = nextOffset
            hasMorePages = morePayments.count >= pageSize
            applyFilter()
        } catch {
            // Silent failure for pagination
        }
    }

    @MainActor
    func refresh() async {
        await loadPayments()
    }

    // MARK: - Private Helpers

    private func applyFilter() {
        switch selectedFilter {
        case .all:
            payments = allPayments
        case .successful:
            payments = allPayments.filter { $0.paymentStatus.isSuccess }
        case .pending:
            payments = allPayments.filter { $0.paymentStatus.isPending }
        case .failed:
            payments = allPayments.filter { $0.paymentStatus.isFailed }
        }
    }
}

// MARK: - Preview

#Preview {
    PaymentHistoryView()
        .environment(AppCoordinator())
        .environment(AppState())
}
