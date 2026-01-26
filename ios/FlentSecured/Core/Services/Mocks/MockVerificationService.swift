/// MockVerificationService.swift
/// Flent Secured v2 - Mock Verification Service
///
/// Mock implementation of VerificationServiceProtocol for testing
/// Supports configurable responses and error simulation

import Foundation

// MARK: - Mock Verification Service

final class MockVerificationService: VerificationServiceProtocol {

    // MARK: - Configuration

    var simulatedDelay: TimeInterval = 0.1
    var shouldSucceed: Bool = true
    var errorToThrow: VerificationServiceError?

    // MARK: - Mock Data

    var mockBankResult: BankVerificationResult?
    var mockOperators: [UtilityOperator] = []
    var mockUtilityResult: UtilityVerificationResult?
    var mockInviteResult: LandlordInviteResult?
    var mockVerificationStatus: VerificationStatus?

    // MARK: - Call Tracking

    private(set) var verifyBankCalled = false
    private(set) var lastAccountNumber: String?
    private(set) var lastIFSC: String?
    private(set) var lastPartyType: PartyType?

    private(set) var getOperatorsCalled = false

    private(set) var verifyUtilityCalled = false
    private(set) var lastConsumerNumber: String?
    private(set) var lastOperatorCode: String?

    private(set) var sendInviteCalled = false
    private(set) var lastInviteChannel: InviteChannel?

    private(set) var getVerificationStatusCalled = false

    // MARK: - VerificationServiceProtocol

    func verifyBank(
        tenancyId: String,
        accountHolderName: String,
        accountNumber: String,
        ifscCode: String,
        partyType: PartyType
    ) async throws -> BankVerificationResult {
        verifyBankCalled = true
        lastAccountNumber = accountNumber
        lastIFSC = ifscCode
        lastPartyType = partyType

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? VerificationServiceError.bankVerificationFailed("Mock failure")
        }

        return mockBankResult ?? Self.createMockBankResult(
            accountNumber: accountNumber,
            ifscCode: ifscCode,
            name: accountHolderName
        )
    }

    func getUtilityOperators() async throws -> [UtilityOperator] {
        getOperatorsCalled = true

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? VerificationServiceError.serverError("Mock error")
        }

        return mockOperators.isEmpty ? Self.createMockOperators() : mockOperators
    }

    func verifyUtility(
        tenancyId: String,
        consumerNumber: String,
        operatorCode: String
    ) async throws -> UtilityVerificationResult {
        verifyUtilityCalled = true
        lastConsumerNumber = consumerNumber
        lastOperatorCode = operatorCode

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? VerificationServiceError.utilityVerificationFailed("Mock failure")
        }

        return mockUtilityResult ?? Self.createMockUtilityResult()
    }

    func sendLandlordInvite(
        tenancyId: String,
        channel: InviteChannel
    ) async throws -> LandlordInviteResult {
        sendInviteCalled = true
        lastInviteChannel = channel

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? VerificationServiceError.inviteFailed("Mock failure")
        }

        return mockInviteResult ?? Self.createMockInviteResult(channel: channel)
    }

    func getVerificationStatus(tenancyId: String) async throws -> VerificationStatus {
        getVerificationStatusCalled = true

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? VerificationServiceError.tenancyNotFound
        }

        return mockVerificationStatus ?? VerificationStatus(
            tenancyId: tenancyId,
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false,
            bankVerificationDate: ISO8601DateFormatter().string(from: Date()),
            utilityVerificationDate: ISO8601DateFormatter().string(from: Date()),
            landlordApprovalDate: nil
        )
    }

    // MARK: - Test Helpers

    func reset() {
        verifyBankCalled = false
        lastAccountNumber = nil
        lastIFSC = nil
        lastPartyType = nil
        getOperatorsCalled = false
        verifyUtilityCalled = false
        lastConsumerNumber = nil
        lastOperatorCode = nil
        sendInviteCalled = false
        lastInviteChannel = nil
        getVerificationStatusCalled = false
        shouldSucceed = true
        errorToThrow = nil
        mockBankResult = nil
        mockOperators = []
        mockUtilityResult = nil
        mockInviteResult = nil
        mockVerificationStatus = nil
    }

    // MARK: - Mock Data Factories

    static func createMockBankResult(
        accountNumber: String,
        ifscCode: String,
        name: String,
        verified: Bool = true
    ) -> BankVerificationResult {
        let maskedAccount = String(repeating: "X", count: max(0, accountNumber.count - 4)) +
            accountNumber.suffix(4)

        return BankVerificationResult(
            bankAccountId: UUID().uuidString,
            verified: verified,
            accountNumberMasked: maskedAccount,
            ifscCode: ifscCode,
            verifiedName: name.uppercased(),
            nameMatchScore: verified ? 92 : 45,
            nameMatchThreshold: 80,
            verificationStatus: verified ? "SUCCESS" : "FAILED",
            bankName: "HDFC BANK",
            branch: "WHITEFIELD",
            message: verified ? "Bank account verified successfully" : "Name mismatch"
        )
    }

    static func createMockOperators() -> [UtilityOperator] {
        [
            UtilityOperator(operatorCode: "BESCOM", operatorName: "BESCOM - Bangalore", state: "Karnataka"),
            UtilityOperator(operatorCode: "MSEDCL", operatorName: "MSEDCL - Maharashtra", state: "Maharashtra"),
            UtilityOperator(operatorCode: "TNEB", operatorName: "TNEB - Tamil Nadu", state: "Tamil Nadu"),
            UtilityOperator(operatorCode: "TPDDL", operatorName: "Tata Power DDL - Delhi", state: "Delhi"),
            UtilityOperator(operatorCode: "BSES", operatorName: "BSES - Delhi", state: "Delhi"),
            UtilityOperator(operatorCode: "CESC", operatorName: "CESC - Kolkata", state: "West Bengal"),
            UtilityOperator(operatorCode: "DGVCL", operatorName: "DGVCL - Gujarat", state: "Gujarat")
        ]
    }

    static func createMockUtilityResult(verified: Bool = true) -> UtilityVerificationResult {
        UtilityVerificationResult(
            verificationId: UUID().uuidString,
            verified: verified,
            nameVerified: verified,
            addressVerified: verified,
            consumerName: "RAJESH GUPTA",
            landlordName: "Rajesh Gupta",
            nameMatchScore: verified ? 92 : 40,
            addressMatchScore: verified ? 78 : 30,
            matchingMethod: "gemini_ai",
            nameReasoning: verified ? "Names match with minor variation in case" : "Names do not match",
            addressReasoning: verified ? "Pincode and locality match" : "Address mismatch",
            message: verified ? "Ownership verified successfully" : "Verification failed"
        )
    }

    static func createMockInviteResult(channel: InviteChannel) -> LandlordInviteResult {
        LandlordInviteResult(
            inviteId: UUID().uuidString,
            status: "sent",
            sentVia: channel.rawValue,
            expiresAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(7 * 24 * 3600)),
            message: "Invitation sent successfully",
            inviteLink: "https://app.flent.in/invite/\(UUID().uuidString)"
        )
    }

    // MARK: - Private Helpers

    private func simulateDelay() async throws {
        if simulatedDelay > 0 {
            try await Task.sleep(nanoseconds: UInt64(simulatedDelay * 1_000_000_000))
        }
    }
}
