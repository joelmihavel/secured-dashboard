/// TestModeAuthService.swift
/// Flent Secured v2 - Test Mode Authentication Service
///
/// Special auth service for UI testing that handles multiple test phone numbers
/// Each test number represents a different user status (COMPLETE, QUALIFIED, etc.)
///
/// IMPORTANT: This file is only included in DEBUG builds and is automatically
/// stripped from production builds via the #if DEBUG compiler flag.

#if DEBUG
import Foundation

// MARK: - Test Phone Numbers

/// Test phone numbers for different user scenarios
/// These bypass real Twilio/Supabase auth and return mock responses
enum TestPhoneNumber: String, CaseIterable {
    case success = "+919999999999"      // Basic test user (new user flow)
    case qualified = "+919999999991"    // QUALIFIED user (limited payment access)
    case complete = "+919999999992"     // COMPLETE user (full payment access)
    case waitlisted = "+919999999993"   // Waitlisted user
    case notEligible = "+919999999994"  // Not eligible user

    /// The test OTP that works for all test numbers
    static let testOTP = "000000"

    /// Initialize from any phone format
    init?(phone: String) {
        // Normalize phone number
        let normalized = phone.hasPrefix("+91") ? phone : "+91\(phone.suffix(10))"
        self.init(rawValue: normalized)
    }

    /// The user status for this test phone
    var userStatus: UserStatus {
        switch self {
        case .success:
            return .signedUp // New user, needs onboarding
        case .qualified:
            return .qualified
        case .complete:
            return .complete
        case .waitlisted:
            return .waitlisted
        case .notEligible:
            return .notEligible
        }
    }

    /// Whether this is a new user (needs onboarding)
    var isNewUser: Bool {
        switch self {
        case .success, .waitlisted, .notEligible:
            return true
        case .qualified, .complete:
            return false
        }
    }

    /// Description for logging
    var description: String {
        switch self {
        case .success: return "SUCCESS (new user)"
        case .qualified: return "QUALIFIED"
        case .complete: return "COMPLETE"
        case .waitlisted: return "WAITLISTED"
        case .notEligible: return "NOT_ELIGIBLE"
        }
    }
}

// MARK: - Test Mode Auth Service

/// Auth service that handles test phone numbers for UI testing
/// Bypasses real authentication and returns predictable mock responses
final class TestModeAuthService: AuthServiceProtocol {

    // MARK: - State

    /// Currently authenticated test phone (if any)
    private(set) var currentTestPhone: TestPhoneNumber?

    /// The raw phone number used for auth
    private(set) var currentPhoneNumber: String?

    /// User ID (generated on auth)
    private(set) var currentUserId: String?

    /// Simulated delay for realistic UI testing
    var simulatedDelay: TimeInterval = 0.3

    // MARK: - AuthServiceProtocol

    var isAuthenticated: Bool {
        get async {
            currentTestPhone != nil
        }
    }

    func sendOTP(to phone: String) async throws -> OTPSendResult {
        print("[TestModeAuth] sendOTP to: \(phone)")

        // Check if this is a test phone number
        guard let testPhone = TestPhoneNumber(phone: phone) else {
            print("[TestModeAuth] ⚠️ Not a test phone number, rejecting")
            throw AuthError.invalidPhone
        }

        // Store phone for verification
        currentPhoneNumber = phone

        // Simulate network delay
        try await Task.sleep(nanoseconds: UInt64(simulatedDelay * 1_000_000_000))

        print("[TestModeAuth] ✓ OTP sent for \(testPhone.description)")

        return OTPSendResult(
            success: true,
            data: OTPSendResult.OTPSendData(
                verificationSid: "test_sid_\(UUID().uuidString.prefix(8))",
                status: "pending",
                channel: "sms",
                phoneMasked: "XXXXXX\(phone.suffix(4))",
                message: "Test OTP sent successfully"
            ),
            error: nil
        )
    }

    func verifyOTP(phone: String, otp: String, consentForMobile360: Bool) async throws -> AuthResult {
        print("[TestModeAuth] verifyOTP for: \(phone), OTP: \(otp)")

        // Check if this is a test phone
        guard let testPhone = TestPhoneNumber(phone: phone) else {
            print("[TestModeAuth] ⚠️ Not a test phone number")
            throw AuthError.invalidPhone
        }

        // Check OTP
        guard otp == TestPhoneNumber.testOTP else {
            print("[TestModeAuth] ✗ Invalid OTP (expected \(TestPhoneNumber.testOTP))")
            throw AuthError.invalidOTP
        }

        // Simulate network delay
        try await Task.sleep(nanoseconds: UInt64(simulatedDelay * 1_000_000_000))

        // Generate user ID
        let userId = "test_user_\(testPhone.rawValue.suffix(4))_\(UUID().uuidString.prefix(8))"

        // Store auth state
        currentTestPhone = testPhone
        currentPhoneNumber = phone
        currentUserId = userId

        print("[TestModeAuth] ✓ Authenticated as \(testPhone.description), userId: \(userId)")

        return AuthResult(
            success: true,
            data: AuthResult.AuthResultData(
                userId: userId,
                isNewUser: testPhone.isNewUser,
                consentVerificationId: "test_consent_\(UUID().uuidString.prefix(8))",
                consentStatus: consentForMobile360 ? "CONSENT_GIVEN" : "CONSENT_DECLINED",
                message: "Test authentication successful",
                nextSteps: testPhone.isNewUser ? ["identity_verification_ready"] : []
            ),
            error: nil
        )
    }

    func getCurrentSession() async -> SessionInfo? {
        guard currentTestPhone != nil,
              let userId = currentUserId,
              let phone = currentPhoneNumber else {
            return nil
        }

        return SessionInfo(
            accessToken: "test_access_token_\(UUID().uuidString)",
            refreshToken: "test_refresh_token_\(UUID().uuidString)",
            expiresAt: Date().addingTimeInterval(3600).timeIntervalSince1970,
            user: UserInfo(
                id: userId,
                phone: phone,
                email: nil,
                createdAt: ISO8601DateFormatter().string(from: Date())
            )
        )
    }

    func signOut() async throws {
        print("[TestModeAuth] signOut")

        // Simulate network delay
        try await Task.sleep(nanoseconds: UInt64(simulatedDelay * 1_000_000_000))

        // Clear state
        currentTestPhone = nil
        currentPhoneNumber = nil
        currentUserId = nil

        print("[TestModeAuth] ✓ Signed out")
    }

    // MARK: - Test Helpers

    /// Reset all state
    func reset() {
        currentTestPhone = nil
        currentPhoneNumber = nil
        currentUserId = nil
    }

    /// Force authenticate as a specific test user (for UI tests)
    func forceAuthenticate(as testPhone: TestPhoneNumber) {
        currentTestPhone = testPhone
        currentPhoneNumber = testPhone.rawValue
        currentUserId = "test_user_\(testPhone.rawValue.suffix(4))_forced"
        print("[TestModeAuth] Force authenticated as \(testPhone.description)")
    }
}
#endif
