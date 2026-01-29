/// HomeScreenTests.swift
/// Flent Secured v2 - Home Screen Tests
///
/// Tests for home screen states, dashboard loading, and user state transitions.
/// Validates all 6 home states and computed properties.

import XCTest
@testable import Flent

@MainActor
final class HomeScreenTests: XCTestCase {

    // MARK: - Properties

    private var mockUserService: MockUserService!

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockUserService = MockUserService()
        mockUserService.simulatedDelay = 0
    }

    override func tearDown() async throws {
        mockUserService = nil
        try await super.tearDown()
    }

    // MARK: - Home State Tests - zeroState

    func testHomeState_ZeroState_NoTenancy() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        mockUserService.mockDashboard = MockUserService.createMockDashboard(hasTenancy: false)

        // When
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.homeState, .zeroState)
    }

    func testHomeState_SetupPayment_IncompleteVerification() async {
        // Given - Tenancy exists but not fully verified, no UPI set up
        let viewModel = HomeViewModel(userService: mockUserService)
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
        await viewModel.loadDashboard()

        // Then - setupPayment because tenancy exists but no UPI set up
        XCTAssertEqual(viewModel.homeState, .setupPayment)
    }

    // MARK: - Home State Tests - activeQualified

    func testHomeState_ActiveQualified_FullyVerifiedQUALIFIEDUser() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(status: .qualified),
            tenancy: MockUserService.createMockTenancy(
                bankVerified: true,
                utilityVerified: true,
                landlordApproved: true
            ),
            upcomingPayment: UpcomingPaymentData(
                dueDate: ISO8601DateFormatter().string(from: Date().addingTimeInterval(86400 * 5)),
                amountPaise: 4000000,
                daysUntilDue: 5,
                isOverdue: false,
                cashbackEligible: true
            ),
            cashback: CashbackData(
                availableBalancePaise: 50000,
                pendingBalancePaise: 0,
                totalEarnedPaise: 100000,
                totalUsedPaise: 50000
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.homeState, .activeQualified)
    }

    // MARK: - Home State Tests - activeComplete

    func testHomeState_ActiveComplete_FullyVerifiedCOMPLETEUser() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(status: .complete),
            tenancy: MockUserService.createMockTenancy(
                bankVerified: true,
                utilityVerified: true,
                landlordApproved: true
            ),
            upcomingPayment: UpcomingPaymentData(
                dueDate: ISO8601DateFormatter().string(from: Date().addingTimeInterval(86400 * 5)),
                amountPaise: 4000000,
                daysUntilDue: 5,
                isOverdue: false,
                cashbackEligible: true
            ),
            cashback: CashbackData(
                availableBalancePaise: 50000,
                pendingBalancePaise: 0,
                totalEarnedPaise: 100000,
                totalUsedPaise: 50000
            ),
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.homeState, .activeComplete)
    }

    // MARK: - Home State Tests - latePayment

    func testHomeState_LatePayment_After7thNotCashbackEligible() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(status: .complete),
            tenancy: MockUserService.createMockTenancy(
                bankVerified: true,
                utilityVerified: true,
                landlordApproved: true
            ),
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
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.homeState, .latePayment)
    }

    // MARK: - Home State Tests - missedPayment

    func testHomeState_MissedPayment_Overdue() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(status: .complete),
            tenancy: MockUserService.createMockTenancy(
                bankVerified: true,
                utilityVerified: true,
                landlordApproved: true
            ),
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
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.homeState, .missedPayment)
    }

    // MARK: - Home State Tests - paidThisMonth

    func testHomeState_PaidThisMonth_RecentSuccessfulPayment() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        let currentMonth = {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM"
            return formatter.string(from: Date())
        }()

        let dashboard = DashboardData(
            user: MockUserService.createMockUser(status: .complete),
            tenancy: MockUserService.createMockTenancy(
                bankVerified: true,
                utilityVerified: true,
                landlordApproved: true
            ),
            upcomingPayment: nil,
            cashback: CashbackData(
                availableBalancePaise: 50000,
                pendingBalancePaise: 0,
                totalEarnedPaise: 100000,
                totalUsedPaise: 50000
            ),
            recentPayments: [
                PaymentData(
                    id: "payment-1",
                    tenancyId: "tenancy-1",
                    rentAmountPaise: 4000000,
                    pgFeePaise: 0,
                    cashbackAppliedPaise: 50000,
                    totalAmountPaise: 3950000,
                    status: "success",
                    paymentMethod: "upi_intent",
                    paymentMonth: currentMonth,
                    createdAt: ISO8601DateFormatter().string(from: Date()),
                    completedAt: ISO8601DateFormatter().string(from: Date())
                )
            ],
            notifications: [],
            unreadNotificationCount: 0
        )
        mockUserService.mockDashboard = dashboard

        // When
        await viewModel.loadDashboard()

        // Then
        if case .paidThisMonth(let settlementStatus) = viewModel.homeState {
            XCTAssertEqual(settlementStatus, .processing)
        } else {
            XCTFail("Expected paidThisMonth state")
        }
    }

    // MARK: - Computed Properties Tests

    func testFirstName_WithName() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.firstName, "Amit")
    }

    func testFirstName_NoName_DefaultsToThere() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
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
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.firstName, "there")
    }

    func testRentAmount_FormattedWithRupeeSymbol() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await viewModel.loadDashboard()

        // Then
        XCTAssertTrue(viewModel.rentAmount.contains("40,000"))
    }

    func testCashbackAvailable_FormattedCorrectly() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await viewModel.loadDashboard()

        // Then
        XCTAssertTrue(viewModel.cashbackAvailable.contains("500"))
    }

    func testHasCashback_True() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await viewModel.loadDashboard()

        // Then
        XCTAssertTrue(viewModel.hasCashback)
    }

    func testHasCashback_False() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
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
        await viewModel.loadDashboard()

        // Then
        XCTAssertFalse(viewModel.hasCashback)
    }

    // MARK: - Due Date Text Tests

    func testDueInText_DueToday() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
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
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.dueInText, "Due today")
    }

    func testDueInText_DueTomorrow() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
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
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.dueInText, "Due tomorrow")
    }

    func testDueInText_Overdue() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
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
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.dueInText, "Overdue by 3 days")
    }

    // MARK: - Dashboard Loading Tests

    func testLoadDashboard_Success() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await viewModel.loadDashboard()

        // Then
        XCTAssertTrue(mockUserService.getDashboardDataCalled)
        XCTAssertNotNil(viewModel.dashboardData)

        if case .loaded = viewModel.state {
            // Expected
        } else {
            XCTFail("Expected loaded state")
        }
    }

    func testLoadDashboard_Failure_ShowsError() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        mockUserService.shouldSucceed = false
        mockUserService.errorToThrow = .serverError("Server unavailable")

        // When
        await viewModel.loadDashboard()

        // Then
        if case .error(let message) = viewModel.state {
            XCTAssertEqual(message, "Server unavailable")
        } else {
            XCTFail("Expected error state")
        }
    }

    func testRefresh() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        await viewModel.refresh()

        // Then
        XCTAssertFalse(viewModel.isRefreshing)
        XCTAssertTrue(mockUserService.getDashboardDataCalled)
    }

    // MARK: - Landlord Invitation Status Tests

    func testLandlordInvitationStatus_Accepted() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(),
            tenancy: MockUserService.createMockTenancy(landlordApproved: true),
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
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.landlordInvitationStatus, .accepted)
    }

    func testLandlordInvitationStatus_Pending() async {
        // Given
        let viewModel = HomeViewModel(userService: mockUserService)
        let dashboard = DashboardData(
            user: MockUserService.createMockUser(),
            tenancy: MockUserService.createMockTenancy(landlordApproved: false),
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
        await viewModel.loadDashboard()

        // Then
        XCTAssertEqual(viewModel.landlordInvitationStatus, .pending)
    }
}
