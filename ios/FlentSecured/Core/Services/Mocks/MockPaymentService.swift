/// MockPaymentService.swift
/// Flent Secured v2 - Mock Payment Service
///
/// Mock implementation of PaymentServiceProtocol for testing
/// Supports configurable responses and error simulation

import Foundation

// MARK: - Mock Payment Service

final class MockPaymentService: PaymentServiceProtocol {

    // MARK: - Configuration

    var simulatedDelay: TimeInterval = 0.1
    var shouldSucceed: Bool = true
    var errorToThrow: PaymentServiceError?

    // MARK: - Mock Data

    var mockPaymentInitiation: PaymentInitiation?
    var mockPaymentStatus: PaymentStatusData?
    var mockPaymentHistory: [PaymentData] = []
    var mockReceipt: ReceiptData?
    var mockHasPaymentForMonth: Bool = false

    // MARK: - Call Tracking

    private(set) var initiatePaymentCalled = false
    private(set) var lastTenancyId: String?
    private(set) var lastPaymentMethod: PaymentMethod?
    private(set) var lastRentMonth: String?
    private(set) var lastApplyCashback: Bool?

    private(set) var getPaymentStatusCalled = false
    private(set) var lastPaymentIdChecked: String?

    private(set) var getPaymentHistoryCalled = false
    private(set) var generateReceiptCalled = false
    private(set) var hasPaymentForMonthCalled = false

    // MARK: - PaymentServiceProtocol

    func initiatePayment(
        tenancyId: String,
        paymentMethod: PaymentMethod,
        rentMonth: String,
        applyCashback: Bool
    ) async throws -> PaymentInitiation {
        initiatePaymentCalled = true
        lastTenancyId = tenancyId
        lastPaymentMethod = paymentMethod
        lastRentMonth = rentMonth
        lastApplyCashback = applyCashback

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? PaymentServiceError.serverError("Mock error")
        }

        return mockPaymentInitiation ?? Self.createMockPaymentInitiation(
            rentMonth: rentMonth,
            applyCashback: applyCashback
        )
    }

    func getPaymentStatus(paymentId: String) async throws -> PaymentStatusData {
        getPaymentStatusCalled = true
        lastPaymentIdChecked = paymentId

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? PaymentServiceError.paymentNotFound
        }

        return mockPaymentStatus ?? PaymentStatusData(
            paymentId: paymentId,
            status: "success",
            settlementStatus: "processing",
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
    }

    func getPaymentHistory(tenancyId: String, limit: Int, offset: Int) async throws -> [PaymentData] {
        getPaymentHistoryCalled = true

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? PaymentServiceError.serverError("Mock error")
        }

        return mockPaymentHistory
    }

    func generateReceipt(paymentId: String) async throws -> ReceiptData {
        generateReceiptCalled = true

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? PaymentServiceError.serverError("Mock error")
        }

        return mockReceipt ?? ReceiptData(
            paymentId: paymentId,
            receiptNumber: "FLENT-\(Date().timeIntervalSince1970.description.prefix(10))",
            downloadUrl: "https://example.com/receipt/\(paymentId).pdf",
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )
    }

    func hasPaymentForMonth(tenancyId: String, rentMonth: String) async throws -> Bool {
        hasPaymentForMonthCalled = true

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? PaymentServiceError.serverError("Mock error")
        }

        return mockHasPaymentForMonth
    }

    // MARK: - Test Helpers

    func reset() {
        initiatePaymentCalled = false
        lastTenancyId = nil
        lastPaymentMethod = nil
        lastRentMonth = nil
        lastApplyCashback = nil
        getPaymentStatusCalled = false
        lastPaymentIdChecked = nil
        getPaymentHistoryCalled = false
        generateReceiptCalled = false
        hasPaymentForMonthCalled = false
        shouldSucceed = true
        errorToThrow = nil
        mockPaymentInitiation = nil
        mockPaymentStatus = nil
        mockPaymentHistory = []
        mockReceipt = nil
        mockHasPaymentForMonth = false
    }

    // MARK: - Mock Data Factories

    static func createMockPaymentInitiation(
        rentMonth: String,
        applyCashback: Bool,
        amount: Int = 4000000, // 40,000 in paise
        cashbackAvailable: Int = 50000 // 500 in paise
    ) -> PaymentInitiation {
        let paymentId = UUID().uuidString
        let txnId = "FLENT_\(Int(Date().timeIntervalSince1970))_\(String(paymentId.prefix(8)))"

        let cashbackApplied = applyCashback ? min(cashbackAvailable, amount) : 0
        let total = amount - cashbackApplied

        return PaymentInitiation(
            paymentId: paymentId,
            txnId: txnId,
            amountPaise: amount,
            pgFeePaise: 0,
            cashbackAppliedPaise: cashbackApplied,
            totalPaise: total,
            payuParams: PayUParams(
                key: "test_merchant_key",
                txnid: txnId,
                amount: String(format: "%.2f", Double(total) / 100.0),
                productinfo: "Rent payment for \(rentMonth)",
                firstname: "Amit",
                email: "\(paymentId)@flent.app",
                phone: "9876543210",
                surl: "https://example.com/webhook/success",
                furl: "https://example.com/webhook/failure",
                hash: "mock_hash_\(UUID().uuidString)",
                udf1: paymentId,
                udf2: rentMonth,
                udf3: nil
            ),
            intentUrl: "https://sandboxsecure.payu.in/processTransaction?txnid=\(txnId)"
        )
    }

    static func createMockPaymentData(
        status: PaymentStatus = .success,
        rentMonth: String = "2026-01"
    ) -> PaymentData {
        PaymentData(
            id: UUID().uuidString,
            tenancyId: UUID().uuidString,
            rentAmountPaise: 4000000,
            pgFeePaise: 0,
            cashbackAppliedPaise: 50000,
            totalAmountPaise: 3950000,
            status: status.rawValue,
            paymentMethod: "upi_intent",
            paymentMonth: rentMonth,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            completedAt: status == .success ? ISO8601DateFormatter().string(from: Date()) : nil
        )
    }

    // MARK: - Private Helpers

    private func simulateDelay() async throws {
        if simulatedDelay > 0 {
            try await Task.sleep(nanoseconds: UInt64(simulatedDelay * 1_000_000_000))
        }
    }
}
