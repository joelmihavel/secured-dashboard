/// TransactionDetailViewModel.swift
/// Flent Secured v2 - Transaction Detail ViewModel
///
/// Manages single transaction detail view
///
/// Figma: Transaction Detail screens

import Foundation
import Observation

// MARK: - Transaction Detail ViewModel

@Observable
final class TransactionDetailViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var transaction: PaymentData?
    private(set) var receiptData: ReceiptData?
    private(set) var isGeneratingReceipt = false

    let transactionId: String

    // MARK: - Computed Properties

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    // Transaction details
    var rentAmount: String {
        guard let tx = transaction else { return "₹0" }
        return formatCurrency(tx.rentAmount)
    }

    var pgFee: String {
        guard let tx = transaction else { return "₹0" }
        return formatCurrency(tx.pgFee)
    }

    var cashbackApplied: String {
        guard let tx = transaction else { return "₹0" }
        let amount = Double(tx.cashbackAppliedPaise) / 100.0
        return formatCurrency(amount)
    }

    var totalAmount: String {
        guard let tx = transaction else { return "₹0" }
        return formatCurrency(tx.totalAmount)
    }

    var paymentMethod: String {
        guard let method = transaction?.paymentMethod else { return "Unknown" }
        return PaymentMethod(rawValue: method)?.displayName ?? method
    }

    var transactionDate: String {
        guard let tx = transaction else { return "" }
        return formatFullDate(tx.createdAt)
    }

    var paymentMonth: String {
        guard let tx = transaction else { return "" }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        if let date = formatter.date(from: tx.paymentMonth) {
            formatter.dateFormat = "MMMM yyyy"
            return formatter.string(from: date)
        }
        return tx.paymentMonth
    }

    var status: PaymentStatus {
        transaction?.paymentStatus ?? .initiated
    }

    var statusDisplayName: String {
        status.displayName
    }

    var canGenerateReceipt: Bool {
        status == .success || status == .settled
    }

    var hasReceipt: Bool {
        receiptData != nil
    }

    var receiptUrl: URL? {
        guard let receipt = receiptData else { return nil }
        return URL(string: receipt.downloadUrl)
    }

    // MARK: - Dependencies

    private let paymentService: PaymentServiceProtocol

    // MARK: - Initialization

    init(
        transactionId: String,
        paymentService: PaymentServiceProtocol = AppEnvironment.shared.paymentService
    ) {
        self.transactionId = transactionId
        self.paymentService = paymentService
    }

    // MARK: - Actions

    @MainActor
    func loadTransaction() async {
        state = .loading

        do {
            let statusData = try await paymentService.getPaymentStatus(paymentId: transactionId)

            // We need to get full payment data
            // For now, simulate loading
            state = .loaded
        } catch let error as PaymentServiceError {
            state = .error(error.errorDescription ?? "Failed to load transaction")
        } catch {
            state = .error("Unable to load transaction details.")
        }
    }

    @MainActor
    func generateReceipt() async {
        guard canGenerateReceipt else { return }

        isGeneratingReceipt = true

        do {
            let receipt = try await paymentService.generateReceipt(paymentId: transactionId)
            receiptData = receipt
        } catch {
            // Show error toast
        }

        isGeneratingReceipt = false
    }

    func shareReceipt() -> URL? {
        return receiptUrl
    }

    // MARK: - Private Helpers

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "₹"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "₹\(Int(amount))"
    }

    private func formatFullDate(_ isoString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "EEEE, MMM d, yyyy 'at' h:mm a"

        if let date = isoFormatter.date(from: isoString) {
            return displayFormatter.string(from: date)
        }
        return isoString
    }
}

// MARK: - Payment Data Extension

extension PaymentData {
    var pgFee: Double {
        Double(pgFeePaise) / 100.0
    }
}

// MARK: - Preview Helpers

extension TransactionDetailViewModel {
    static var preview: TransactionDetailViewModel {
        TransactionDetailViewModel(
            transactionId: "test-payment-123",
            paymentService: MockPaymentService()
        )
    }

    static var previewLoading: TransactionDetailViewModel {
        let vm = TransactionDetailViewModel(
            transactionId: "test-payment-123",
            paymentService: MockPaymentService()
        )
        vm.state = .loading
        return vm
    }

    static var previewWithReceipt: TransactionDetailViewModel {
        let vm = TransactionDetailViewModel(
            transactionId: "test-payment-123",
            paymentService: MockPaymentService()
        )
        vm.receiptData = ReceiptData(
            paymentId: "test-payment-123",
            receiptNumber: "RCP-2026-01-001",
            downloadUrl: "https://flent.app/receipts/test.pdf",
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )
        return vm
    }
}
