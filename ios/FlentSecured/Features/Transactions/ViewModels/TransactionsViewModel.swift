/// TransactionsViewModel.swift
/// Flent Secured v2 - Transactions ViewModel
///
/// Manages transaction history loading and filtering
///
/// Figma: Transaction History screens

import Foundation
import Observation

// MARK: - Transactions ViewModel

@Observable
final class TransactionsViewModel {

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

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var transactions: [PaymentData] = []
    private(set) var hasMorePages = true

    var selectedFilter: Filter = .all {
        didSet { applyFilter() }
    }

    private var allTransactions: [PaymentData] = []
    private var currentOffset = 0
    private let pageSize = 20

    // MARK: - Computed Properties

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var isEmpty: Bool {
        transactions.isEmpty && !isLoading
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var filteredTransactions: [PaymentData] {
        transactions
    }

    /// Group transactions by month
    var groupedTransactions: [(month: String, transactions: [PaymentData])] {
        let grouped = Dictionary(grouping: transactions) { transaction in
            transaction.paymentMonth
        }

        return grouped
            .map { (month: $0.key, transactions: $0.value) }
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
    func loadTransactions() async {
        state = .loading
        currentOffset = 0

        do {
            let payments = try await paymentService.getPaymentHistory(
                tenancyId: tenancyId,
                limit: pageSize,
                offset: 0
            )

            allTransactions = payments
            applyFilter()
            hasMorePages = payments.count >= pageSize
            state = .loaded
        } catch let error as PaymentServiceError {
            state = .error(error.errorDescription ?? "Failed to load transactions")
        } catch {
            state = .error("Unable to load transactions. Please try again.")
        }
    }

    @MainActor
    func loadMoreTransactions() async {
        guard hasMorePages, !isLoading else { return }

        let nextOffset = currentOffset + pageSize

        do {
            let morePayments = try await paymentService.getPaymentHistory(
                tenancyId: tenancyId,
                limit: pageSize,
                offset: nextOffset
            )

            allTransactions.append(contentsOf: morePayments)
            currentOffset = nextOffset
            hasMorePages = morePayments.count >= pageSize
            applyFilter()
        } catch {
            // Silent failure for pagination
        }
    }

    @MainActor
    func refresh() async {
        await loadTransactions()
    }

    // MARK: - Private Helpers

    private func applyFilter() {
        switch selectedFilter {
        case .all:
            transactions = allTransactions
        case .successful:
            transactions = allTransactions.filter {
                $0.paymentStatus == .success || $0.paymentStatus == .settled
            }
        case .pending:
            transactions = allTransactions.filter {
                $0.paymentStatus == .initiated || $0.paymentStatus == .processing
            }
        case .failed:
            transactions = allTransactions.filter {
                $0.paymentStatus == .failed || $0.paymentStatus == .refunded
            }
        }
    }
}

// MARK: - Transaction Display Helpers

extension PaymentData {
    var statusIcon: String {
        switch paymentStatus {
        case .success, .settled: return "checkmark.circle.fill"
        case .failed, .refunded: return "xmark.circle.fill"
        case .initiated, .processing: return "clock.fill"
        }
    }

    var statusColor: String {
        switch paymentStatus {
        case .success, .settled: return "success"
        case .failed, .refunded: return "error"
        case .initiated, .processing: return "warning"
        }
    }

    var formattedAmount: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "₹"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: totalAmount)) ?? "₹\(Int(totalAmount))"
    }

    var formattedDate: String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "MMM d, yyyy"

        if let date = isoFormatter.date(from: createdAt) {
            return displayFormatter.string(from: date)
        }
        return createdAt
    }

    var monthName: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        if let date = formatter.date(from: paymentMonth) {
            formatter.dateFormat = "MMMM yyyy"
            return formatter.string(from: date)
        }
        return paymentMonth
    }
}

// MARK: - Preview Helpers

extension TransactionsViewModel {
    static var preview: TransactionsViewModel {
        TransactionsViewModel(
            tenancyId: "test-tenancy",
            paymentService: MockPaymentService()
        )
    }

    static var previewLoading: TransactionsViewModel {
        let vm = TransactionsViewModel(
            tenancyId: "test-tenancy",
            paymentService: MockPaymentService()
        )
        vm.state = .loading
        return vm
    }

    static var previewEmpty: TransactionsViewModel {
        let vm = TransactionsViewModel(
            tenancyId: "test-tenancy",
            paymentService: MockPaymentService()
        )
        vm.state = .loaded
        vm.transactions = []
        return vm
    }
}
