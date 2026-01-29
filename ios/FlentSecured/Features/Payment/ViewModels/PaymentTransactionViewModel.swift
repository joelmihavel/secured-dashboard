/// PaymentTransactionViewModel.swift
/// Flent Secured v2 - Payment Transaction ViewModel
///
/// Manages the transaction page state showing rent summary
/// Handles cashback calculation and due date display
///
/// Cashback Logic:
/// - 1% of rent amount
/// - Only if payment is before 7th of the month
/// - Maximum cap of Rs. 10,000 per payment

import Foundation
import Observation

// MARK: - Payment Transaction ViewModel

@MainActor
@Observable
final class PaymentTransactionViewModel {

    // MARK: - Properties

    private(set) var isLoading = false
    private(set) var errorMessage: String?

    // Amount properties (in paise)
    var rentAmountPaise: Int
    var platformFeePaise: Int = 0
    var cashbackAvailablePaise: Int
    var cashbackAppliedPaise: Int = 0
    var estimatedCashbackPaise: Int = 0

    // Due date and eligibility
    var dueDate: Date
    var isCashbackEligible: Bool

    var isOverdue: Bool {
        // Compare calendar days, not exact timestamps
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let dueDateDay = calendar.startOfDay(for: dueDate)
        return dueDateDay < today
    }

    var isDueToday: Bool {
        Calendar.current.isDateInToday(dueDate)
    }

    var isDueTomorrow: Bool {
        Calendar.current.isDateInTomorrow(dueDate)
    }

    var daysUntilDue: Int {
        Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()), to: Calendar.current.startOfDay(for: dueDate)).day ?? 0
    }

    var isLatePayment: Bool {
        !isCashbackEligible && !isOverdue
    }

    /// Tracks if this is user's first payment (no prior history)
    var isFirstPayment: Bool = true

    // Tenancy info
    let tenancyId: String

    // MARK: - Computed Properties

    /// Total amount in paise
    var totalAmountPaise: Int {
        rentAmountPaise + platformFeePaise - cashbackAppliedPaise
    }

    /// Formatted rent amount
    var formattedRentAmount: String {
        formatCurrency(Double(rentAmountPaise) / 100.0)
    }

    /// Formatted platform fee
    var formattedPlatformFee: String {
        formatCurrency(Double(platformFeePaise) / 100.0)
    }

    /// Formatted cashback applied
    var formattedCashbackApplied: String {
        formatCurrency(Double(cashbackAppliedPaise) / 100.0)
    }

    /// Formatted total amount
    var formattedTotalAmount: String {
        formatCurrency(Double(totalAmountPaise) / 100.0)
    }

    /// Formatted estimated cashback
    var formattedEstimatedCashback: String {
        formatCurrency(Double(estimatedCashbackPaise) / 100.0)
    }

    /// Formatted available cashback
    var formattedAvailableCashback: String {
        formatCurrency(Double(cashbackAvailablePaise) / 100.0)
    }

    /// Current month formatted for display (e.g., "January 2026")
    var rentMonthFormatted: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: Date())
    }

    /// Due date formatted for display
    var dueDateFormatted: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: dueDate)
    }

    /// Cashback deadline (7th of the month)
    var cashbackDeadline: Date {
        let calendar = Calendar.current
        var components = calendar.dateComponents([.year, .month], from: Date())
        components.day = 7
        return calendar.date(from: components) ?? Date()
    }

    /// Cashback deadline formatted
    var cashbackDeadlineFormatted: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM"
        return formatter.string(from: cashbackDeadline)
    }

    /// Due date message for UI
    var dueDateMessage: String {
        if isOverdue {
            let calendar = Calendar.current
            let today = calendar.startOfDay(for: Date())
            let dueDateDay = calendar.startOfDay(for: dueDate)
            let days = calendar.dateComponents([.day], from: dueDateDay, to: today).day ?? 0
            return "Overdue by \(days) day\(days == 1 ? "" : "s")"
        } else if isDueToday {
            return "Due today"
        } else if isDueTomorrow {
            return "Due tomorrow"
        } else {
            let days = Calendar.current.dateComponents([.day], from: Date(), to: dueDate).day ?? 0
            if days == 1 {
                return "Due tomorrow"
            } else {
                return "Due in \(days) days (\(dueDateFormatted))"
            }
        }
    }

    /// Check if current date is before 7th of month (cashback eligible)
    static var isBeforeSeventhOfMonth: Bool {
        let day = Calendar.current.component(.day, from: Date())
        return day <= 7
    }

    // MARK: - Dependencies

    private let paymentService: PaymentServiceProtocol
    private let userService: UserServiceProtocol

    // MARK: - Initialization

    init(
        tenancyId: String,
        rentAmountPaise: Int,
        cashbackAvailablePaise: Int = 0,
        dueDate: Date = Date(),
        isCashbackEligible: Bool = true,
        paymentService: PaymentServiceProtocol = AppEnvironment.shared.paymentService,
        userService: UserServiceProtocol = AppEnvironment.shared.userService
    ) {
        self.tenancyId = tenancyId
        self.rentAmountPaise = rentAmountPaise
        self.cashbackAvailablePaise = cashbackAvailablePaise
        self.dueDate = dueDate
        self.isCashbackEligible = isCashbackEligible
        self.paymentService = paymentService
        self.userService = userService

        // Calculate estimated cashback (1% of rent, capped at Rs 10,000)
        if isCashbackEligible {
            let cashback = Int(Double(rentAmountPaise) * 0.01)
            let maxCashbackPaise = 1000000 // Rs 10,000
            self.estimatedCashbackPaise = min(cashback, maxCashbackPaise)
        }

        // Auto-apply available cashback up to rent amount
        if cashbackAvailablePaise > 0 {
            self.cashbackAppliedPaise = min(cashbackAvailablePaise, rentAmountPaise)
        }
    }

    // MARK: - Actions

    @MainActor
    func loadData() async {
        isLoading = true
        errorMessage = nil

        do {
            // Load tenancy data to get accurate rent amount
            if let tenancy = try await userService.getCurrentTenancy() {
                self.rentAmountPaise = tenancy.monthlyRentPaise

                // Recalculate estimated cashback
                if isCashbackEligible {
                    let cashback = Int(Double(rentAmountPaise) * 0.01)
                    let maxCashbackPaise = 1000000 // Rs 10,000
                    self.estimatedCashbackPaise = min(cashback, maxCashbackPaise)
                }
            }

            // Load dashboard data for cashback balance
            let dashboard = try await userService.getDashboardData()
            self.cashbackAvailablePaise = dashboard.cashback.availableBalancePaise

            // Auto-apply available cashback
            if cashbackAvailablePaise > 0 && isCashbackEligible {
                self.cashbackAppliedPaise = min(cashbackAvailablePaise, rentAmountPaise)
            }

            // Check due date from upcoming payment
            if let upcoming = dashboard.upcomingPayment {
                let formatter = ISO8601DateFormatter()
                if let date = formatter.date(from: upcoming.dueDate) {
                    self.dueDate = date
                }
                self.isCashbackEligible = upcoming.cashbackEligible
            }

            // Check if user has prior payment history
            // For now, check if dashboard has any payment data
            self.isFirstPayment = dashboard.upcomingPayment == nil

        } catch {
            errorMessage = AppError.from(error).userMessage
        }

        isLoading = false
    }

    /// Toggle cashback application
    func toggleCashbackApplication() {
        if cashbackAppliedPaise > 0 {
            cashbackAppliedPaise = 0
        } else {
            cashbackAppliedPaise = min(cashbackAvailablePaise, rentAmountPaise)
        }
    }

    // MARK: - Private Helpers

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "\u{20B9}\(Int(amount))"
    }
}

// MARK: - Preview Helpers

extension PaymentTransactionViewModel {
    static var preview: PaymentTransactionViewModel {
        PaymentTransactionViewModel(
            tenancyId: "test-tenancy",
            rentAmountPaise: 2500000,
            cashbackAvailablePaise: 25000,
            dueDate: Date().addingTimeInterval(86400 * 5),
            isCashbackEligible: true
        )
    }

    static var previewWithCashback: PaymentTransactionViewModel {
        let vm = PaymentTransactionViewModel(
            tenancyId: "test-tenancy",
            rentAmountPaise: 2500000,
            cashbackAvailablePaise: 50000, // Rs. 500
            dueDate: Date().addingTimeInterval(86400 * 5),
            isCashbackEligible: true
        )
        vm.isFirstPayment = false
        return vm
    }

    static var previewFirstVisit: PaymentTransactionViewModel {
        let vm = PaymentTransactionViewModel(
            tenancyId: "test-tenancy",
            rentAmountPaise: 2500000,
            cashbackAvailablePaise: 0,
            dueDate: Date().addingTimeInterval(86400 * 5),
            isCashbackEligible: true
        )
        vm.isFirstPayment = true
        return vm
    }

    static var previewLate: PaymentTransactionViewModel {
        PaymentTransactionViewModel(
            tenancyId: "test-tenancy",
            rentAmountPaise: 2500000,
            cashbackAvailablePaise: 0,
            dueDate: Date().addingTimeInterval(-86400 * 2),
            isCashbackEligible: false
        )
    }
}
