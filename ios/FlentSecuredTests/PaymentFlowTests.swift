/// PaymentFlowTests.swift
/// Flent Secured v2 - Payment Flow Tests
///
/// Comprehensive tests for the complete payment flow.
/// Tests transaction view, method selection, processing, and results.
/// Critical for fintech payment accuracy.

import XCTest
@testable import Flent

@MainActor
final class PaymentFlowTests: XCTestCase {

    // MARK: - Properties

    private var mockPaymentService: MockPaymentService!
    private var mockUserService: MockUserService!

    private let testTenancyId = "test-tenancy-123"
    private let testRentAmountPaise = 4000000  // Rs. 40,000

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockPaymentService = MockPaymentService()
        mockPaymentService.simulatedDelay = 0
        mockUserService = MockUserService()
        mockUserService.simulatedDelay = 0
    }

    override func tearDown() async throws {
        mockPaymentService = nil
        mockUserService = nil
        try await super.tearDown()
    }

    // MARK: - Payment Transaction View Tests

    func testPaymentTransaction_DisplaysCorrectRentAmount() {
        // Given
        let viewModel = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertTrue(viewModel.formattedRentAmount.contains("40,000"))
    }

    func testPaymentTransaction_CashbackAutoApplied() {
        // Given
        let viewModel = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 50000,  // Rs. 500
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertEqual(viewModel.cashbackAppliedPaise, 50000)
        XCTAssertTrue(viewModel.formattedCashbackApplied.contains("500"))
    }

    func testPaymentTransaction_TotalWithCashback() {
        // Given
        let viewModel = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 50000,
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        // Total = 40000 - 500 = 39500
        XCTAssertEqual(viewModel.totalAmountPaise, 3950000)
    }

    func testPaymentTransaction_LatePaymentWarning() {
        // Given - Payment after 7th, no cashback
        let viewModel = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            dueDate: Date().addingTimeInterval(86400 * 10),  // 10 days ahead
            isCashbackEligible: false,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertTrue(viewModel.isLatePayment)
        XCTAssertFalse(viewModel.isOverdue)
    }

    func testPaymentTransaction_OverdueWarning() {
        // Given
        let viewModel = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            dueDate: Date().addingTimeInterval(-86400),  // Yesterday
            isCashbackEligible: false,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertTrue(viewModel.isOverdue)
    }

    func testPaymentTransaction_EstimatedCashback() {
        // Given
        let viewModel = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then - 1% of 40000 = 400
        XCTAssertEqual(viewModel.estimatedCashbackPaise, 40000)
    }

    // MARK: - Payment Methods Selection Tests

    func testPaymentMethods_QUALIFIEDUser_UPIAndNetBankingOnly() {
        // Given
        let viewModel = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: "2026-01",
            rentAmountPaise: testRentAmountPaise,
            userStatus: .qualified,
            paymentService: mockPaymentService
        )

        // Then
        let methods = viewModel.availableMethods
        XCTAssertTrue(methods.contains(.upiIntent))
        XCTAssertTrue(methods.contains(.netBanking))
        XCTAssertFalse(methods.contains(.creditCard))
        XCTAssertFalse(methods.contains(.wallet))
    }

    func testPaymentMethods_COMPLETEUser_AllMethods() {
        // Given
        let viewModel = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: "2026-01",
            rentAmountPaise: testRentAmountPaise,
            userStatus: .complete,
            paymentService: mockPaymentService
        )

        // Then
        let methods = viewModel.availableMethods
        XCTAssertTrue(methods.contains(.upiIntent))
        XCTAssertTrue(methods.contains(.netBanking))
        XCTAssertTrue(methods.contains(.creditCard))
        XCTAssertTrue(methods.contains(.wallet))
    }

    func testPaymentMethods_SelectUPI_NoPGFee() {
        // Given
        let viewModel = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: "2026-01",
            rentAmountPaise: testRentAmountPaise,
            userStatus: .complete,
            paymentService: mockPaymentService
        )

        // When
        viewModel.selectMethod(.upiIntent)

        // Then
        XCTAssertEqual(viewModel.pgFeePaise, 0)
    }

    func testPaymentMethods_SelectCreditCard_HasPGFee() {
        // Given
        let viewModel = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: "2026-01",
            rentAmountPaise: testRentAmountPaise,
            userStatus: .complete,
            paymentService: mockPaymentService
        )

        // When
        viewModel.selectMethod(.creditCard)

        // Then - 1.8% of 40000 = 720
        let expectedFee = Int(Double(testRentAmountPaise) * 0.018)
        XCTAssertEqual(viewModel.pgFeePaise, expectedFee)
    }

    // MARK: - Payment Initiation Tests

    func testPaymentMethods_InitiatePayment_Success() async {
        // Given
        let viewModel = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: "2026-01",
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 50000,
            userStatus: .complete,
            paymentService: mockPaymentService
        )
        viewModel.selectMethod(.upiIntent)
        mockPaymentService.shouldSucceed = true

        // When
        let initiation = await viewModel.initiatePayment()

        // Then
        XCTAssertNotNil(initiation)
        XCTAssertTrue(mockPaymentService.initiatePaymentCalled)
        XCTAssertEqual(mockPaymentService.lastTenancyId, testTenancyId)
        XCTAssertEqual(mockPaymentService.lastPaymentMethod, .upiIntent)
        XCTAssertTrue(mockPaymentService.lastApplyCashback ?? false)
    }

    func testPaymentMethods_InitiatePayment_CreditCardBlockedForQUALIFIED() async {
        // Given
        let viewModel = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: "2026-01",
            rentAmountPaise: testRentAmountPaise,
            userStatus: .qualified,
            paymentService: mockPaymentService
        )
        viewModel.selectedMethod = .creditCard  // Force select

        // When
        let initiation = await viewModel.initiatePayment()

        // Then
        XCTAssertNil(initiation)
        XCTAssertFalse(mockPaymentService.initiatePaymentCalled)
        XCTAssertNotNil(viewModel.errorMessage)
    }

    func testPaymentMethods_InitiatePayment_NoMethodSelected() async {
        // Given
        let viewModel = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: "2026-01",
            rentAmountPaise: testRentAmountPaise,
            userStatus: .complete,
            paymentService: mockPaymentService
        )
        // No method selected

        // When
        let initiation = await viewModel.initiatePayment()

        // Then
        XCTAssertNil(initiation)
        XCTAssertNotNil(viewModel.errorMessage)
    }

    // MARK: - Payment Result Tests

    func testPaymentResult_Success_CanGenerateReceipt() async {
        // Given
        let viewModel = PaymentResultViewModel(
            paymentId: "test-payment-123",
            isSuccess: true,
            paymentService: mockPaymentService
        )

        // When
        await viewModel.generateReceipt()

        // Then
        XCTAssertTrue(mockPaymentService.generateReceiptCalled)
        XCTAssertNotNil(viewModel.receiptData)
    }

    func testPaymentResult_Failure_NoReceipt() async {
        // Given
        let viewModel = PaymentResultViewModel(
            paymentId: "test-payment-123",
            isSuccess: false,
            paymentService: mockPaymentService
        )

        // When
        await viewModel.generateReceipt()

        // Then
        XCTAssertFalse(mockPaymentService.generateReceiptCalled)
        XCTAssertNil(viewModel.receiptData)
    }

    func testPaymentResult_Refunded_TreatedAsFailure() {
        // Given
        let viewModel = PaymentResultViewModel(
            paymentId: "test-payment-123",
            isSuccess: true,
            isRefunded: true,
            paymentService: mockPaymentService
        )

        // Then
        XCTAssertFalse(viewModel.isSuccess)
        XCTAssertTrue(viewModel.isRefunded)
    }

    // MARK: - Complete Payment Flow Tests

    func testCompletePaymentFlow_UPI_Success() async {
        // Step 1: View transaction details
        let transactionVM = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 50000,
            dueDate: Date().addingTimeInterval(86400 * 3),
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        XCTAssertTrue(transactionVM.formattedRentAmount.contains("40,000"))
        XCTAssertEqual(transactionVM.cashbackAppliedPaise, 50000)

        // Step 2: Select payment method
        let methodsVM = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: "2026-01",
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 50000,
            userStatus: .complete,
            paymentService: mockPaymentService
        )

        methodsVM.selectUPIApp(.gpay)
        XCTAssertEqual(methodsVM.selectedMethod, .upiIntent)
        XCTAssertEqual(methodsVM.selectedUPIApp, .gpay)

        // Step 3: Initiate payment
        let initiation = await methodsVM.initiatePayment()
        XCTAssertNotNil(initiation)

        // Step 4: Show result
        let resultVM = PaymentResultViewModel(
            paymentId: initiation!.paymentId,
            isSuccess: true,
            paymentService: mockPaymentService
        )

        XCTAssertTrue(resultVM.isSuccess)

        // Step 5: Generate receipt
        await resultVM.generateReceipt()
        XCTAssertNotNil(resultVM.receiptData)
    }

    func testCompletePaymentFlow_CreditCard_COMPLETEUser() async {
        // Step 1: Select credit card (COMPLETE user)
        let methodsVM = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: "2026-01",
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 50000,
            userStatus: .complete,
            paymentService: mockPaymentService
        )

        methodsVM.selectMethod(.creditCard)
        XCTAssertEqual(methodsVM.selectedMethod, .creditCard)
        XCTAssertGreaterThan(methodsVM.pgFeePaise, 0)  // Has PG fee

        // Step 2: Initiate
        let initiation = await methodsVM.initiatePayment()
        XCTAssertNotNil(initiation)
    }

    // MARK: - Payment Error Handling Tests

    func testPaymentFlow_ServerError_CanRetry() async {
        // Given
        let viewModel = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: "2026-01",
            rentAmountPaise: testRentAmountPaise,
            userStatus: .complete,
            paymentService: mockPaymentService
        )
        viewModel.selectMethod(.upiIntent)
        mockPaymentService.shouldSucceed = false
        mockPaymentService.errorToThrow = .serverError("Temporary error")

        // When
        let _ = await viewModel.initiatePayment()

        // Then
        XCTAssertNotNil(viewModel.currentError)
        XCTAssertTrue(viewModel.canRetry)

        // Retry
        mockPaymentService.shouldSucceed = true
        mockPaymentService.errorToThrow = nil
        let retryResult = await viewModel.retryPayment()
        XCTAssertNotNil(retryResult)
    }

    func testPaymentFlow_PaymentAlreadyExists_CannotRetry() async {
        // Given
        let viewModel = PaymentMethodsViewModel(
            tenancyId: testTenancyId,
            rentMonth: "2026-01",
            rentAmountPaise: testRentAmountPaise,
            userStatus: .complete,
            paymentService: mockPaymentService
        )
        viewModel.selectMethod(.upiIntent)
        mockPaymentService.shouldSucceed = false
        mockPaymentService.errorToThrow = .paymentAlreadyExists(month: "2026-01")

        // When
        let _ = await viewModel.initiatePayment()

        // Then - Payment already exists is not retryable
        XCTAssertNotNil(viewModel.currentError)
        XCTAssertFalse(viewModel.canRetry)
    }

    // MARK: - Cashback Toggle Tests

    func testPaymentTransaction_ToggleCashback_Off() {
        // Given
        let viewModel = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 50000,
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )
        XCTAssertEqual(viewModel.cashbackAppliedPaise, 50000)

        // When
        viewModel.toggleCashbackApplication()

        // Then
        XCTAssertEqual(viewModel.cashbackAppliedPaise, 0)
        XCTAssertEqual(viewModel.totalAmountPaise, testRentAmountPaise)
    }

    func testPaymentTransaction_ToggleCashback_On() {
        // Given
        let viewModel = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 50000,
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )
        viewModel.cashbackAppliedPaise = 0  // Turn off

        // When
        viewModel.toggleCashbackApplication()

        // Then
        XCTAssertEqual(viewModel.cashbackAppliedPaise, 50000)
    }
}
