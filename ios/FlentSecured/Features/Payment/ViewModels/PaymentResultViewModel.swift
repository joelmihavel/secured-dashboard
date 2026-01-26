/// PaymentResultViewModel.swift
/// Flent Secured v2 - Payment Result ViewModel
///
/// Manages payment result display and receipt generation
///
/// Figma: Pay Rent / Success and Failure screens

import Foundation
import Observation

// MARK: - Payment Result ViewModel

@Observable
final class PaymentResultViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case loadingReceipt
        case receiptLoaded(ReceiptData)
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var paymentDetails: PaymentData?
    private(set) var receiptData: ReceiptData?

    let paymentId: String
    let isSuccess: Bool

    // MARK: - Computed Properties

    var isLoadingReceipt: Bool {
        if case .loadingReceipt = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var amountPaid: String {
        guard let details = paymentDetails else { return "₹0" }
        return formatCurrency(details.totalAmount)
    }

    var cashbackEarned: String {
        // Cashback is 1% of rent (not total)
        guard let details = paymentDetails, isSuccess else { return "₹0" }
        let cashback = details.rentAmount * 0.01
        return formatCurrency(cashback)
    }

    var paymentDate: String {
        guard let details = paymentDetails,
              let completedAt = details.completedAt else {
            return formatDate(Date())
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: completedAt) {
            return formatDate(date)
        }
        return completedAt
    }

    var paymentMonth: String {
        guard let details = paymentDetails else { return "" }
        // Convert "2026-01" to "January 2026"
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        if let date = formatter.date(from: details.paymentMonth) {
            formatter.dateFormat = "MMMM yyyy"
            return formatter.string(from: date)
        }
        return details.paymentMonth
    }

    var receiptUrl: URL? {
        guard let receipt = receiptData else { return nil }
        return URL(string: receipt.downloadUrl)
    }

    var failureMessage: String {
        "Your payment couldn't be processed. Please try again or use a different payment method."
    }

    // MARK: - Dependencies

    private let paymentService: PaymentServiceProtocol

    // MARK: - Initialization

    init(
        paymentId: String,
        isSuccess: Bool,
        paymentService: PaymentServiceProtocol = AppEnvironment.shared.paymentService
    ) {
        self.paymentId = paymentId
        self.isSuccess = isSuccess
        self.paymentService = paymentService
    }

    // MARK: - Actions

    @MainActor
    func loadPaymentDetails() async {
        do {
            let statusData = try await paymentService.getPaymentStatus(paymentId: paymentId)
            // Convert to PaymentData if needed
            // For now, we just track success state
        } catch {
            // Non-fatal - we can show result without details
        }
    }

    @MainActor
    func generateReceipt() async {
        guard isSuccess else { return }

        state = .loadingReceipt

        do {
            let receipt = try await paymentService.generateReceipt(paymentId: paymentId)
            receiptData = receipt
            state = .receiptLoaded(receipt)
        } catch let error as PaymentServiceError {
            state = .error(error.errorDescription ?? "Failed to generate receipt")
        } catch {
            state = .error("Unable to generate receipt. Please try again.")
        }
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

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, yyyy 'at' h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - Preview Helpers

extension PaymentResultViewModel {
    static var previewSuccess: PaymentResultViewModel {
        PaymentResultViewModel(
            paymentId: "test-payment-123",
            isSuccess: true,
            paymentService: MockPaymentService()
        )
    }

    static var previewFailure: PaymentResultViewModel {
        PaymentResultViewModel(
            paymentId: "test-payment-123",
            isSuccess: false,
            paymentService: MockPaymentService()
        )
    }

    static var previewWithReceipt: PaymentResultViewModel {
        let vm = PaymentResultViewModel(
            paymentId: "test-payment-123",
            isSuccess: true,
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
