/// PaymentMethodsViewModelTests.swift
/// Flent Secured v2 - Payment Methods ViewModel Tests
///
/// Tests for payment method selection and user status-based availability.
/// Critical for payment flow and feature gating.

import XCTest
@testable import Flent

@MainActor
final class PaymentMethodsViewModelTests: XCTestCase {

    // MARK: - Properties

    private var sut: PaymentMethodsViewModel!
    private var mockPaymentService: MockPaymentService!

    private let testTenancyId = "test-tenancy-123"
    private let testRentMonth = "2026-01"
    private let testRentAmountPaise = 2500000  // Rs. 25,000

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockPaymentService = MockPaymentService()
        mockPaymentService.simulatedDelay = 0

        sut = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: testRentMonth,
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 50000,
            userStatus: .complete,
            paymentService: mockPaymentService
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockPaymentService = nil
        try await super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitialState() {
        XCTAssertEqual(sut.state, .idle)
        XCTAssertNil(sut.selectedMethod)
        XCTAssertNil(sut.selectedUPIApp)
        XCTAssertEqual(sut.rentAmountPaise, testRentAmountPaise)
        XCTAssertTrue(sut.applyCashback)
        XCTAssertFalse(sut.isInitiating)
        XCTAssertNil(sut.errorMessage)
    }

    // MARK: - Available Methods Tests

    func testAvailableMethods_COMPLETEUser() {
        // Given - COMPLETE user (already set in setUp)

        // Then - All methods available
        let methods = sut.availableMethods
        XCTAssertTrue(methods.contains(.upiIntent))
        XCTAssertTrue(methods.contains(.upiCollect))
        XCTAssertTrue(methods.contains(.netBanking))
        XCTAssertTrue(methods.contains(.debitCard))
        XCTAssertTrue(methods.contains(.creditCard))
        XCTAssertTrue(methods.contains(.wallet))
    }

    func testAvailableMethods_QUALIFIEDUser() {
        // Given
        let vm = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: testRentMonth,
            rentAmountPaise: testRentAmountPaise,
            userStatus: .qualified,
            paymentService: mockPaymentService
        )

        // Then - Only non-credit-card methods
        let methods = vm.availableMethods
        XCTAssertTrue(methods.contains(.upiIntent))
        XCTAssertTrue(methods.contains(.upiCollect))
        XCTAssertTrue(methods.contains(.netBanking))
        XCTAssertTrue(methods.contains(.debitCard))
        XCTAssertFalse(methods.contains(.creditCard))  // Not available
        XCTAssertFalse(methods.contains(.wallet))  // Not available
    }

    func testCanUseCreditCard_COMPLETEUser() {
        XCTAssertTrue(sut.canUseCreditCard)
    }

    func testCanUseCreditCard_QUALIFIEDUser() {
        // Given
        let vm = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: testRentMonth,
            rentAmountPaise: testRentAmountPaise,
            userStatus: .qualified,
            paymentService: mockPaymentService
        )

        // Then
        XCTAssertFalse(vm.canUseCreditCard)
    }

    func testCanUseWallet_COMPLETEUser() {
        XCTAssertTrue(sut.canUseWallet)
    }

    func testCanUseWallet_QUALIFIEDUser() {
        // Given
        let vm = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: testRentMonth,
            rentAmountPaise: testRentAmountPaise,
            userStatus: .qualified,
            paymentService: mockPaymentService
        )

        // Then
        XCTAssertFalse(vm.canUseWallet)
    }

    // MARK: - Method Selection Tests

    func testSelectMethod_UPI() {
        // When
        sut.selectMethod(.upiIntent)

        // Then
        XCTAssertEqual(sut.selectedMethod, .upiIntent)
        XCTAssertNil(sut.selectedUPIApp)
        XCTAssertEqual(sut.pgFeePaise, 0)  // UPI has no fee
    }

    func testSelectMethod_CreditCard() {
        // When
        sut.selectMethod(.creditCard)

        // Then
        XCTAssertEqual(sut.selectedMethod, .creditCard)
        XCTAssertGreaterThan(sut.pgFeePaise, 0)  // Credit card has fees
    }

    func testSelectMethod_NetBanking() {
        // When
        sut.selectMethod(.netBanking)

        // Then
        XCTAssertEqual(sut.selectedMethod, .netBanking)
        XCTAssertEqual(sut.pgFeePaise, 0)  // Net banking has no fee
    }

    func testSelectUPIApp() {
        // When
        sut.selectUPIApp(.gpay)

        // Then
        XCTAssertEqual(sut.selectedMethod, .upiIntent)
        XCTAssertEqual(sut.selectedUPIApp, .gpay)
        XCTAssertEqual(sut.pgFeePaise, 0)
    }

    // MARK: - PG Fee Calculation Tests

    func testPGFee_UPI() {
        sut.selectMethod(.upiIntent)
        XCTAssertEqual(sut.pgFeePaise, 0)
    }

    func testPGFee_NetBanking() {
        sut.selectMethod(.netBanking)
        XCTAssertEqual(sut.pgFeePaise, 0)
    }

    func testPGFee_DebitCard() {
        // When
        sut.selectMethod(.debitCard)

        // Then - 0.9% fee
        let expectedFee = Int(Double(testRentAmountPaise) * 0.009)
        XCTAssertEqual(sut.pgFeePaise, expectedFee)
    }

    func testPGFee_CreditCard() {
        // When
        sut.selectMethod(.creditCard)

        // Then - 1.8% fee
        let expectedFee = Int(Double(testRentAmountPaise) * 0.018)
        XCTAssertEqual(sut.pgFeePaise, expectedFee)
    }

    func testPGFee_Wallet() {
        // When
        sut.selectMethod(.wallet)

        // Then - 1.5% fee
        let expectedFee = Int(Double(testRentAmountPaise) * 0.015)
        XCTAssertEqual(sut.pgFeePaise, expectedFee)
    }

    // MARK: - Amount Calculation Tests

    func testRentAmount() {
        XCTAssertEqual(sut.rentAmount, 25000.0)
    }

    func testTotalAmount_WithCashback() {
        // Given
        sut.applyCashback = true
        sut.selectMethod(.upiIntent)  // No PG fee

        // Then
        // Total = Rent + PG Fee - Cashback = 25000 + 0 - 500 = 24500
        XCTAssertEqual(sut.totalAmount, 24500.0)
    }

    func testTotalAmount_WithoutCashback() {
        // Given
        sut.applyCashback = false
        sut.selectMethod(.upiIntent)

        // Then
        XCTAssertEqual(sut.totalAmount, 25000.0)
    }

    func testTotalAmount_WithPGFee() {
        // Given
        sut.applyCashback = true
        sut.selectMethod(.creditCard)

        // Then
        // Rent = 25000, Fee = 450 (1.8%), Cashback = 500
        // Total = 25000 + 450 - 500 = 24950
        XCTAssertEqual(sut.totalAmount, 24950.0)
    }

    func testCashbackToApply() {
        sut.applyCashback = true
        XCTAssertEqual(sut.cashbackToApply, 500.0)

        sut.applyCashback = false
        XCTAssertEqual(sut.cashbackToApply, 0.0)
    }

    // MARK: - Formatted Properties Tests

    func testFormattedRentAmount() {
        XCTAssertTrue(sut.formattedRentAmount.contains("25,000"))
    }

    func testFormattedTotalAmount() {
        sut.selectMethod(.upiIntent)
        XCTAssertTrue(sut.formattedTotalAmount.contains("24,500"))
    }

    func testFormattedCashback() {
        sut.applyCashback = true
        XCTAssertTrue(sut.formattedCashback.contains("500"))
    }

    func testEstimatedCashbackFormatted() {
        // 1% of 25000 = 250
        XCTAssertTrue(sut.estimatedCashbackFormatted.contains("250"))
    }

    // MARK: - Payment Initiation Tests

    func testInitiatePayment_Success() async {
        // Given
        sut.selectMethod(.upiIntent)
        mockPaymentService.shouldSucceed = true

        // When
        let result = await sut.initiatePayment()

        // Then
        XCTAssertNotNil(result)
        XCTAssertTrue(mockPaymentService.initiatePaymentCalled)
        XCTAssertEqual(mockPaymentService.lastTenancyId, testTenancyId)
        XCTAssertEqual(mockPaymentService.lastPaymentMethod, .upiIntent)
        XCTAssertEqual(mockPaymentService.lastRentMonth, testRentMonth)
        XCTAssertTrue(mockPaymentService.lastApplyCashback ?? false)

        if case .initiated(let initiation) = sut.state {
            XCTAssertEqual(sut.paymentInitiation, initiation)
        } else {
            XCTFail("Expected initiated state")
        }
    }

    func testInitiatePayment_NoMethodSelected() async {
        // Given - No method selected

        // When
        let result = await sut.initiatePayment()

        // Then
        XCTAssertNil(result)
        XCTAssertFalse(mockPaymentService.initiatePaymentCalled)
        XCTAssertNotNil(sut.errorMessage)
    }

    func testInitiatePayment_CreditCard_QUALIFIEDUser() async {
        // Given
        let vm = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: testRentMonth,
            rentAmountPaise: testRentAmountPaise,
            userStatus: .qualified,
            paymentService: mockPaymentService
        )
        vm.selectedMethod = .creditCard

        // When
        let result = await vm.initiatePayment()

        // Then
        XCTAssertNil(result)
        XCTAssertFalse(mockPaymentService.initiatePaymentCalled)
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertTrue(vm.errorMessage!.contains("Complete 3 on-time payments"))
    }

    func testInitiatePayment_Failure() async {
        // Given
        sut.selectMethod(.upiIntent)
        mockPaymentService.shouldSucceed = false
        mockPaymentService.errorToThrow = .serverError("Payment initiation failed")

        // When
        let result = await sut.initiatePayment()

        // Then
        XCTAssertNil(result)
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertNotNil(sut.currentError)
    }

    func testInitiatePayment_SetsInitiatingState() async {
        // Given
        sut.selectMethod(.upiIntent)
        mockPaymentService.simulatedDelay = 0.5

        // When
        let task = Task {
            await sut.initiatePayment()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)

        // Then
        XCTAssertTrue(sut.isInitiating)
        XCTAssertFalse(sut.canInitiate)

        _ = await task.value
    }

    // MARK: - Error Handling Tests

    func testClearError() async {
        // Given - Trigger error via API
        _ = await sut.initiatePayment()  // No method selected causes error

        XCTAssertNotNil(sut.errorMessage)

        // When
        sut.clearError()

        // Then
        XCTAssertEqual(sut.state, .idle)
        XCTAssertNil(sut.currentError)
        XCTAssertNil(sut.errorMessage)
    }

    func testCanRetry_RetryableError() async {
        // Given - Trigger a retryable error via API
        sut.selectMethod(.upiIntent)
        mockPaymentService.shouldSucceed = false
        mockPaymentService.errorToThrow = .serverError("Server unavailable")

        _ = await sut.initiatePayment()

        // Then
        XCTAssertTrue(sut.canRetry)
    }

    func testCanRetry_NonRetryableError() async {
        // Given - Trigger a non-retryable error via API
        sut.selectMethod(.upiIntent)
        mockPaymentService.shouldSucceed = false
        mockPaymentService.errorToThrow = .paymentInProgress  // Non-retryable error

        _ = await sut.initiatePayment()

        // Then
        XCTAssertFalse(sut.canRetry)
    }

    func testRetryPayment_WhenCanRetry() async {
        // Given - First trigger error
        sut.selectMethod(.upiIntent)
        mockPaymentService.shouldSucceed = false
        mockPaymentService.errorToThrow = .serverError("Server unavailable")
        _ = await sut.initiatePayment()

        XCTAssertTrue(sut.canRetry)

        // Now make it succeed on retry
        mockPaymentService.shouldSucceed = true
        mockPaymentService.errorToThrow = nil

        // When
        let result = await sut.retryPayment()

        // Then
        XCTAssertNotNil(result)
    }

    func testRetryPayment_WhenCannotRetry() async {
        // Given - Trigger non-retryable error
        sut.selectMethod(.upiIntent)
        mockPaymentService.shouldSucceed = false
        mockPaymentService.errorToThrow = .paymentInProgress  // Non-retryable error
        _ = await sut.initiatePayment()

        XCTAssertFalse(sut.canRetry)

        // When
        let result = await sut.retryPayment()

        // Then
        XCTAssertNil(result)
    }

    // MARK: - Computed Properties Tests

    func testCanInitiate_MethodSelected() {
        sut.selectedMethod = .upiIntent
        XCTAssertTrue(sut.canInitiate)
    }

    func testCanInitiate_NoMethodSelected() {
        XCTAssertFalse(sut.canInitiate)
    }

    func testCanInitiate_WhileInitiating() async {
        // Given
        sut.selectMethod(.upiIntent)
        mockPaymentService.simulatedDelay = 1.0  // Long delay to stay in initiating state

        // When - Start initiation in background
        let task = Task {
            await sut.initiatePayment()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)  // Wait for state change

        // Then
        XCTAssertTrue(sut.isInitiating)
        XCTAssertFalse(sut.canInitiate)

        task.cancel()
    }

    // MARK: - Edge Cases

    func testZeroCashbackAvailable() {
        // Given
        let vm = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: testRentMonth,
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 0,
            userStatus: .complete,
            paymentService: mockPaymentService
        )
        vm.selectMethod(.upiIntent)

        // Then
        XCTAssertEqual(vm.cashbackToApply, 0)
        XCTAssertEqual(vm.totalAmount, 25000.0)
    }

    func testCashbackExceedsRent() {
        // Given - More cashback than rent
        let vm = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: testRentMonth,
            rentAmountPaise: 100000,  // Rs. 1,000
            cashbackAvailablePaise: 500000,  // Rs. 5,000
            userStatus: .complete,
            paymentService: mockPaymentService
        )
        vm.selectMethod(.upiIntent)

        // Then - Cashback capped at rent amount
        XCTAssertEqual(vm.cashbackToApply, 1000.0)
        XCTAssertEqual(vm.totalAmount, 0.0)
    }

    func testMethodSelectionClearsUPIApp() {
        // Given
        sut.selectUPIApp(.gpay)
        XCTAssertEqual(sut.selectedUPIApp, .gpay)

        // When - Select non-UPI method
        sut.selectMethod(.netBanking)

        // Then
        XCTAssertNil(sut.selectedUPIApp)
    }
}
