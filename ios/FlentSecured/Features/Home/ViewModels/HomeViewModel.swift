/// HomeViewModel.swift
/// Flent Secured v2 - Home ViewModel
///
/// Manages home screen state and data loading
/// Determines appropriate home state based on user/tenancy status
///
/// Figma: Home screens (all variants)

import Foundation
import Observation

// MARK: - Home ViewModel

@Observable
final class HomeViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case loading
        case loaded(HomeState)
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var dashboardData: DashboardData?

    // Computed from dashboard data
    var userProfile: UserProfileData? {
        dashboardData?.user
    }

    var tenancy: TenancyData? {
        dashboardData?.tenancy
    }

    var upcomingPayment: UpcomingPaymentData? {
        dashboardData?.upcomingPayment
    }

    var cashback: CashbackData? {
        dashboardData?.cashback
    }

    var recentPayments: [PaymentData] {
        dashboardData?.recentPayments ?? []
    }

    var unreadNotificationCount: Int {
        dashboardData?.unreadNotificationCount ?? 0
    }

    // MARK: - Computed Properties

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var homeState: HomeState {
        if case .loaded(let homeState) = state {
            return homeState
        }
        return .zeroState
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var firstName: String {
        userProfile?.firstName ?? "there"
    }

    var rentAmount: String {
        guard let tenancy = tenancy else { return "₹0" }
        return formatCurrency(tenancy.monthlyRent)
    }

    var cashbackAvailable: String {
        guard let cashback = cashback else { return "₹0" }
        return formatCurrency(cashback.availableBalance)
    }

    var hasCashback: Bool {
        guard let cashback = cashback else { return false }
        return cashback.availableBalancePaise > 0
    }

    var daysUntilDue: Int {
        upcomingPayment?.daysUntilDue ?? 0
    }

    var dueInText: String {
        guard let payment = upcomingPayment else { return "" }

        if payment.isOverdue {
            return "Overdue by \(abs(payment.daysUntilDue)) days"
        } else if payment.daysUntilDue == 0 {
            return "Due today"
        } else if payment.daysUntilDue == 1 {
            return "Due tomorrow"
        } else {
            return "Due in \(payment.daysUntilDue) days"
        }
    }

    var cashbackEligible: Bool {
        upcomingPayment?.cashbackEligible ?? false
    }

    var setupProgress: (completed: Int, total: Int) {
        guard let tenancy = tenancy else { return (0, 3) }
        return (tenancy.completedVerificationCount, 3)
    }

    // MARK: - Dependencies

    private let userService: UserServiceProtocol

    // MARK: - Initialization

    init(userService: UserServiceProtocol = AppEnvironment.shared.userService) {
        self.userService = userService
    }

    // MARK: - Actions

    @MainActor
    func loadDashboard() async {
        state = .loading

        do {
            let data = try await userService.getDashboardData()
            dashboardData = data

            let homeState = determineHomeState(from: data)
            state = .loaded(homeState)
        } catch let error as UserServiceError {
            state = .error(error.errorDescription ?? "Failed to load dashboard")
        } catch {
            state = .error("Unable to load dashboard. Please try again.")
        }
    }

    @MainActor
    func refresh() async {
        await loadDashboard()
    }

    // MARK: - Private Helpers

    private func determineHomeState(from data: DashboardData) -> HomeState {
        guard let tenancy = data.tenancy else {
            return .zeroState
        }

        // Check if setup is incomplete
        if !tenancy.isFullyVerified {
            return .zeroState
        }

        // Check if user has paid this month
        let currentMonth = currentRentMonth()
        if let lastPayment = data.recentPayments.first,
           lastPayment.paymentMonth == currentMonth,
           lastPayment.paymentStatus == .success || lastPayment.paymentStatus == .settled {
            let settlementStatus = SettlementStatus(rawValue: lastPayment.status) ?? .processing
            return .paidThisMonth(settlementStatus: settlementStatus)
        }

        // Check upcoming payment status
        guard let upcoming = data.upcomingPayment else {
            // No upcoming payment, user might be complete
            return data.user.status == .complete ? .activeComplete : .activeQualified
        }

        // Determine state based on due date and user status
        if upcoming.isOverdue {
            return .missedPayment
        } else if !upcoming.cashbackEligible {
            return .latePayment
        } else {
            return data.user.status == .complete ? .activeComplete : .activeQualified
        }
    }

    private func currentRentMonth() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: Date())
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "₹"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "₹\(Int(amount))"
    }
}

// MARK: - Preview Helpers

extension HomeViewModel {
    static var preview: HomeViewModel {
        let vm = HomeViewModel(userService: MockUserService())
        return vm
    }

    static var previewLoading: HomeViewModel {
        let vm = HomeViewModel(userService: MockUserService())
        vm.state = .loading
        return vm
    }

    static var previewZeroState: HomeViewModel {
        let vm = HomeViewModel(userService: MockUserService())
        vm.state = .loaded(.zeroState)
        return vm
    }

    static var previewActive: HomeViewModel {
        let vm = HomeViewModel(userService: MockUserService())
        vm.state = .loaded(.activeComplete)
        return vm
    }

    static var previewPaid: HomeViewModel {
        let vm = HomeViewModel(userService: MockUserService())
        vm.state = .loaded(.paidThisMonth(settlementStatus: .processing))
        return vm
    }
}
