/// HomeViewModel.swift
/// Flent Secured v2 - Home ViewModel
///
/// Manages home screen state and data loading
/// Determines appropriate home state based on user/tenancy status
/// Supports real-time subscription for payment status updates
///
/// Figma: Home screens (all variants)

import Foundation
import Observation

// MARK: - Landlord Invitation Status

enum LandlordInvitationStatus: String, Codable, Equatable {
    case notSent = "not_sent"
    case sent = "sent"
    case pending = "pending"
    case accepted = "accepted"
    case declined = "declined"
    case failed = "failed"
}

// MARK: - Overdue Payment Info

struct OverduePaymentInfo: Equatable {
    let month: String
    let amountPaise: Int
    let daysOverdue: Int

    var amount: Double {
        Double(amountPaise) / 100.0
    }
}

// MARK: - Home ViewModel

@MainActor
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
    private(set) var isRefreshing = false
    private(set) var realtimeSubscriptionActive = false

    // Landlord invitation status
    private(set) var landlordInvitationStatus: LandlordInvitationStatus = .notSent
    private(set) var landlordInvitationUIState: LandlordInvitationUIState = .notSent
    private(set) var landlordInvitationSentAt: Date?
    private(set) var landlordInvitationFailureReason: String?

    // Last payment details (for paid state)
    private(set) var lastPaymentCashback: Double = 0
    private(set) var lastPaymentDate: String = ""

    // Multiple overdue payments tracking
    private(set) var overduePayments: [OverduePaymentInfo] = []
    private(set) var totalOutstanding: Double = 0

    // Payment method setup state
    private(set) var hasUPISetup: Bool = false
    private(set) var hasNetbankingSetup: Bool = false
    private(set) var hasCreditCardSetup: Bool = false

    // Realtime subscription handle
    private var subscriptionHandle: Any?

    // MARK: - Computed Properties from Dashboard Data

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

    // MARK: - View State Properties

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
        guard let tenancy = tenancy else { return "\u{20B9}0" }
        return formatCurrency(tenancy.monthlyRent)
    }

    var cashbackAvailable: String {
        guard let cashback = cashback else { return "\u{20B9}0" }
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

    /// Days until cashback eligibility expires (7th of month)
    var daysUntilCashbackExpiry: Int {
        let calendar = Calendar.current
        let today = Date()
        let day = calendar.component(.day, from: today)

        if day <= 7 {
            return 7 - day
        }
        return 0
    }

    var setupProgress: Int {
        guard let tenancy = tenancy else { return 0 }
        return tenancy.completedVerificationCount
    }

    var bankDetailsComplete: Bool {
        tenancy?.bankDetailsComplete ?? false
    }

    var addressProofComplete: Bool {
        tenancy?.addressProofComplete ?? false
    }

    var landlordInvited: Bool {
        tenancy?.landlordInvited ?? false
    }

    var onTimePayments: Int {
        // Count successful payments from recent payments
        recentPayments.filter { $0.paymentStatus == .success || $0.paymentStatus == .settled }.count
    }

    var propertyName: String {
        tenancy?.propertyName ?? tenancy?.addressLine1 ?? "Your Property"
    }

    var propertyAddress: String {
        tenancy?.fullAddress ?? ""
    }

    var rentDueDay: Int {
        tenancy?.rentDueDay ?? 1
    }

    var rentDueOrdinal: String {
        ordinalSuffix(for: rentDueDay)
    }

    // MARK: - Dependencies

    private let userService: UserServiceProtocol

    // MARK: - Initialization

    init(userService: UserServiceProtocol = AppEnvironment.shared.userService) {
        self.userService = userService
    }

    deinit {
        // Subscription cleanup will happen automatically when the object is deallocated
    }

    // MARK: - Public Actions

    @MainActor
    func loadDashboard() async {
        state = .loading

        do {
            let data = try await userService.getDashboardData()
            dashboardData = data

            // Update landlord invitation status from tenancy
            updateLandlordInvitationStatus(from: data)

            // Update last payment details
            updateLastPaymentDetails(from: data)

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
        isRefreshing = true
        await loadDashboard()
        isRefreshing = false
    }

    @MainActor
    func resendLandlordInvitation() async {
        // Check cooldown (24 hours between resends)
        if let sentAt = landlordInvitationSentAt {
            let hoursSince = Calendar.current.dateComponents([.hour], from: sentAt, to: Date()).hour ?? 0
            if hoursSince < 24 {
                // Still in cooldown
                landlordInvitationUIState = .pendingUnder24hrs(hoursRemaining: 24 - hoursSince)
                return
            }
        }

        // Attempt to resend
        do {
            // In real implementation:
            // try await tenancyService.resendLandlordInvitation(tenancyId: tenancy?.id ?? "")

            landlordInvitationStatus = .sent
            landlordInvitationSentAt = Date()
            landlordInvitationUIState = .sent
        } catch {
            landlordInvitationStatus = .failed
            landlordInvitationFailureReason = error.localizedDescription
            landlordInvitationUIState = .failed(reason: error.localizedDescription)
        }
    }

    /// Check if resend is available (cooldown expired)
    var canResendInvitation: Bool {
        guard let sentAt = landlordInvitationSentAt else { return true }
        let hoursSince = Calendar.current.dateComponents([.hour], from: sentAt, to: Date()).hour ?? 0
        return hoursSince >= 24
    }

    /// Hours remaining until resend is available
    var hoursUntilCanResend: Int {
        guard let sentAt = landlordInvitationSentAt else { return 0 }
        let hoursSince = Calendar.current.dateComponents([.hour], from: sentAt, to: Date()).hour ?? 0
        return max(0, 24 - hoursSince)
    }

    /// Days since invitation was sent
    var daysSinceInvitationSent: Int {
        guard let sentAt = landlordInvitationSentAt else { return 0 }
        return Calendar.current.dateComponents([.day], from: sentAt, to: Date()).day ?? 0
    }

    // MARK: - Realtime Subscription

    func startRealtimeSubscription() {
        guard !realtimeSubscriptionActive else { return }

        // Subscribe to payment status changes
        // This would use Supabase realtime or similar
        // subscriptionHandle = SupabaseManager.shared.subscribeToPaymentUpdates { [weak self] update in
        //     Task { @MainActor in
        //         self?.handlePaymentUpdate(update)
        //     }
        // }

        realtimeSubscriptionActive = true
    }

    func stopRealtimeSubscription() {
        guard realtimeSubscriptionActive else { return }

        // Unsubscribe from realtime updates
        // SupabaseManager.shared.unsubscribe(handle: subscriptionHandle)
        subscriptionHandle = nil
        realtimeSubscriptionActive = false
    }

    // MARK: - Formatting Helpers

    func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "\u{20B9}\(Int(amount))"
    }

    // MARK: - Private Helpers

    private func determineHomeState(from data: DashboardData) -> HomeState {
        guard let tenancy = data.tenancy else {
            return .zeroState
        }

        // Check if setup is incomplete - return appropriate empty state
        if !tenancy.isFullyVerified {
            return determineEmptyState(from: data, tenancy: tenancy)
        }

        // Check if user has paid this month
        let currentMonth = currentRentMonth()
        if let lastPayment = data.recentPayments.first,
           lastPayment.paymentMonth == currentMonth,
           lastPayment.paymentStatus == .success || lastPayment.paymentStatus == .settled {
            let settlementStatus = SettlementStatus(rawValue: lastPayment.status) ?? .processing
            return .paidThisMonth(settlementStatus: settlementStatus)
        }

        // Check for multiple overdue payments
        let overdueCount = countOverduePayments(from: data)
        if overdueCount >= 2 {
            let total = calculateTotalOutstanding(from: data)
            return .multipleMissedPayments(months: overdueCount, totalAmount: total)
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

    /// Determine the appropriate empty state based on payment method setup and payment history
    private func determineEmptyState(from data: DashboardData, tenancy: TenancyData) -> HomeState {
        let hasUPI = hasUPISetup
        let hasPayments = !data.recentPayments.isEmpty
        let hasCashbackBalance = data.cashback.availableBalancePaise > 0

        // Check if current month is paid
        let currentMonth = currentRentMonth()
        let isPaidThisMonth = data.recentPayments.contains {
            $0.paymentMonth == currentMonth &&
            ($0.paymentStatus == .success || $0.paymentStatus == .settled)
        }

        // Determine empty state variant based on conditions
        if !hasUPI {
            // No payment methods set up yet
            return .setupPayment
        }

        // Has UPI set up - check payment and cashback status
        if isPaidThisMonth {
            if hasCashbackBalance {
                return .emptyWithCashbackPaid  // 41:6598
            } else {
                return .emptyWithUPIPaid  // 41:5998
            }
        }

        if hasPayments {
            if hasCashbackBalance {
                return .emptyWithCashback  // 41:6385
            } else {
                return .emptyWithUPIPayments  // 41:5792
            }
        } else {
            if hasCashbackBalance {
                return .emptyWithCashback  // 41:6385
            } else {
                return .emptyNoCashback  // 41:6811
            }
        }
    }

    /// Count the number of overdue months
    private func countOverduePayments(from data: DashboardData) -> Int {
        // In real implementation, this would check for multiple months of missed payments
        // For now, check if payment is more than 30 days overdue
        guard let upcoming = data.upcomingPayment else { return 0 }

        if upcoming.isOverdue {
            let daysOverdue = abs(upcoming.daysUntilDue)
            // Approximate: 30+ days = 1 extra month overdue
            return 1 + (daysOverdue / 30)
        }
        return 0
    }

    /// Calculate total outstanding amount across all overdue payments
    private func calculateTotalOutstanding(from data: DashboardData) -> Double {
        guard let tenancy = data.tenancy,
              let upcoming = data.upcomingPayment else { return 0 }

        let monthsOverdue = countOverduePayments(from: data)
        return tenancy.monthlyRent * Double(monthsOverdue)
    }

    private func updateLandlordInvitationStatus(from data: DashboardData) {
        guard let tenancy = data.tenancy else {
            landlordInvitationStatus = .notSent
            landlordInvitationUIState = .notSent
            return
        }

        if tenancy.landlordApproved {
            landlordInvitationStatus = .accepted
            landlordInvitationUIState = .accepted
        } else if tenancy.landlordPhone != nil || tenancy.landlordEmail != nil {
            // Landlord details exist, so invitation was sent
            landlordInvitationStatus = .pending

            // Determine UI state based on time since invitation
            if let sentAt = landlordInvitationSentAt {
                let hoursSince = Calendar.current.dateComponents([.hour], from: sentAt, to: Date()).hour ?? 0
                if hoursSince < 24 {
                    landlordInvitationUIState = .pendingUnder24hrs(hoursRemaining: 24 - hoursSince)
                } else {
                    let daysSince = Calendar.current.dateComponents([.day], from: sentAt, to: Date()).day ?? 0
                    landlordInvitationUIState = .pendingOver24hrs(daysSinceSent: daysSince)
                }
            } else {
                landlordInvitationUIState = .sent
            }
        } else {
            landlordInvitationStatus = .notSent
            landlordInvitationUIState = .notSent
        }
    }

    private func updateLastPaymentDetails(from data: DashboardData) {
        guard let lastPayment = data.recentPayments.first,
              lastPayment.paymentStatus == .success || lastPayment.paymentStatus == .settled else {
            lastPaymentCashback = 0
            lastPaymentDate = ""
            return
        }

        // Calculate cashback earned from last payment
        lastPaymentCashback = Double(lastPayment.cashbackAppliedPaise) / 100.0

        // Format the payment date
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = isoFormatter.date(from: lastPayment.createdAt) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "MMM d"
            lastPaymentDate = displayFormatter.string(from: date)
        } else {
            lastPaymentDate = lastPayment.paymentMonth
        }
    }

    private func currentRentMonth() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: Date())
    }

    private func ordinalSuffix(for day: Int) -> String {
        switch day {
        case 1, 21, 31: return "st"
        case 2, 22: return "nd"
        case 3, 23: return "rd"
        default: return "th"
        }
    }

    @MainActor
    private func handlePaymentUpdate(_ update: PaymentStatusData) {
        // Handle realtime payment status update
        // Refresh dashboard if payment status changed
        Task {
            await loadDashboard()
        }
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
        vm.lastPaymentCashback = 250
        vm.lastPaymentDate = "Jan 5"
        return vm
    }

    static var previewLandlordPending: HomeViewModel {
        let vm = HomeViewModel(userService: MockUserService())
        vm.state = .loaded(.zeroState)
        vm.landlordInvitationStatus = .pending
        return vm
    }

    static var previewLandlordDeclined: HomeViewModel {
        let vm = HomeViewModel(userService: MockUserService())
        vm.state = .loaded(.zeroState)
        vm.landlordInvitationStatus = .declined
        return vm
    }

    static var previewLatePayment: HomeViewModel {
        let vm = HomeViewModel(userService: MockUserService())
        vm.state = .loaded(.latePayment)
        return vm
    }

    static var previewMissedPayment: HomeViewModel {
        let vm = HomeViewModel(userService: MockUserService())
        vm.state = .loaded(.missedPayment)
        return vm
    }
}
