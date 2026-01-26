/// MockAuthService.swift
/// Flent Secured v2 - Mock Authentication Service
///
/// Mock implementation of AuthServiceProtocol for testing
/// Supports configurable responses and error simulation

import Foundation

// MARK: - Mock Auth Service

final class MockAuthService: AuthServiceProtocol {

    // MARK: - Configuration

    /// Simulated delay for async operations (seconds)
    var simulatedDelay: TimeInterval = 0.1

    /// Whether to simulate success or failure
    var shouldSucceed: Bool = true

    /// Custom error to throw on failure
    var errorToThrow: AuthError?

    /// Mock OTP send result
    var mockOTPResult: OTPSendResult?

    /// Mock auth result
    var mockAuthResult: AuthResult?

    /// Mock session
    var mockSession: SessionInfo?

    /// Whether user is authenticated
    var mockIsAuthenticated: Bool = false

    // MARK: - Call Tracking

    private(set) var sendOTPCalled = false
    private(set) var lastPhoneSent: String?

    private(set) var verifyOTPCalled = false
    private(set) var lastOTPVerified: String?
    private(set) var lastConsentValue: Bool?

    private(set) var signOutCalled = false
    private(set) var getCurrentSessionCalled = false

    // MARK: - Test Accounts

    /// Test phone numbers for different scenarios
    static let testPhoneSuccess = "+919999999999"
    static let testPhoneQualified = "+919999999991"
    static let testPhoneComplete = "+919999999992"
    static let testPhoneWaitlisted = "+919999999993"
    static let testPhoneNotEligible = "+919999999994"
    static let testOTP = "000000"

    // MARK: - AuthServiceProtocol

    var isAuthenticated: Bool {
        get async {
            mockIsAuthenticated
        }
    }

    func sendOTP(to phone: String) async throws -> OTPSendResult {
        sendOTPCalled = true
        lastPhoneSent = phone

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? AuthError.serverError("Mock error")
        }

        return mockOTPResult ?? OTPSendResult(
            success: true,
            data: OTPSendResult.OTPSendData(
                verificationSid: "mock_sid_\(UUID().uuidString)",
                status: "pending",
                channel: "sms",
                phoneMasked: "XXXXXX\(phone.suffix(4))",
                message: "OTP sent successfully"
            ),
            error: nil
        )
    }

    func verifyOTP(phone: String, otp: String, consentForMobile360: Bool) async throws -> AuthResult {
        verifyOTPCalled = true
        lastOTPVerified = otp
        lastConsentValue = consentForMobile360

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? AuthError.invalidOTP
        }

        // Return appropriate mock result based on phone number
        if let result = mockAuthResult {
            return result
        }

        let isNew: Bool
        switch phone {
        case Self.testPhoneQualified, Self.testPhoneComplete:
            isNew = false
        default:
            isNew = true
        }

        return AuthResult(
            success: true,
            data: AuthResult.AuthResultData(
                userId: UUID().uuidString,
                isNewUser: isNew,
                consentVerificationId: "mock_consent_\(UUID().uuidString)",
                consentStatus: "CONSENT_GIVEN",
                message: "Phone verified successfully",
                nextSteps: ["identity_verification_ready"]
            ),
            error: nil
        )
    }

    func getCurrentSession() async -> SessionInfo? {
        getCurrentSessionCalled = true
        return mockSession
    }

    func signOut() async throws {
        signOutCalled = true

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? AuthError.serverError("Sign out failed")
        }

        mockIsAuthenticated = false
        mockSession = nil
    }

    // MARK: - Test Helpers

    func reset() {
        sendOTPCalled = false
        lastPhoneSent = nil
        verifyOTPCalled = false
        lastOTPVerified = nil
        lastConsentValue = nil
        signOutCalled = false
        getCurrentSessionCalled = false
        shouldSucceed = true
        errorToThrow = nil
        mockOTPResult = nil
        mockAuthResult = nil
        mockSession = nil
        mockIsAuthenticated = false
    }

    func simulateAuthenticated(phone: String = testPhoneSuccess) {
        mockIsAuthenticated = true
        mockSession = createMockSession(phone: phone)
    }

    // MARK: - Private Helpers

    private func simulateDelay() async throws {
        if simulatedDelay > 0 {
            try await Task.sleep(nanoseconds: UInt64(simulatedDelay * 1_000_000_000))
        }
    }

    private func createMockSession(phone: String) -> SessionInfo {
        SessionInfo(
            accessToken: "mock_access_token_\(UUID().uuidString)",
            refreshToken: "mock_refresh_token_\(UUID().uuidString)",
            expiresAt: Date().addingTimeInterval(3600).timeIntervalSince1970,
            user: UserInfo(
                id: UUID().uuidString,
                phone: phone,
                email: nil,
                createdAt: ISO8601DateFormatter().string(from: Date())
            )
        )
    }
}
