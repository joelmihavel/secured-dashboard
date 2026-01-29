/// HomeViewModelTests.swift
/// Flent Secured v2 - Home ViewModel Tests
///
/// Comprehensive tests for home screen states, dashboard loading, and computed properties.
/// Critical for user experience and payment flow initiation.

import XCTest
@testable import Flent

@MainActor
final class HomeViewModelTests: XCTestCase {

    // MARK: - Properties

    private var sut: HomeViewModel!
    private var mockUserService: MockUserService!

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockUserService = MockUserService()
        mockUserService.simulatedDelay = 0
        sut = HomeViewModel(userService: mockUserService)
    }

    override func tearDown() async throws {
        sut = nil
        mockUserService = nil
        try await super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitialState() {
        XCTAssertEqual(sut.state, .idle)
        XCTAssertNil(sut.dashboardData)
        XCTAssertFalse(sut.isRefreshing)
        XCTAssertFalse(sut.realtimeSubscriptionActive)
        XCTAssertEqual(sut.landlordInvitationStatus, .notSent)
    }

    // MARK: - Dashboard Loading Tests

    func testLoadDashboard_Success() async {
        // Given
        let mockDashboard = MockUserService.createMockDashboard()
        mockUserService.mockDashboard = mockDashboard
        mockUserService.shouldSucceed = true

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertTrue(mockUserService.getDashboardDataCalled)
        XCTAssertNotNil(sut.dashboardData)

        if case .loaded(let homeState) = sut.state {
            XCTAssertNotNil(homeState)
        } else {
            XCTFail("Expected loaded state")
        }
    }

    func testLoadDashboard_Failure() async {
        // Given
        mockUserService.shouldSucceed = false
        mockUserService.errorToThrow = .serverError("Server unavailable")

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertTrue(mockUserService.getDashboardDataCalled)

        if case .error(let message) = sut.state {
            XCTAssertEqual(message, "Server unavailable")
        } else {
            XCTFail("Expected error state")
        }
    }

    func testLoadDashboard_SetsLoadingState() async {
        // Given
        mockUserService.simulatedDelay = 0.5

        // When
        let task = Task {
            await sut.loadDashboard()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)

        // Then
        XCTAssertTrue(sut.isLoading)

        await task.value
    }

    func testRefresh() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await sut.refresh()

        // Then
        XCTAssertTrue(mockUserService.getDashboardDataCalled)
        XCTAssertFalse(sut.isRefreshing)
    }

    // MARK: - Home State Determination Tests

    func testHomeState_ZeroState_NoTenancy() async {
        // Given
        let dashboard = MockUserService.createMockDashboard(hasTenancy: false)
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.homeState, .zeroState)
    }

    func testHomeState_SetupPayment_TenancyNotFullyVerified() async {
        // Given - Tenancy exists but not fully verified, no UPI set up
        // Expected: setupPayment (need to add payment method)
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(status: .qualified),
            tenancy: MockUserService.createMockTenancy(
                bankVerified: true,
                utilityVerified: false,
                landlordApproved: false
            ),
            upcomingPayment: nil,
            cashback: CashbackData(
                availableBalancePaise: 0,
                pendingBalancePaise: 0,
                totalEarnedPaise: 0,
                totalUsedPaise: 0
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then - setupPayment because tenancy exists but no UPI set up
        XCTAssertEqual(sut.homeState, .setupPayment)
    }

    func testHomeState_ActiveQualified() async {
        // Given
        let dashboard = MockUserService.createMockDashboard(userStatus: .qualified, daysUntilDue: 5)
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.homeState, .activeQualified)
    }

    func testHomeState_ActiveComplete() async {
        // Given
        let dashboard = MockUserService.createMockDashboard(userStatus: .complete, daysUntilDue: 5)
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.homeState, .activeComplete)
    }

    func testHomeState_LatePayment_AfterCashbackDeadline() async {
        // Given - After 7th, no cashback but not overdue
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(status: .complete),
            tenancy: MockUserService.createMockTenancy(),
            upcomingPayment: UpcomingPaymentData(
                dueDate: ISO8601DateFormatter().string(from: Date().addingTimeInterval(86400 * 10)),
                amountPaise: 4000000,
                daysUntilDue: 10,
                isOverdue: false,
                cashbackEligible: false  // Past 7th, no cashback
            ),
            cashback: CashbackData(
                availableBalancePaise: 0,
                pendingBalancePaise: 0,
                totalEarnedPaise: 0,
                totalUsedPaise: 0
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.homeState, .latePayment)
    }

    func testHomeState_MissedPayment_Overdue() async {
        // Given
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(status: .complete),
            tenancy: MockUserService.createMockTenancy(),
            upcomingPayment: UpcomingPaymentData(
                dueDate: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-86400 * 5)),
                amountPaise: 4000000,
                daysUntilDue: -5,
                isOverdue: true,
                cashbackEligible: false
            ),
            cashback: CashbackData(
                availableBalancePaise: 0,
                pendingBalancePaise: 0,
                totalEarnedPaise: 0,
                totalUsedPaise: 0
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.homeState, .missedPayment)
    }

    // MARK: - Computed Properties Tests

    func testFirstName_WithName() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.firstName, "Amit")
    }

    func testFirstName_NoName() async {
        // Given
        let dashboard = DashboardData(
            user: UserProfileData(
                id: "test",
                phone: "+919876543210",
                firstName: nil,
                lastName: nil,
                email: nil,
                role: nil,
                isRoleLocked: nil,
                userStatus: "complete",
                kycStatus: nil,
                createdAt: nil
            ),
            tenancy: nil,
            upcomingPayment: nil,
            cashback: CashbackData(
                availableBalancePaise: 0,
                pendingBalancePaise: 0,
                totalEarnedPaise: 0,
                totalUsedPaise: 0
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.firstName, "there")
    }

    func testRentAmount() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertTrue(sut.rentAmount.contains("40,000"))
    }

    func testRentAmount_NoTenancy() {
        XCTAssertTrue(sut.rentAmount.contains("0"))
    }

    func testCashbackAvailable() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertTrue(sut.hasCashback)
        XCTAssertTrue(sut.cashbackAvailable.contains("500"))
    }

    func testCashbackAvailable_NoCashback() async {
        // Given
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(),
            tenancy: MockUserService.createMockTenancy(),
            upcomingPayment: nil,
            cashback: CashbackData(
                availableBalancePaise: 0,
                pendingBalancePaise: 0,
                totalEarnedPaise: 0,
                totalUsedPaise: 0
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertFalse(sut.hasCashback)
    }

    func testDaysUntilDue() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard(daysUntilDue: 5)

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.daysUntilDue, 5)
    }

    func testDaysUntilDue_NoUpcomingPayment() {
        XCTAssertEqual(sut.daysUntilDue, 0)
    }

    // MARK: - Due In Text Tests

    func testDueInText_DueToday() async {
        // Given
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(),
            tenancy: MockUserService.createMockTenancy(),
            upcomingPayment: UpcomingPaymentData(
                dueDate: ISO8601DateFormatter().string(from: Date()),
                amountPaise: 4000000,
                daysUntilDue: 0,
                isOverdue: false,
                cashbackEligible: true
            ),
            cashback: CashbackData(
                availableBalancePaise: 0,
                pendingBalancePaise: 0,
                totalEarnedPaise: 0,
                totalUsedPaise: 0
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.dueInText, "Due today")
    }

    func testDueInText_DueTomorrow() async {
        // Given
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(),
            tenancy: MockUserService.createMockTenancy(),
            upcomingPayment: UpcomingPaymentData(
                dueDate: ISO8601DateFormatter().string(from: Date().addingTimeInterval(86400)),
                amountPaise: 4000000,
                daysUntilDue: 1,
                isOverdue: false,
                cashbackEligible: true
            ),
            cashback: CashbackData(
                availableBalancePaise: 0,
                pendingBalancePaise: 0,
                totalEarnedPaise: 0,
                totalUsedPaise: 0
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.dueInText, "Due tomorrow")
    }

    func testDueInText_DueInDays() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard(daysUntilDue: 5)

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.dueInText, "Due in 5 days")
    }

    func testDueInText_Overdue() async {
        // Given
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(),
            tenancy: MockUserService.createMockTenancy(),
            upcomingPayment: UpcomingPaymentData(
                dueDate: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-86400 * 3)),
                amountPaise: 4000000,
                daysUntilDue: -3,
                isOverdue: true,
                cashbackEligible: false
            ),
            cashback: CashbackData(
                availableBalancePaise: 0,
                pendingBalancePaise: 0,
                totalEarnedPaise: 0,
                totalUsedPaise: 0
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.dueInText, "Overdue by 3 days")
    }

    // MARK: - Setup Progress Tests

    func testSetupProgress() async {
        // Given
        let tenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false
        )
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(status: .qualified),
            tenancy: tenancy,
            upcomingPayment: nil,
            cashback: CashbackData(
                availableBalancePaise: 0,
                pendingBalancePaise: 0,
                totalEarnedPaise: 0,
                totalUsedPaise: 0
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.setupProgress, 2)
        XCTAssertTrue(sut.bankDetailsComplete)
        XCTAssertTrue(sut.addressProofComplete)
        XCTAssertFalse(sut.landlordInvited)
    }

    // MARK: - Landlord Invitation Status Tests

    func testLandlordInvitationStatus_Accepted() async {
        // Given
        let tenancy = MockUserService.createMockTenancy(landlordApproved: true)
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(),
            tenancy: tenancy,
            upcomingPayment: nil,
            cashback: CashbackData(
                availableBalancePaise: 0,
                pendingBalancePaise: 0,
                totalEarnedPaise: 0,
                totalUsedPaise: 0
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.landlordInvitationStatus, .accepted)
    }

    func testLandlordInvitationStatus_Pending() async {
        // Given
        let tenancy = MockUserService.createMockTenancy(landlordApproved: false)
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(),
            tenancy: tenancy,
            upcomingPayment: nil,
            cashback: CashbackData(
                availableBalancePaise: 0,
                pendingBalancePaise: 0,
                totalEarnedPaise: 0,
                totalUsedPaise: 0
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.landlordInvitationStatus, .pending)
    }

    // MARK: - Currency Formatting Tests

    func testFormatCurrency() {
        XCTAssertTrue(sut.formatCurrency(25000).contains("25,000"))
        XCTAssertTrue(sut.formatCurrency(100).contains("100"))
        XCTAssertTrue(sut.formatCurrency(0).contains("0"))
    }

    // MARK: - Realtime Subscription Tests

    func testStartRealtimeSubscription() {
        // When
        sut.startRealtimeSubscription()

        // Then
        XCTAssertTrue(sut.realtimeSubscriptionActive)
    }

    func testStopRealtimeSubscription() {
        // Given
        sut.startRealtimeSubscription()

        // When
        sut.stopRealtimeSubscription()

        // Then
        XCTAssertFalse(sut.realtimeSubscriptionActive)
    }

    func testStartRealtimeSubscription_AlreadyActive() {
        // Given
        sut.startRealtimeSubscription()
        XCTAssertTrue(sut.realtimeSubscriptionActive)

        // When - Call again
        sut.startRealtimeSubscription()

        // Then - Should still be active (no crash)
        XCTAssertTrue(sut.realtimeSubscriptionActive)
    }

    // MARK: - Property Details Tests

    func testPropertyName() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertTrue(sut.propertyName.contains("Prestige"))
    }

    func testPropertyAddress() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertTrue(sut.propertyAddress.contains("Bangalore"))
    }

    func testRentDueDay() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.rentDueDay, 5)
    }

    func testRentDueOrdinal() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertEqual(sut.rentDueOrdinal, "th")  // 5th
    }

    // MARK: - Error Handling Tests

    func testLoadDashboard_NetworkError() async {
        // Given
        mockUserService.shouldSucceed = false
        mockUserService.errorToThrow = .networkError(URLError(.notConnectedToInternet))

        // When
        await sut.loadDashboard()

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    func testLoadDashboard_UserNotFound() async {
        // Given
        mockUserService.shouldSucceed = false
        mockUserService.errorToThrow = .userNotFound

        // When
        await sut.loadDashboard()

        // Then
        if case .error(let message) = sut.state {
            XCTAssertEqual(message, "User profile not found")
        } else {
            XCTFail("Expected error state")
        }
    }
}
