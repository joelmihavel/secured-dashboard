/// OTPVerificationViewModelTests.swift
/// Flent Secured v2 - OTP Verification ViewModel Tests
///
/// Tests OTP entry, validation, verification flow, and resend logic

import Foundation
import Testing
@testable import Flent

// MARK: - Test Helpers

/// Helper extension to create AuthResult instances for testing
extension AuthResult {
    /// Creates a successful AuthResult for testing
    /// - Parameters:
    ///   - userId: The user ID (defaults to "test-user-id")
    ///   - isNewUser: Whether this is a new user (defaults to false)
    ///   - consentVerificationId: Optional consent verification ID
    ///   - consentStatus: Optional consent status
    ///   - message: The message (defaults to "Authentication successful")
    ///   - nextSteps: Optional array of next steps
    /// - Returns: A configured AuthResult for testing
    static func testSuccess(
        userId: String = "test-user-id",
        isNewUser: Bool = false,
        consentVerificationId: String? = nil,
        consentStatus: String? = nil,
        message: String = "Authentication successful",
        nextSteps: [String]? = nil
    ) -> AuthResult {
        AuthResult(
            success: true,
            data: AuthResultData(
                userId: userId,
                isNewUser: isNewUser,
                consentVerificationId: consentVerificationId,
                consentStatus: consentStatus,
                message: message,
                nextSteps: nextSteps
            ),
            error: nil
        )
    }

    /// Creates a failed AuthResult for testing
    /// - Parameter error: The error message
    /// - Returns: A configured AuthResult representing a failure
    static func testFailure(error: String = "Authentication failed") -> AuthResult {
        AuthResult(
            success: false,
            data: nil,
            error: error
        )
    }
}

@Suite("OTPVerificationViewModel Tests")
struct OTPVerificationViewModelTests {

    // MARK: - OTP Entry Validation

    @Test("Empty OTP is not complete")
    func emptyOTPNotComplete() {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())

        #expect(vm.isOTPComplete == false)
        #expect(vm.canVerify == false)
    }

    @Test("Partial OTP is not complete")
    func partialOTPNotComplete() {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())
        vm.otpDigits = ["1", "2", "3", "", "", ""]

        #expect(vm.isOTPComplete == false)
        #expect(vm.canVerify == false)
    }

    @Test("6-digit OTP is complete")
    func fullOTPIsComplete() {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())
        vm.otpDigits = ["1", "2", "3", "4", "5", "6"]

        #expect(vm.isOTPComplete == true)
        #expect(vm.otpCode == "123456")
        #expect(vm.canVerify == true)
    }

    @Test("OTP with non-numeric characters is not complete")
    func nonNumericOTPNotComplete() {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())
        vm.otpDigits = ["1", "2", "A", "4", "5", "6"]

        #expect(vm.isOTPComplete == false)
    }

    // MARK: - Digit Input Handling

    @Test("Handle paste of full OTP")
    func handleFullOTPPaste() {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())

        let focusResult = vm.handleDigitInput(at: 0, newValue: "123456")

        #expect(focusResult == nil) // No focus change, trigger verification
        #expect(vm.otpDigits == ["1", "2", "3", "4", "5", "6"])
    }

    @Test("Handle single digit input moves focus")
    func singleDigitMovesFocus() {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())

        // Note: handleDigitInput returns the next focus index but doesn't set the digit
        // The digit is set by SwiftUI TextField binding, this method just handles focus
        let focusResult = vm.handleDigitInput(at: 0, newValue: "1")

        #expect(focusResult == 1) // Move to next field
    }

    @Test("Backspace on empty field moves focus back")
    func backspaceMovesFocus() {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())
        vm.otpDigits = ["1", "2", "", "", "", ""]

        let focusResult = vm.handleBackspace(at: 2)

        #expect(focusResult == 1) // Move back to previous field
    }

    // MARK: - OTP Verification

    @Test("Successful OTP verification")
    @MainActor
    func successfulVerification() async {
        let mockAuth = MockAuthService()
        mockAuth.mockAuthResult = .testSuccess(
            userId: "test-user-id",
            isNewUser: true,
            consentVerificationId: "test-consent-id",
            consentStatus: "CONSENT_GIVEN",
            message: "Phone verified successfully",
            nextSteps: ["identity_verification_ready"]
        )

        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: mockAuth)
        vm.otpDigits = ["1", "2", "3", "4", "5", "6"]

        let result = await vm.verifyOTP()

        #expect(result != nil)
        #expect(result?.success == true)
        #expect(mockAuth.verifyOTPCalled == true)
        #expect(mockAuth.lastOTPVerified == "123456")
    }

    @Test("Failed OTP verification clears OTP and resets state")
    @MainActor
    func failedVerificationClearsOTP() async {
        let mockAuth = MockAuthService()
        mockAuth.mockAuthResult = .testFailure(error: "Invalid OTP")

        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: mockAuth)
        vm.otpDigits = ["1", "2", "3", "4", "5", "6"]

        let result = await vm.verifyOTP()

        #expect(result == nil)
        // OTP is cleared, and the didSet on otpDigits also clears error state
        #expect(vm.otpDigits == Array(repeating: "", count: 6))
        // Error is cleared when OTP changes (by design - see otpDigits didSet)
        #expect(vm.errorMessage == nil)
    }

    @Test("Cannot verify incomplete OTP")
    @MainActor
    func cannotVerifyIncompleteOTP() async {
        let mockAuth = MockAuthService()
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: mockAuth)
        vm.otpDigits = ["1", "2", "3", "", "", ""]

        let result = await vm.verifyOTP()

        #expect(result == nil)
        #expect(mockAuth.verifyOTPCalled == false)
        #expect(vm.errorMessage != nil)
    }

    // MARK: - Resend OTP

    @Test("Resend timer starts at 30 seconds")
    func resendTimerStartsCorrectly() {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())

        vm.startResendTimer()

        #expect(vm.resendCountdown == 30)
        #expect(vm.canResend == false)
    }

    @Test("Cannot resend during countdown")
    @MainActor
    func cannotResendDuringCountdown() async {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())
        vm.startResendTimer()

        let result = await vm.resendOTP()

        #expect(result == false)
    }

    // MARK: - Next Route Determination

    @Test("New user goes to name verification")
    @MainActor
    func newUserGoesToNameVerification() async {
        let mockAuth = MockAuthService()
        mockAuth.mockAuthResult = .testSuccess(
            userId: "test-user-id",
            isNewUser: true,
            consentVerificationId: "test-consent-id",
            consentStatus: "CONSENT_GIVEN",
            message: "Phone verified successfully",
            nextSteps: ["identity_verification_ready"]
        )

        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: mockAuth)
        vm.otpDigits = ["1", "2", "3", "4", "5", "6"]

        _ = await vm.verifyOTP()
        let nextRoute = vm.determineNextRoute()

        #expect(nextRoute == .nameVerification)
    }

    @Test("Existing user goes to name verification")
    @MainActor
    func existingUserGoesToNameVerification() async {
        let mockAuth = MockAuthService()
        mockAuth.mockAuthResult = .testSuccess(
            userId: "test-user-id",
            isNewUser: false,
            consentVerificationId: "test-consent-id",
            consentStatus: "CONSENT_GIVEN",
            message: "Welcome back!",
            nextSteps: ["profile_completion"]
        )

        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: mockAuth)
        vm.otpDigits = ["1", "2", "3", "4", "5", "6"]

        _ = await vm.verifyOTP()
        let nextRoute = vm.determineNextRoute()

        // Current implementation routes all users to name verification
        // App coordinator will determine final routing based on user profile
        #expect(nextRoute == .nameVerification)
    }

    @Test("No route when auth result is nil")
    @MainActor
    func noRouteWhenAuthResultNil() async {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())

        let nextRoute = vm.determineNextRoute()

        #expect(nextRoute == nil)
    }

    // MARK: - State Management

    @Test("Error clears when OTP changes")
    @MainActor
    func errorClearsOnOTPChange() async {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())

        // Set incomplete OTP - verifyOTP will set error without calling clearOTP
        vm.otpDigits = ["1", "2", "3", "", "", ""]

        // Trigger error state through incomplete OTP verification
        _ = await vm.verifyOTP()
        #expect(vm.errorMessage == "Please enter the complete 6-digit code")

        // Now change OTP digit - should clear error
        vm.otpDigits[3] = "4"

        #expect(vm.errorMessage == nil)
    }

    @Test("Reset clears all state")
    @MainActor
    func resetClearsState() async {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())

        // Set incomplete OTP - verifyOTP will set error without calling clearOTP
        vm.otpDigits = ["1", "2", "3", "", "", ""]

        // Trigger error state
        _ = await vm.verifyOTP()
        #expect(vm.errorMessage != nil)

        // Reset should clear everything
        vm.reset()

        #expect(vm.otpDigits == Array(repeating: "", count: 6))
        #expect(vm.errorMessage == nil)
    }

    // MARK: - AuthResult Data Access

    @Test("AuthResult provides userId through computed property")
    func authResultProvidesUserId() {
        let result = AuthResult.testSuccess(userId: "user-123")

        #expect(result.userId == "user-123")
        #expect(result.isNewUser == false)
    }

    @Test("AuthResult handles missing data gracefully")
    func authResultHandlesMissingData() {
        let result = AuthResult.testFailure(error: "Some error")

        #expect(result.userId == nil)
        #expect(result.isNewUser == false)
    }

    @Test("AuthResult preserves consent information")
    func authResultPreservesConsentInfo() {
        let result = AuthResult.testSuccess(
            userId: "user-456",
            isNewUser: true,
            consentVerificationId: "consent-789",
            consentStatus: "pending",
            nextSteps: ["verify_email", "upload_documents"]
        )

        #expect(result.data?.consentVerificationId == "consent-789")
        #expect(result.data?.consentStatus == "pending")
        #expect(result.data?.nextSteps == ["verify_email", "upload_documents"])
    }
}
