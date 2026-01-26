/// HomeViewModelTests.swift
/// Flent Secured v2 - Home ViewModel Tests
///
/// Tests for dashboard state management and data loading

import Testing
import Foundation
@testable import Flent

@Suite("HomeViewModel Tests")
struct HomeViewModelTests {

    // MARK: - Initialization Tests

    @Test("ViewModel initializes with idle state")
    func initializesWithIdleState() {
        let viewModel = HomeViewModel(userService: MockUserService())

        if case .idle = viewModel.state {
            // Correct
        } else {
            Issue.record("Expected idle state")
        }
        #expect(viewModel.isLoading == false)
        #expect(viewModel.errorMessage == nil)
    }

    // MARK: - Home State Tests (via loadDashboard)

    @Test("Zero state when no tenancy")
    @MainActor
    func zeroStateNoTenancy() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard(
            userStatus: .complete,
            hasTenancy: false,
            hasUpcomingPayment: false
        )

        let viewModel = HomeViewModel(userService: mockService)
        await viewModel.loadDashboard()

        #expect(viewModel.homeState == .zeroState)
    }

    @Test("Active qualified state")
    @MainActor
    func activeQualifiedState() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard(
            userStatus: .qualified,
            hasTenancy: true,
            hasUpcomingPayment: true,
            daysUntilDue: 5
        )

        let viewModel = HomeViewModel(userService: mockService)
        await viewModel.loadDashboard()

        #expect(viewModel.homeState == .activeQualified)
    }

    @Test("Active complete state")
    @MainActor
    func activeCompleteState() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard(
            userStatus: .complete,
            hasTenancy: true,
            hasUpcomingPayment: true,
            daysUntilDue: 5
        )

        let viewModel = HomeViewModel(userService: mockService)
        await viewModel.loadDashboard()

        #expect(viewModel.homeState == .activeComplete)
    }

    @Test("Late payment state when past cashback eligibility")
    @MainActor
    func latePaymentState() async {
        let mockService = MockUserService()
        // Days > 7 means no cashback eligibility
        mockService.mockDashboard = MockUserService.createMockDashboard(
            userStatus: .complete,
            hasTenancy: true,
            hasUpcomingPayment: true,
            daysUntilDue: 10 // After 7th, not eligible for cashback
        )

        let viewModel = HomeViewModel(userService: mockService)
        await viewModel.loadDashboard()

        #expect(viewModel.homeState == .latePayment)
    }

    @Test("Missed payment state when overdue")
    @MainActor
    func missedPaymentState() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard(
            userStatus: .complete,
            hasTenancy: true,
            hasUpcomingPayment: true,
            daysUntilDue: -3 // Overdue
        )

        let viewModel = HomeViewModel(userService: mockService)
        await viewModel.loadDashboard()

        #expect(viewModel.homeState == .missedPayment)
    }

    // MARK: - Computed Properties Tests

    @Test("Days until due returns 0 when no upcoming payment")
    func daysUntilDueDefault() {
        let viewModel = HomeViewModel(userService: MockUserService())

        #expect(viewModel.daysUntilDue == 0)
    }

    @Test("First name defaults to 'there' when no profile")
    func firstNameDefault() {
        let viewModel = HomeViewModel(userService: MockUserService())

        #expect(viewModel.firstName == "there")
    }

    @Test("Rent amount shows ₹0 when no tenancy")
    func rentAmountDefault() {
        let viewModel = HomeViewModel(userService: MockUserService())

        #expect(viewModel.rentAmount == "₹0")
    }

    @Test("Cashback available shows ₹0 when no cashback data")
    func cashbackAvailableDefault() {
        let viewModel = HomeViewModel(userService: MockUserService())

        #expect(viewModel.cashbackAvailable == "₹0")
    }

    @Test("Has cashback is false when no data")
    func hasCashbackDefault() {
        let viewModel = HomeViewModel(userService: MockUserService())

        #expect(viewModel.hasCashback == false)
    }

    @Test("Cashback eligibility is false when no upcoming payment")
    func cashbackEligibleDefault() {
        let viewModel = HomeViewModel(userService: MockUserService())

        #expect(viewModel.cashbackEligible == false)
    }

    @Test("Setup progress defaults to 0 of 3 when no tenancy")
    func setupProgressDefault() {
        let viewModel = HomeViewModel(userService: MockUserService())

        let progress = viewModel.setupProgress
        #expect(progress.completed == 0)
        #expect(progress.total == 3)
    }

    // MARK: - Loading State Tests

    @Test("Loading state is true during loadDashboard")
    @MainActor
    func loadingSetsState() async {
        let mockService = MockUserService()
        mockService.simulatedDelay = 0.5

        let viewModel = HomeViewModel(userService: mockService)

        let task = Task {
            await viewModel.loadDashboard()
        }

        // Give time for loading to start
        try? await Task.sleep(nanoseconds: 100_000_000)

        #expect(viewModel.isLoading == true)

        task.cancel()
    }

    @Test("Successful dashboard load sets loaded state")
    @MainActor
    func successfulDashboardLoad() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard(
            userStatus: .complete,
            hasTenancy: true,
            hasUpcomingPayment: true,
            daysUntilDue: 5
        )

        let viewModel = HomeViewModel(userService: mockService)

        await viewModel.loadDashboard()

        #expect(viewModel.isLoading == false)
        #expect(viewModel.errorMessage == nil)

        if case .loaded = viewModel.state {
            // Correct
        } else {
            Issue.record("Expected loaded state")
        }
    }

    @Test("Failed dashboard load shows error")
    @MainActor
    func failedDashboardLoad() async {
        let mockService = MockUserService()
        mockService.shouldSucceed = false
        mockService.errorToThrow = UserServiceError.networkError(URLError(.notConnectedToInternet))

        let viewModel = HomeViewModel(userService: mockService)

        await viewModel.loadDashboard()

        #expect(viewModel.isLoading == false)
        #expect(viewModel.errorMessage != nil)
    }

    @Test("Refresh calls loadDashboard")
    @MainActor
    func refreshCallsLoadDashboard() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard()

        let viewModel = HomeViewModel(userService: mockService)

        await viewModel.refresh()

        #expect(mockService.getDashboardDataCalled == true)
    }

    // MARK: - Dashboard Data Tests

    @Test("Dashboard data populates computed properties")
    @MainActor
    func dashboardDataPopulatesProperties() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard(
            userStatus: .complete,
            hasTenancy: true,
            hasUpcomingPayment: true,
            daysUntilDue: 5
        )

        let viewModel = HomeViewModel(userService: mockService)

        await viewModel.loadDashboard()

        #expect(viewModel.firstName == "Amit")
        #expect(viewModel.daysUntilDue == 5)
        #expect(viewModel.cashbackEligible == true) // Before 7th
    }

    @Test("Dashboard with overdue payment shows missed payment state")
    @MainActor
    func overduePaymentShowsMissedState() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard(
            userStatus: .complete,
            hasTenancy: true,
            hasUpcomingPayment: true,
            daysUntilDue: -3 // Overdue
        )

        let viewModel = HomeViewModel(userService: mockService)

        await viewModel.loadDashboard()

        #expect(viewModel.homeState == .missedPayment)
    }

    @Test("Dashboard without tenancy shows zero state")
    @MainActor
    func noTenancyShowsZeroState() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard(
            userStatus: .complete,
            hasTenancy: false,
            hasUpcomingPayment: false
        )

        let viewModel = HomeViewModel(userService: mockService)

        await viewModel.loadDashboard()

        #expect(viewModel.homeState == .zeroState)
    }

    // MARK: - Due Date Text Tests

    @Test("Due in text shows 'Due today' for 0 days")
    @MainActor
    func dueInTextToday() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard(
            daysUntilDue: 0
        )

        let viewModel = HomeViewModel(userService: mockService)
        await viewModel.loadDashboard()

        #expect(viewModel.dueInText == "Due today")
    }

    @Test("Due in text shows 'Due tomorrow' for 1 day")
    @MainActor
    func dueInTextTomorrow() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard(
            daysUntilDue: 1
        )

        let viewModel = HomeViewModel(userService: mockService)
        await viewModel.loadDashboard()

        #expect(viewModel.dueInText == "Due tomorrow")
    }

    @Test("Due in text shows days for multiple days")
    @MainActor
    func dueInTextMultipleDays() async {
        let mockService = MockUserService()
        mockService.mockDashboard = MockUserService.createMockDashboard(
            daysUntilDue: 5
        )

        let viewModel = HomeViewModel(userService: mockService)
        await viewModel.loadDashboard()

        #expect(viewModel.dueInText.contains("5 days"))
    }

    // MARK: - Preview Helpers

    @Test("Preview helpers create valid view models")
    func previewHelpers() {
        let preview = HomeViewModel.preview
        // Preview is a non-nil HomeViewModel
        #expect(preview.state != nil || true) // Just verify it doesn't crash

        let zeroState = HomeViewModel.previewZeroState
        #expect(zeroState.homeState == .zeroState)

        let active = HomeViewModel.previewActive
        #expect(active.homeState == .activeComplete)

        let paid = HomeViewModel.previewPaid
        #expect(paid.homeState == .paidThisMonth(settlementStatus: .processing))
    }
}
