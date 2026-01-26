/// PaymentMethodsViewModelTests.swift
/// Flent Secured v2 - Payment Methods ViewModel Tests
///
/// Tests payment method selection, availability based on user status,
/// and payment initiation flow

import Testing
@testable import Flent

@Suite("PaymentMethodsViewModel Tests")
struct PaymentMethodsViewModelTests {

    // MARK: - Payment Method Availability

    @Test("QUALIFIED user cannot use credit card or wallet")
    func qualifiedUserRestrictedMethods() {
        let vm = PaymentMethodsViewModel(
            tenancyId: "test",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000,
            userStatus: .qualified,
            paymentService: MockPaymentService()
        )

        #expect(vm.canUseCreditCard == false)
        #expect(vm.canUseWallet == false)
        #expect(vm.availableMethods.contains(.creditCard) == false)
        #expect(vm.availableMethods.contains(.wallet) == false)
    }

    @Test("COMPLETE user can use all payment methods")
    func completeUserAllMethods() {
        let vm = PaymentMethodsViewModel(
            tenancyId: "test",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000,
            userStatus: .complete,
            paymentService: MockPaymentService()
        )

        #expect(vm.canUseCreditCard == true)
        #expect(vm.canUseWallet == true)
        #expect(vm.availableMethods.contains(.creditCard) == true)
        #expect(vm.availableMethods.contains(.wallet) == true)
        #expect(vm.availableMethods.contains(.upiIntent) == true)
        #expect(vm.availableMethods.contains(.netBanking) == true)
    }

    @Test("UPI and NetBanking always available")
    func basicMethodsAlwaysAvailable() {
        for status in [UserStatus.signedUp, .waitlisted, .qualified, .complete] {
            let vm = PaymentMethodsViewModel(
                tenancyId: "test",
                rentMonth: "2026-01",
                rentAmountPaise: 2500000,
                userStatus: status,
                paymentService: MockPaymentService()
            )

            #expect(vm.availableMethods.contains(.upiIntent))
            #expect(vm.availableMethods.contains(.netBanking))
        }
    }

    // MARK: - Amount Calculations

    @Test("Rent amount converts from paise to rupees correctly")
    func rentAmountConversion() {
        let vm = PaymentMethodsViewModel(
            tenancyId: "test",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000, // ₹25,000
            userStatus: .complete,
            paymentService: MockPaymentService()
        )

        #expect(vm.rentAmount == 25000.0)
    }

    @Test("PG fee is 0 for UPI")
    func upiNoPGFee() {
        let vm = PaymentMethodsViewModel(
            tenancyId: "test",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000,
            userStatus: .complete,
            paymentService: MockPaymentService()
        )

        vm.selectMethod(.upiIntent)

        #expect(vm.pgFeePaise == 0)
        #expect(vm.pgFee == 0)
    }

    @Test("PG fee calculated for credit card")
    func creditCardPGFee() {
        let vm = PaymentMethodsViewModel(
            tenancyId: "test",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000, // ₹25,000
            userStatus: .complete,
            paymentService: MockPaymentService()
        )

        vm.selectMethod(.creditCard)

        // 1.8% of ₹25,000 = ₹450
        #expect(vm.pgFeePaise == 45000)
    }

    @Test("Cashback applied when enabled and available")
    func cashbackApplied() {
        let vm = PaymentMethodsViewModel(
            tenancyId: "test",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000, // ₹25,000
            cashbackAvailablePaise: 50000, // ₹500
            userStatus: .complete,
            paymentService: MockPaymentService()
        )

        vm.applyCashback = true

        #expect(vm.cashbackToApply == 500.0)
        #expect(vm.totalAmount == 25000.0 - 500.0) // ₹24,500
    }

    @Test("Cashback not applied when disabled")
    func cashbackNotApplied() {
        let vm = PaymentMethodsViewModel(
            tenancyId: "test",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000,
            cashbackAvailablePaise: 50000,
            userStatus: .complete,
            paymentService: MockPaymentService()
        )

        vm.applyCashback = false

        #expect(vm.cashbackToApply == 0)
        #expect(vm.totalAmount == 25000.0)
    }

    // MARK: - Method Selection

    @Test("Selecting method clears previous UPI app")
    func methodSelectionClearsUPIApp() {
        let vm = PaymentMethodsViewModel(
            tenancyId: "test",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000,
            userStatus: .complete,
            paymentService: MockPaymentService()
        )

        vm.selectUPIApp(.gpay)
        #expect(vm.selectedUPIApp == .gpay)
        #expect(vm.selectedMethod == .upiIntent)

        vm.selectMethod(.netBanking)
        #expect(vm.selectedUPIApp == nil)
        #expect(vm.selectedMethod == .netBanking)
    }

    // MARK: - Initiation Validation

    @Test("Cannot initiate without selected method")
    func cannotInitiateWithoutMethod() {
        let vm = PaymentMethodsViewModel(
            tenancyId: "test",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000,
            userStatus: .complete,
            paymentService: MockPaymentService()
        )

        #expect(vm.canInitiate == false)
    }

    @Test("Can initiate with selected method")
    func canInitiateWithMethod() {
        let vm = PaymentMethodsViewModel(
            tenancyId: "test",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000,
            userStatus: .complete,
            paymentService: MockPaymentService()
        )

        vm.selectMethod(.upiIntent)

        #expect(vm.canInitiate == true)
    }

    @Test("QUALIFIED user cannot initiate with credit card")
    @MainActor
    func qualifiedCannotUseCreditCard() async {
        let vm = PaymentMethodsViewModel(
            tenancyId: "test",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000,
            userStatus: .qualified,
            paymentService: MockPaymentService()
        )

        // Force select credit card (bypassing UI restriction)
        vm.selectedMethod = .creditCard

        let result = await vm.initiatePayment()

        #expect(result == nil)
        #expect(vm.errorMessage != nil)
    }

    // MARK: - Payment Initiation

    @Test("Successful payment initiation")
    @MainActor
    func successfulInitiation() async {
        let mockService = MockPaymentService()
        let vm = PaymentMethodsViewModel(
            tenancyId: "test-tenancy-id",
            rentMonth: "2026-01",
            rentAmountPaise: 2500000,
            userStatus: .complete,
            paymentService: mockService
        )

        vm.selectMethod(.upiIntent)

        let result = await vm.initiatePayment()

        #expect(result != nil)
        #expect(mockService.initiatePaymentCalled == true)
        #expect(mockService.lastTenancyId == "test-tenancy-id")
        #expect(mockService.lastPaymentMethod == .upiIntent)
        #expect(mockService.lastRentMonth == "2026-01")
    }
}
