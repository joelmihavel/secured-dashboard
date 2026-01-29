/// PaymentTransactionViewModelTests.swift
/// Flent Secured v2 - Payment Transaction ViewModel Tests
///
/// Comprehensive tests for payment amount calculations, cashback, and due dates.
/// Critical for accurate financial transactions in fintech.

import XCTest
@testable import Flent

@MainActor
final class PaymentTransactionViewModelTests: XCTestCase {

    // MARK: - Properties

    private var sut: PaymentTransactionViewModel!
    private var mockPaymentService: MockPaymentService!
    private var mockUserService: MockUserService!

    private let testTenancyId = "test-tenancy-123"
    private let testRentAmountPaise = 2500000  // Rs. 25,000

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockPaymentService = MockPaymentService()
        mockPaymentService.simulatedDelay = 0
        mockUserService = MockUserService()
        mockUserService.simulatedDelay = 0

        sut = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 50000,  // Rs. 500
            dueDate: Date().addingTimeInterval(86400 * 5),  // 5 days from now
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockPaymentService = nil
        mockUserService = nil
        try await super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitialState() {
        XCTAssertEqual(sut.rentAmountPaise, testRentAmountPaise)
        XCTAssertEqual(sut.platformFeePaise, 0)
        XCTAssertEqual(sut.cashbackAvailablePaise, 50000)
        XCTAssertTrue(sut.isCashbackEligible)
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.errorMessage)
    }

    func testInitialization_AutoAppliesCashback() {
        // Given initial setup with cashback

        // Then - Cashback should be auto-applied (min of available and rent)
        XCTAssertEqual(sut.cashbackAppliedPaise, 50000)  // Rs. 500 applied
    }

    func testInitialization_EstimatedCashback() {
        // Given cashback eligible transaction

        // Then - Estimated cashback is 1% of rent
        let expectedCashback = Int(Double(testRentAmountPaise) * 0.01)
        XCTAssertEqual(sut.estimatedCashbackPaise, expectedCashback)  // Rs. 250
    }

    func testInitialization_NoCashbackWhenNotEligible() {
        // Given
        let vm = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 50000,
            dueDate: Date().addingTimeInterval(-86400),  // Overdue
            isCashbackEligible: false,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertEqual(vm.estimatedCashbackPaise, 0)
    }

    // MARK: - Amount Calculation Tests

    func testTotalAmountPaise_WithCashback() {
        // Given
        sut.cashbackAppliedPaise = 50000  // Rs. 500

        // Then
        // Total = Rent + Platform Fee - Cashback
        // Total = 2500000 + 0 - 50000 = 2450000
        XCTAssertEqual(sut.totalAmountPaise, 2450000)
    }

    func testTotalAmountPaise_WithoutCashback() {
        // Given
        sut.cashbackAppliedPaise = 0

        // Then
        XCTAssertEqual(sut.totalAmountPaise, testRentAmountPaise)
    }

    func testTotalAmountPaise_WithPlatformFee() {
        // Given
        sut.platformFeePaise = 10000  // Rs. 100 fee
        sut.cashbackAppliedPaise = 50000

        // Then
        // Total = 2500000 + 10000 - 50000 = 2460000
        XCTAssertEqual(sut.totalAmountPaise, 2460000)
    }

    // MARK: - Formatted Amount Tests

    func testFormattedRentAmount() {
        XCTAssertTrue(sut.formattedRentAmount.contains("25,000"))
    }

    func testFormattedTotalAmount() {
        sut.cashbackAppliedPaise = 50000
        XCTAssertTrue(sut.formattedTotalAmount.contains("24,500"))
    }

    func testFormattedCashbackApplied() {
        sut.cashbackAppliedPaise = 50000
        XCTAssertTrue(sut.formattedCashbackApplied.contains("500"))
    }

    func testFormattedEstimatedCashback() {
        // 1% of Rs. 25,000 = Rs. 250
        XCTAssertTrue(sut.formattedEstimatedCashback.contains("250"))
    }

    func testFormattedAvailableCashback() {
        XCTAssertTrue(sut.formattedAvailableCashback.contains("500"))
    }

    func testFormattedPlatformFee() {
        sut.platformFeePaise = 10000
        XCTAssertTrue(sut.formattedPlatformFee.contains("100"))
    }

    // MARK: - Due Date Tests

    func testIsOverdue_NotOverdue() {
        // Given - Due date is in the future (5 days)
        XCTAssertFalse(sut.isOverdue)
    }

    func testIsOverdue_Overdue() {
        // Given
        let vm = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            dueDate: Date().addingTimeInterval(-86400),  // Yesterday
            isCashbackEligible: false,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertTrue(vm.isOverdue)
    }

    func testIsLatePayment() {
        // Given - Not cashback eligible but not overdue
        let vm = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            dueDate: Date().addingTimeInterval(86400 * 10),  // 10 days from now
            isCashbackEligible: false,  // Past 7th
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertTrue(vm.isLatePayment)
        XCTAssertFalse(vm.isOverdue)
    }

    func testDueDateFormatted() {
        // Due date should be formatted as "d MMM yyyy"
        XCTAssertFalse(sut.dueDateFormatted.isEmpty)
    }

    func testRentMonthFormatted() {
        // Should return current month like "January 2026"
        XCTAssertFalse(sut.rentMonthFormatted.isEmpty)
        XCTAssertTrue(sut.rentMonthFormatted.contains("20"))  // Contains year
    }

    func testCashbackDeadlineFormatted() {
        // Should be "7 Jan" or similar
        XCTAssertFalse(sut.cashbackDeadlineFormatted.isEmpty)
        XCTAssertTrue(sut.cashbackDeadlineFormatted.contains("7"))
    }

    // MARK: - Due Date Message Tests

    func testDueDateMessage_DueInDays() {
        // Given - Due in 5 days
        XCTAssertTrue(sut.dueDateMessage.contains("Due in"))
        XCTAssertTrue(sut.dueDateMessage.contains("days"))
    }

    func testDueDateMessage_DueToday() {
        // Given
        let vm = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            dueDate: Date(),  // Today
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertEqual(vm.dueDateMessage, "Due today")
    }

    func testDueDateMessage_DueTomorrow() {
        // Given
        let vm = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            dueDate: Date().addingTimeInterval(86400),  // Tomorrow
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertEqual(vm.dueDateMessage, "Due tomorrow")
    }

    func testDueDateMessage_Overdue() {
        // Given
        let vm = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            dueDate: Date().addingTimeInterval(-86400 * 3),  // 3 days ago
            isCashbackEligible: false,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertTrue(vm.dueDateMessage.contains("Overdue"))
        XCTAssertTrue(vm.dueDateMessage.contains("3"))
    }

    // MARK: - Cashback Toggle Tests

    func testToggleCashbackApplication_ToOff() {
        // Given - Cashback is applied
        XCTAssertEqual(sut.cashbackAppliedPaise, 50000)

        // When
        sut.toggleCashbackApplication()

        // Then
        XCTAssertEqual(sut.cashbackAppliedPaise, 0)
    }

    func testToggleCashbackApplication_ToOn() {
        // Given - Cashback is not applied
        sut.cashbackAppliedPaise = 0

        // When
        sut.toggleCashbackApplication()

        // Then
        XCTAssertEqual(sut.cashbackAppliedPaise, 50000)
    }

    func testToggleCashbackApplication_CapsAtRentAmount() {
        // Given - Cashback available exceeds rent
        let vm = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: 100000,  // Rs. 1,000
            cashbackAvailablePaise: 500000,  // Rs. 5,000 available
            dueDate: Date().addingTimeInterval(86400),
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Clear and re-apply
        vm.cashbackAppliedPaise = 0
        vm.toggleCashbackApplication()

        // Then - Should only apply up to rent amount
        XCTAssertEqual(vm.cashbackAppliedPaise, 100000)
    }

    // MARK: - Load Data Tests

    func testLoadData_Success() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(monthlyRent: 3000000)
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await sut.loadData()

        // Then
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.errorMessage)
        XCTAssertTrue(mockUserService.getCurrentTenancyCalled)
        XCTAssertTrue(mockUserService.getDashboardDataCalled)
    }

    func testLoadData_UpdatesRentAmount() async {
        // Given
        let newRentPaise = 3000000  // Rs. 30,000
        mockUserService.mockTenancy = MockUserService.createMockTenancy(monthlyRent: newRentPaise)
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await sut.loadData()

        // Then
        XCTAssertEqual(sut.rentAmountPaise, newRentPaise)
    }

    func testLoadData_Failure() async {
        // Given
        mockUserService.shouldSucceed = false
        mockUserService.errorToThrow = .serverError("Failed to load data")

        // When
        await sut.loadData()

        // Then
        XCTAssertFalse(sut.isLoading)
        XCTAssertNotNil(sut.errorMessage)
    }

    // MARK: - Edge Cases

    func testZeroCashbackAvailable() {
        // Given
        let vm = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            cashbackAvailablePaise: 0,
            dueDate: Date().addingTimeInterval(86400),
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertEqual(vm.cashbackAppliedPaise, 0)
        XCTAssertEqual(vm.totalAmountPaise, testRentAmountPaise)
    }

    func testVeryLargeRentAmount() {
        // Given - Rs. 10 lakh rent
        let largeRent = 100000000  // 10 lakh in paise
        let vm = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: largeRent,
            cashbackAvailablePaise: 100000,
            dueDate: Date().addingTimeInterval(86400),
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertEqual(vm.totalAmountPaise, largeRent - 100000)
        // Estimated cashback = 1% = Rs. 10,000
        XCTAssertEqual(vm.estimatedCashbackPaise, 1000000)
    }

    func testMinimumRentAmount() {
        // Given - Rs. 100 rent (unlikely but valid)
        let minRent = 10000  // 100 rupees in paise
        let vm = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: minRent,
            cashbackAvailablePaise: 50000,  // More than rent
            dueDate: Date().addingTimeInterval(86400),
            isCashbackEligible: true,
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then - Cashback capped at rent amount
        XCTAssertEqual(vm.cashbackAppliedPaise, minRent)
        XCTAssertEqual(vm.totalAmountPaise, 0)  // Fully covered by cashback
    }

    // MARK: - Cashback Eligibility Tests

    func testCashbackEligible_True() {
        XCTAssertTrue(sut.isCashbackEligible)
        XCTAssertGreaterThan(sut.estimatedCashbackPaise, 0)
    }

    func testCashbackEligible_False() {
        // Given
        let vm = PaymentTransactionViewModel(
            tenancyId: testTenancyId,
            rentAmountPaise: testRentAmountPaise,
            dueDate: Date().addingTimeInterval(86400 * 10),
            isCashbackEligible: false,  // Past deadline
            paymentService: mockPaymentService,
            userService: mockUserService
        )

        // Then
        XCTAssertFalse(vm.isCashbackEligible)
        XCTAssertEqual(vm.estimatedCashbackPaise, 0)
    }
}
