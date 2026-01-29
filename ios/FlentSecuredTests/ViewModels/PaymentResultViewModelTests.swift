/// PaymentResultViewModelTests.swift
/// Flent Secured v2 - Payment Result ViewModel Tests
///
/// Tests for payment result display, success/failure states, and receipt generation.
/// Critical for payment completion flow.

import XCTest
@testable import Flent

@MainActor
final class PaymentResultViewModelTests: XCTestCase {

    // MARK: - Properties

    private var sut: PaymentResultViewModel!
    private var mockPaymentService: MockPaymentService!

    private let testPaymentId = "test-payment-123"

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockPaymentService = MockPaymentService()
        mockPaymentService.simulatedDelay = 0
    }

    override func tearDown() async throws {
        sut = nil
        mockPaymentService = nil
        try await super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitialState_Success() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        XCTAssertEqual(sut.paymentId, testPaymentId)
        XCTAssertTrue(sut.isSuccess)
        XCTAssertFalse(sut.isRefunded)
        XCTAssertEqual(sut.state, .idle)
        XCTAssertNil(sut.paymentDetails)
        XCTAssertNil(sut.receiptData)
    }

    func testInitialState_Failure() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: false,
            paymentService: mockPaymentService
        )

        XCTAssertFalse(sut.isSuccess)
        XCTAssertFalse(sut.isRefunded)
    }

    func testInitialState_Refunded() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            isRefunded: true,
            paymentService: mockPaymentService
        )

        // Refunded overrides success
        XCTAssertFalse(sut.isSuccess)
        XCTAssertTrue(sut.isRefunded)
    }

    // MARK: - Receipt Generation Tests

    func testGenerateReceipt_Success() async {
        // Given
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )
        mockPaymentService.shouldSucceed = true
        mockPaymentService.mockReceipt = ReceiptData(
            paymentId: testPaymentId,
            receiptNumber: "RCP-2026-01-001",
            downloadUrl: "https://flent.app/receipts/test.pdf",
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )

        // When
        await sut.generateReceipt()

        // Then
        XCTAssertTrue(mockPaymentService.generateReceiptCalled)
        XCTAssertNotNil(sut.receiptData)
        XCTAssertEqual(sut.receiptData?.receiptNumber, "RCP-2026-01-001")

        if case .receiptLoaded(let receipt) = sut.state {
            XCTAssertEqual(receipt.paymentId, testPaymentId)
        } else {
            XCTFail("Expected receiptLoaded state")
        }
    }

    func testGenerateReceipt_Failure() async {
        // Given
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )
        mockPaymentService.shouldSucceed = false
        mockPaymentService.errorToThrow = .serverError("Receipt generation failed")

        // When
        await sut.generateReceipt()

        // Then
        XCTAssertTrue(mockPaymentService.generateReceiptCalled)
        XCTAssertNil(sut.receiptData)

        if case .error(let message) = sut.state {
            XCTAssertEqual(message, "Receipt generation failed")
        } else {
            XCTFail("Expected error state")
        }
    }

    func testGenerateReceipt_SkippedForFailure() async {
        // Given - Failed payment
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: false,
            paymentService: mockPaymentService
        )

        // When
        await sut.generateReceipt()

        // Then - Receipt generation should be skipped
        XCTAssertFalse(mockPaymentService.generateReceiptCalled)
        XCTAssertNil(sut.receiptData)
    }

    func testGenerateReceipt_SetsLoadingState() async {
        // Given
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )
        mockPaymentService.simulatedDelay = 0.5

        // When
        let task = Task {
            await sut.generateReceipt()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)

        // Then
        XCTAssertTrue(sut.isLoadingReceipt)

        await task.value
    }

    // MARK: - Computed Properties Tests - Without Payment Details

    func testAmountPaid_NoDetails() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        XCTAssertTrue(sut.amountPaid.contains("0"))
    }

    func testCashbackEarned_NoDetails() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        XCTAssertTrue(sut.cashbackEarned.contains("0"))
    }

    func testCashbackEarned_Failure() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: false,
            paymentService: mockPaymentService
        )

        // No cashback for failed payments
        XCTAssertTrue(sut.cashbackEarned.contains("0"))
    }

    func testPaymentDate_NoDetails() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        // Should return current date formatted
        XCTAssertFalse(sut.paymentDate.isEmpty)
    }

    func testPaymentMonth_NoDetails() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        XCTAssertEqual(sut.paymentMonth, "")
    }

    func testReceiptUrl_NoReceipt() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        XCTAssertNil(sut.receiptUrl)
    }

    func testReceiptUrl_WithReceipt() async {
        // Given
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )
        mockPaymentService.mockReceipt = ReceiptData(
            paymentId: testPaymentId,
            receiptNumber: "RCP-001",
            downloadUrl: "https://flent.app/receipts/test.pdf",
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )

        // When
        await sut.generateReceipt()

        // Then
        XCTAssertNotNil(sut.receiptUrl)
        XCTAssertEqual(sut.receiptUrl?.absoluteString, "https://flent.app/receipts/test.pdf")
    }

    func testFailureMessage() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: false,
            paymentService: mockPaymentService
        )

        XCTAssertTrue(sut.failureMessage.contains("couldn't be processed"))
    }

    // MARK: - Receipt Card Properties Tests

    func testFormattedAmount_NoDetails() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        // Default value when no details
        XCTAssertTrue(sut.formattedAmount.contains("25,000"))
    }

    func testFormattedDate_NoDetails() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        // Should return current date
        XCTAssertFalse(sut.formattedDate.isEmpty)
    }

    func testPaymentMethod_NoDetails() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        XCTAssertEqual(sut.paymentMethod, "UPI")
    }

    func testTransactionId() {
        sut = PaymentResultViewModel(
            paymentId: "test-payment-123456789",
            isSuccess: true,
            paymentService: mockPaymentService
        )

        // Should be first 12 chars uppercased
        XCTAssertEqual(sut.transactionId.count, 12)
        XCTAssertEqual(sut.transactionId, "TEST-PAYMENT")
    }

    func testCashbackAmount_NoDetails() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        // Default 250 rupees (25000 paise)
        XCTAssertEqual(sut.cashbackAmount, 25000)
    }

    func testFormattedCashback() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        // Default cashback 250
        XCTAssertTrue(sut.formattedCashback.contains("250"))
    }

    func testFormattedPayableRent_NoDetails() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        // Default value
        XCTAssertTrue(sut.formattedPayableRent.contains("25,000"))
    }

    // MARK: - Share Receipt Tests

    func testShareReceipt_NoReceipt() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        XCTAssertNil(sut.shareReceipt())
    }

    func testShareReceipt_WithReceipt() async {
        // Given
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )
        mockPaymentService.mockReceipt = ReceiptData(
            paymentId: testPaymentId,
            receiptNumber: "RCP-001",
            downloadUrl: "https://flent.app/receipts/test.pdf",
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )

        // When
        await sut.generateReceipt()

        // Then
        XCTAssertNotNil(sut.shareReceipt())
    }

    // MARK: - Error Handling Tests

    func testErrorMessage_WhenError() async {
        // Given
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )
        mockPaymentService.shouldSucceed = false
        mockPaymentService.errorToThrow = .serverError("Test error")

        // When
        await sut.generateReceipt()

        // Then
        XCTAssertEqual(sut.errorMessage, "Test error")
    }

    func testErrorMessage_NoError() {
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        XCTAssertNil(sut.errorMessage)
    }

    // MARK: - State Transitions Tests

    func testStateTransition_IdleToLoading() async {
        // Given
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )
        mockPaymentService.simulatedDelay = 0.5

        XCTAssertEqual(sut.state, .idle)

        // When
        let task = Task {
            await sut.generateReceipt()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)

        // Then
        XCTAssertEqual(sut.state, .loadingReceipt)

        await task.value
    }

    func testStateTransition_LoadingToReceiptLoaded() async {
        // Given
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        // When
        await sut.generateReceipt()

        // Then
        if case .receiptLoaded = sut.state {
            // Expected
        } else {
            XCTFail("Expected receiptLoaded state")
        }
    }

    func testStateTransition_LoadingToError() async {
        // Given
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )
        mockPaymentService.shouldSucceed = false
        mockPaymentService.errorToThrow = .serverError("Failed")

        // When
        await sut.generateReceipt()

        // Then
        if case .error = sut.state {
            // Expected
        } else {
            XCTFail("Expected error state")
        }
    }

    // MARK: - Edge Cases

    func testMultipleReceiptGenerations() async {
        // Given
        sut = PaymentResultViewModel(
            paymentId: testPaymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        // When - Generate multiple times
        await sut.generateReceipt()
        await sut.generateReceipt()

        // Then - Should not crash, latest result is used
        XCTAssertNotNil(sut.receiptData)
    }

    func testEmptyPaymentId() {
        sut = PaymentResultViewModel(
            paymentId: "",
            isSuccess: true,
            paymentService: mockPaymentService
        )

        XCTAssertEqual(sut.paymentId, "")
        XCTAssertEqual(sut.transactionId, "")
    }
}
