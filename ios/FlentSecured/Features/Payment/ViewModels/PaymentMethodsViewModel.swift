/// PaymentMethodsViewModel.swift
/// Flent Secured v2 - Payment Methods ViewModel
///
/// Manages payment method selection and initiation
/// Handles user status-based method availability
///
/// Figma: Pay Rent / Payment Page screens

import Foundation
import Observation

// MARK: - Payment Methods ViewModel

@Observable
final class PaymentMethodsViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case initiating
        case initiated(PaymentInitiation)
        case error(AppError)
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var paymentInitiation: PaymentInitiation?
    private(set) var currentError: AppError?

    private let retryHandler = RetryHandler()

    var selectedMethod: PaymentMethod?
    var selectedUPIApp: UPIApp?

    // Amount data
    var rentAmountPaise: Int = 0
    var pgFeePaise: Int = 0
    var cashbackAvailablePaise: Int = 0
    var applyCashback: Bool = true

    // MARK: - Computed Properties

    var isInitiating: Bool {
        if case .initiating = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let error) = state {
            return error.userMessage
        }
        return currentError?.userMessage
    }

    var canRetry: Bool {
        currentError?.isRetryable ?? false
    }

    var canInitiate: Bool {
        selectedMethod != nil && !isInitiating
    }

    /// Whether user can use credit cards (COMPLETE status only)
    var canUseCreditCard: Bool {
        userStatus == .complete
    }

    /// Whether user can use wallets (COMPLETE status only)
    var canUseWallet: Bool {
        userStatus == .complete
    }

    /// Available payment methods based on user status
    var availableMethods: [PaymentMethod] {
        PaymentMethod.allCases.filter { method in
            if method.requiresFullVerification {
                return userStatus == .complete
            }
            return true
        }
    }

    var rentAmount: Double {
        Double(rentAmountPaise) / 100.0
    }

    var pgFee: Double {
        Double(pgFeePaise) / 100.0
    }

    var cashbackToApply: Double {
        guard applyCashback else { return 0 }
        return min(Double(cashbackAvailablePaise), Double(rentAmountPaise)) / 100.0
    }

    var totalAmount: Double {
        rentAmount + pgFee - cashbackToApply
    }

    var formattedRentAmount: String {
        formatCurrency(rentAmount)
    }

    var formattedTotalAmount: String {
        formatCurrency(totalAmount)
    }

    var formattedCashback: String {
        formatCurrency(cashbackToApply)
    }

    /// Estimated cashback for display in UI
    var estimatedCashbackFormatted: String {
        // Estimate 1% cashback on rent amount
        let estimatedCashback = Double(rentAmountPaise) * 0.01 / 100.0
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: estimatedCashback)) ?? "\(Int(estimatedCashback))"
    }

    // MARK: - Dependencies

    private let tenancyId: String
    private let rentMonth: String
    private let userStatus: UserStatus
    private let paymentService: PaymentServiceProtocol

    // MARK: - Initialization

    init(
        tenancyId: String,
        rentMonth: String,
        rentAmountPaise: Int,
        cashbackAvailablePaise: Int = 0,
        userStatus: UserStatus = .qualified,
        paymentService: PaymentServiceProtocol = AppEnvironment.shared.paymentService
    ) {
        self.tenancyId = tenancyId
        self.rentMonth = rentMonth
        self.rentAmountPaise = rentAmountPaise
        self.cashbackAvailablePaise = cashbackAvailablePaise
        self.userStatus = userStatus
        self.paymentService = paymentService
    }

    // MARK: - Actions

    func selectMethod(_ method: PaymentMethod) {
        selectedMethod = method
        selectedUPIApp = nil

        // Calculate PG fee based on method
        calculatePGFee(for: method)
    }

    func selectUPIApp(_ app: UPIApp) {
        selectedMethod = .upiIntent
        selectedUPIApp = app
        calculatePGFee(for: .upiIntent)
    }

    @MainActor
    func initiatePayment() async -> PaymentInitiation? {
        guard let method = selectedMethod else {
            let error = AppError.validationError("Please select a payment method")
            currentError = error
            state = .error(error)
            return nil
        }

        // Check if method requires verification
        if method.requiresFullVerification && userStatus != .complete {
            let error = AppError.verificationFailed(reason: "Complete 3 on-time payments to unlock this method")
            currentError = error
            state = .error(error)
            return nil
        }

        state = .initiating
        currentError = nil

        do {
            // Use retry handler for network resilience
            let initiation = try await retryHandler.execute(
                configuration: .payment
            ) { [paymentService, tenancyId, rentMonth, applyCashback, cashbackAvailablePaise] in
                try await paymentService.initiatePayment(
                    tenancyId: tenancyId,
                    paymentMethod: method,
                    rentMonth: rentMonth,
                    applyCashback: applyCashback && cashbackAvailablePaise > 0
                )
            }

            paymentInitiation = initiation
            state = .initiated(initiation)
            return initiation
        } catch {
            let appError = AppError.from(error)
            currentError = appError
            state = .error(appError)

            // Log the error
            ErrorLogger.shared.log(error, context: [
                "method": method.rawValue,
                "tenancyId": tenancyId,
                "rentMonth": rentMonth
            ])

            return nil
        }
    }

    func clearError() {
        currentError = nil
        if case .error = state {
            state = .idle
        }
    }

    /// Retry payment initiation after an error
    @MainActor
    func retryPayment() async -> PaymentInitiation? {
        guard canRetry else { return nil }
        return await initiatePayment()
    }

    // MARK: - Private Helpers

    private func calculatePGFee(for method: PaymentMethod) {
        // PG fees vary by method
        // UPI: 0%, NetBanking: 0%, Cards: ~1.8%
        switch method {
        case .upiIntent, .upiCollect:
            pgFeePaise = 0
        case .netBanking:
            pgFeePaise = 0
        case .debitCard:
            // Debit card usually has lower fees
            pgFeePaise = Int(Double(rentAmountPaise) * 0.009) // 0.9%
        case .creditCard:
            pgFeePaise = Int(Double(rentAmountPaise) * 0.018) // 1.8%
        case .wallet:
            pgFeePaise = Int(Double(rentAmountPaise) * 0.015) // 1.5%
        }
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

extension PaymentMethodsViewModel {
    static var preview: PaymentMethodsViewModel {
        PaymentMethodsViewModel(
            tenancyId: "test-tenancy",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000, // ₹25,000
            cashbackAvailablePaise: 50000, // ₹500
            userStatus: .complete,
            paymentService: MockPaymentService()
        )
    }

    static var previewQualified: PaymentMethodsViewModel {
        PaymentMethodsViewModel(
            tenancyId: "test-tenancy",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000,
            cashbackAvailablePaise: 0,
            userStatus: .qualified,
            paymentService: MockPaymentService()
        )
    }

    static var previewSelected: PaymentMethodsViewModel {
        let vm = preview
        vm.selectedMethod = .upiIntent
        vm.selectedUPIApp = .gpay
        return vm
    }

    static var previewInitiating: PaymentMethodsViewModel {
        let vm = preview
        vm.selectedMethod = .upiIntent
        vm.state = .initiating
        return vm
    }
}
