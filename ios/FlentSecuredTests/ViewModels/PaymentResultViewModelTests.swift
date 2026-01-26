/// PaymentResultViewModelTests.swift
/// Flent Secured v2 - Payment Result ViewModel Tests
///
/// Tests for payment success/failure result display

import Testing
import Foundation
@testable import Flent

@Suite("PaymentResultViewModel Tests")
struct PaymentResultViewModelTests {

    // MARK: - Initialization Tests

    @Test("Success state initializes correctly")
    func successStateInitializes() {
        let viewModel = PaymentResultViewModel(
            paymentId: "test-payment-123",
            isSuccess: true,
            paymentService: MockPaymentService()
        )

        #expect(viewModel.paymentId == "test-payment-123")
        #expect(viewModel.isSuccess == true)
    }

    @Test("Failure state initializes correctly")
    func failureStateInitializes() {
        let viewModel = PaymentResultViewModel(
            paymentId: "test-payment-123",
            isSuccess: false,
            paymentService: MockPaymentService()
        )

        #expect(viewModel.paymentId == "test-payment-123")
        #expect(viewModel.isSuccess == false)
    }

    // MARK: - State Tests

    @Test("Default state is idle")
    func defaultStateIsIdle() {
        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: MockPaymentService()
        )

        if case .idle = viewModel.state {
            // Correct
        } else {
            Issue.record("Expected idle state")
        }
    }

    @Test("isLoadingReceipt is false by default")
    func isLoadingReceiptDefaultFalse() {
        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: MockPaymentService()
        )

        #expect(viewModel.isLoadingReceipt == false)
    }

    @Test("errorMessage is nil by default")
    func errorMessageDefaultNil() {
        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: MockPaymentService()
        )

        #expect(viewModel.errorMessage == nil)
    }

    // MARK: - Display Properties Tests

    @Test("Amount paid shows ₹0 when no details")
    func amountPaidDefaultZero() {
        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: MockPaymentService()
        )

        #expect(viewModel.amountPaid == "₹0")
    }

    @Test("Cashback earned shows ₹0 when no details")
    func cashbackEarnedDefaultZero() {
        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: MockPaymentService()
        )

        #expect(viewModel.cashbackEarned == "₹0")
    }

    @Test("Cashback earned shows ₹0 for failures")
    func cashbackEarnedZeroForFailure() {
        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: false,
            paymentService: MockPaymentService()
        )

        #expect(viewModel.cashbackEarned == "₹0")
    }

    @Test("Failure message provides guidance")
    func failureMessageProvided() {
        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: false,
            paymentService: MockPaymentService()
        )

        let message = viewModel.failureMessage
        #expect(!message.isEmpty)
        #expect(message.contains("try again"))
    }

    @Test("Payment date formats current date when no details")
    func paymentDateFormatsCurrentDate() {
        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: MockPaymentService()
        )

        let date = viewModel.paymentDate
        #expect(!date.isEmpty)
    }

    // MARK: - Receipt Generation Tests

    @Test("Generate receipt only works for success")
    @MainActor
    func generateReceiptOnlyForSuccess() async {
        let mockService = MockPaymentService()

        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: false,
            paymentService: mockService
        )

        await viewModel.generateReceipt()

        // Should not transition to loading state for failures
        #expect(viewModel.isLoadingReceipt == false)
        #expect(mockService.generateReceiptCalled == false)
    }

    @Test("Generate receipt sets loading state")
    @MainActor
    func generateReceiptSetsLoadingState() async {
        let mockService = MockPaymentService()
        mockService.simulatedDelay = 0.5

        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: mockService
        )

        let task = Task {
            await viewModel.generateReceipt()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)
        #expect(viewModel.isLoadingReceipt == true)

        task.cancel()
    }

    @Test("Successful receipt generation stores data")
    @MainActor
    func successfulReceiptGeneration() async {
        let mockService = MockPaymentService()
        mockService.mockReceipt = ReceiptData(
            paymentId: "test",
            receiptNumber: "RCP-001",
            downloadUrl: "https://example.com/receipt.pdf",
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )

        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: mockService
        )

        await viewModel.generateReceipt()

        #expect(viewModel.receiptData != nil)
        #expect(viewModel.receiptData?.receiptNumber == "RCP-001")
    }

    @Test("Failed receipt generation shows error")
    @MainActor
    func failedReceiptGeneration() async {
        let mockService = MockPaymentService()
        mockService.shouldSucceed = false
        mockService.errorToThrow = PaymentServiceError.serverError("Receipt generation failed")

        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: mockService
        )

        await viewModel.generateReceipt()

        #expect(viewModel.errorMessage != nil)
    }

    @Test("Receipt URL available after generation")
    @MainActor
    func receiptURLAvailable() async {
        let mockService = MockPaymentService()
        mockService.mockReceipt = ReceiptData(
            paymentId: "test",
            receiptNumber: "RCP-001",
            downloadUrl: "https://example.com/receipt.pdf",
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )

        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: mockService
        )

        await viewModel.generateReceipt()

        #expect(viewModel.receiptUrl != nil)
        #expect(viewModel.receiptUrl?.absoluteString.contains("receipt.pdf") == true)
    }

    // MARK: - Share Receipt Tests

    @Test("Share receipt returns URL when available")
    @MainActor
    func shareReceiptReturnsURL() async {
        let mockService = MockPaymentService()
        mockService.mockReceipt = ReceiptData(
            paymentId: "test",
            receiptNumber: "RCP-001",
            downloadUrl: "https://example.com/receipt.pdf",
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )

        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: mockService
        )

        await viewModel.generateReceipt()
        let shareURL = viewModel.shareReceipt()

        #expect(shareURL != nil)
    }

    @Test("Share receipt returns nil when no receipt")
    func shareReceiptReturnsNilWhenNoReceipt() {
        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: MockPaymentService()
        )

        let shareURL = viewModel.shareReceipt()

        #expect(shareURL == nil)
    }

    // MARK: - Receipt State Tests

    @Test("Receipt loaded state after successful generation")
    @MainActor
    func receiptLoadedState() async {
        let mockService = MockPaymentService()
        mockService.mockReceipt = ReceiptData(
            paymentId: "test",
            receiptNumber: "RCP-001",
            downloadUrl: "https://example.com/receipt.pdf",
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )

        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: mockService
        )

        await viewModel.generateReceipt()

        if case .receiptLoaded(let receipt) = viewModel.state {
            #expect(receipt.receiptNumber == "RCP-001")
        } else {
            Issue.record("Expected receiptLoaded state")
        }
    }

    @Test("Error state after failed generation")
    @MainActor
    func errorStateAfterFailedGeneration() async {
        let mockService = MockPaymentService()
        mockService.shouldSucceed = false

        let viewModel = PaymentResultViewModel(
            paymentId: "test",
            isSuccess: true,
            paymentService: mockService
        )

        await viewModel.generateReceipt()

        if case .error = viewModel.state {
            // Correct
        } else {
            Issue.record("Expected error state")
        }
    }

    // MARK: - Preview Helpers

    @Test("Preview helpers create valid view models")
    func previewHelpers() {
        let success = PaymentResultViewModel.previewSuccess
        #expect(success.isSuccess == true)
        #expect(success.paymentId == "test-payment-123")

        let failure = PaymentResultViewModel.previewFailure
        #expect(failure.isSuccess == false)
        #expect(failure.paymentId == "test-payment-123")

        let withReceipt = PaymentResultViewModel.previewWithReceipt
        #expect(withReceipt.receiptData != nil)
    }
}
