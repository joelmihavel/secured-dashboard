/// OTPVerificationViewModelTests.swift
/// Flent Secured v2 - OTP Verification ViewModel Tests
///
/// Comprehensive tests for OTP verification, timer logic, and authentication flow.
/// Critical for secure user authentication.

import XCTest
@testable import Flent

@MainActor
final class OTPVerificationViewModelTests: XCTestCase {

    // MARK: - Properties

    private var sut: OTPVerificationViewModel!
    private var mockAuthService: MockAuthService!
    private let testPhone = "+919876543210"

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockAuthService = MockAuthService()
        mockAuthService.simulatedDelay = 0
        sut = OTPVerificationViewModel(phone: testPhone, authService: mockAuthService)
    }

    override func tearDown() async throws {
        sut = nil
        mockAuthService = nil
        try await super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitialState() {
        XCTAssertEqual(sut.phone, testPhone)
        XCTAssertEqual(sut.otpDigits, ["", "", "", "", "", ""])  // 6-digit OTP per Figma
        XCTAssertEqual(sut.state, .idle)
        XCTAssertFalse(sut.isOTPComplete)
        XCTAssertFalse(sut.isVerifying)
        XCTAssertFalse(sut.isResending)
        XCTAssertNil(sut.errorMessage)
        XCTAssertTrue(sut.consentForMobile360)  // Default consent is true
    }

    // MARK: - OTP Input Tests

    func testOTPCode() {
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        XCTAssertEqual(sut.otpCode, "123456")
    }

    func testIsOTPComplete_AllDigitsFilled() {
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        XCTAssertTrue(sut.isOTPComplete)
    }

    func testIsOTPComplete_PartiallyFilled() {
        sut.otpDigits = ["1", "2", "", "4", "5", "6"]
        XCTAssertFalse(sut.isOTPComplete)
    }

    func testIsOTPComplete_Empty() {
        XCTAssertFalse(sut.isOTPComplete)
    }

    func testIsOTPComplete_NonNumericCharacters() {
        sut.otpDigits = ["a", "b", "c", "d", "e", "f"]
        XCTAssertFalse(sut.isOTPComplete)
    }

    func testHandleDigitInput_SingleDigit() {
        let nextFocus = sut.handleDigitInput(at: 0, newValue: "1")

        XCTAssertEqual(sut.otpDigits[0], "1")
        XCTAssertEqual(nextFocus, 1)  // Should move focus to next field
    }

    func testHandleDigitInput_LastDigit() {
        sut.otpDigits = ["1", "2", "3", "4", "5", ""]
        let nextFocus = sut.handleDigitInput(at: 5, newValue: "6")

        XCTAssertEqual(sut.otpDigits[5], "6")
        XCTAssertNil(nextFocus)  // No next field
    }

    func testHandleDigitInput_FullOTPPaste() {
        let nextFocus = sut.handleDigitInput(at: 0, newValue: "123456")

        XCTAssertEqual(sut.otpDigits, ["1", "2", "3", "4", "5", "6"])
        XCTAssertNil(nextFocus)  // Should trigger verification, no focus change
    }

    func testHandleDigitInput_MultipleDigits_TakesLast() {
        let nextFocus = sut.handleDigitInput(at: 0, newValue: "12")

        XCTAssertEqual(sut.otpDigits[0], "2")  // Takes last digit
        XCTAssertEqual(nextFocus, 1)
    }

    func testHandleBackspace_WithContent() {
        sut.otpDigits = ["1", "", "", "", "", ""]
        let previousFocus = sut.handleBackspace(at: 1)

        XCTAssertEqual(previousFocus, 0)  // Should move focus to previous field
    }

    func testHandleBackspace_AtFirstField() {
        let previousFocus = sut.handleBackspace(at: 0)

        XCTAssertNil(previousFocus)  // No previous field
    }

    func testClearOTP() {
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        sut.clearOTP()

        XCTAssertEqual(sut.otpDigits, ["", "", "", "", "", ""])
    }

    // MARK: - Verification Tests

    func testVerifyOTP_Success_NewUser() async {
        // Given
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        mockAuthService.shouldSucceed = true
        mockAuthService.mockAuthResult = AuthResult(
            success: true,
            data: AuthResult.AuthResultData(
                userId: "test-user-id",
                isNewUser: true,
                consentVerificationId: "test-consent-id",
                consentStatus: "CONSENT_GIVEN",
                message: "Verified",
                nextSteps: nil
            ),
            error: nil
        )

        // When
        let result = await sut.verifyOTP()

        // Then
        XCTAssertNotNil(result)
        XCTAssertTrue(result!.success)
        XCTAssertTrue(result!.isNewUser)
        XCTAssertTrue(mockAuthService.verifyOTPCalled)
        XCTAssertEqual(mockAuthService.lastOTPVerified, "123456")
        XCTAssertTrue(mockAuthService.lastConsentValue ?? false)

        if case .verified(let authResult) = sut.state {
            XCTAssertTrue(authResult.success)
        } else {
            XCTFail("Expected verified state")
        }
    }

    func testVerifyOTP_Success_ExistingUser() async {
        // Given
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        mockAuthService.shouldSucceed = true
        mockAuthService.mockAuthResult = AuthResult(
            success: true,
            data: AuthResult.AuthResultData(
                userId: "test-user-id",
                isNewUser: false,
                consentVerificationId: nil,
                consentStatus: nil,
                message: "Welcome back",
                nextSteps: nil
            ),
            error: nil
        )

        // When
        let result = await sut.verifyOTP()

        // Then
        XCTAssertNotNil(result)
        XCTAssertFalse(result!.isNewUser)
    }

    func testVerifyOTP_Failure_InvalidOTP() async {
        // Given
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        mockAuthService.shouldSucceed = false
        mockAuthService.errorToThrow = .invalidOTP

        // When
        let result = await sut.verifyOTP()

        // Then
        XCTAssertNil(result)
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertEqual(sut.otpDigits, ["", "", "", "", "", ""])  // OTP should be cleared on failure
    }

    func testVerifyOTP_Failure_ExpiredOTP() async {
        // Given
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        mockAuthService.shouldSucceed = false
        mockAuthService.errorToThrow = .otpExpired

        // When
        let result = await sut.verifyOTP()

        // Then
        XCTAssertNil(result)
        XCTAssertNotNil(sut.errorMessage)
    }

    func testVerifyOTP_IncompleteOTP() async {
        // Given
        sut.otpDigits = ["1", "2", "3", "", "", ""]

        // When
        let result = await sut.verifyOTP()

        // Then
        XCTAssertNil(result)
        XCTAssertFalse(mockAuthService.verifyOTPCalled)

        if case .error(let message) = sut.state {
            XCTAssertEqual(message, "Please enter the complete 6-digit code")
        } else {
            XCTFail("Expected error state")
        }
    }

    func testVerifyOTP_WithoutConsent() async {
        // Given
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        sut.consentForMobile360 = false

        // When
        let result = await sut.verifyOTP()

        // Then
        XCTAssertNil(result)
        XCTAssertFalse(mockAuthService.verifyOTPCalled)

        if case .error(let message) = sut.state {
            XCTAssertEqual(message, "Please allow identity verification to continue")
        } else {
            XCTFail("Expected error state")
        }
    }

    func testVerifyOTP_SetsVerifyingState() async {
        // Given
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        mockAuthService.simulatedDelay = 0.5

        // When
        let task = Task {
            await sut.verifyOTP()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)

        // Then
        XCTAssertTrue(sut.isVerifying)
        XCTAssertFalse(sut.canVerify)

        _ = await task.value
    }

    // MARK: - Resend OTP Tests

    func testResendOTP_CannotResendWhenTimerRunning() async {
        // Given - Start timer (sets canResend = false)
        sut.startResendTimer()
        XCTAssertFalse(sut.canResend)

        // When
        let result = await sut.resendOTP()

        // Then
        XCTAssertFalse(result)
        XCTAssertFalse(mockAuthService.sendOTPCalled)
    }

    func testResendOTP_InitiallyCannotResend() async {
        // Given - Fresh ViewModel (canResend is false by default after timer starts)
        sut.startResendTimer()

        // When
        let result = await sut.resendOTP()

        // Then
        XCTAssertFalse(result)
        XCTAssertFalse(mockAuthService.sendOTPCalled)
    }

    // Note: Testing successful resend would require waiting 30+ seconds for timer
    // This test verifies the timer mechanism works correctly instead
    func testResendTimer_SetsCanResendFalse() {
        // When
        sut.startResendTimer()

        // Then
        XCTAssertFalse(sut.canResend)
        XCTAssertEqual(sut.resendCountdown, 30)
    }

    // MARK: - Timer Tests

    func testStartResendTimer() {
        // When
        sut.startResendTimer()

        // Then
        XCTAssertEqual(sut.resendCountdown, 30)
        XCTAssertFalse(sut.canResend)
    }

    func testResendTimerCountdown() async throws {
        // Given
        sut.startResendTimer()

        // Wait for a couple of ticks
        try await Task.sleep(nanoseconds: 2_500_000_000)  // 2.5 seconds

        // Then
        XCTAssertLessThan(sut.resendCountdown, 30)
        XCTAssertFalse(sut.canResend)
    }

    // MARK: - Consent Tests

    func testCanVerify_WithConsent() {
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        sut.consentForMobile360 = true

        XCTAssertTrue(sut.canVerify)
    }

    func testCanVerify_WithoutConsent() {
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        sut.consentForMobile360 = false

        XCTAssertFalse(sut.canVerify)
    }

    func testConsentErrorMessage() {
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        sut.consentForMobile360 = false

        XCTAssertNotNil(sut.consentErrorMessage)
        XCTAssertEqual(sut.consentErrorMessage, "Please allow identity verification to continue")
    }

    func testConsentErrorMessage_WhenOTPIncomplete() {
        sut.otpDigits = ["1", "2", "", "", "", ""]
        sut.consentForMobile360 = false

        // Error should only show when OTP is complete
        XCTAssertNil(sut.consentErrorMessage)
    }

    // MARK: - State Management Tests

    func testTypingClearsError() async {
        // Given - Trigger error via API (incomplete OTP verification)
        sut.otpDigits = ["1", "2", "3", "", "", ""]  // Incomplete
        _ = await sut.verifyOTP()
        XCTAssertNotNil(sut.errorMessage)

        // When
        sut.otpDigits = ["1", "", "", "", "", ""]

        // Then
        XCTAssertEqual(sut.state, .idle)
        XCTAssertNil(sut.errorMessage)
    }

    func testReset() async {
        // Given - Trigger error via API
        sut.otpDigits = ["1", "2", "3", "", "", ""]  // Incomplete
        _ = await sut.verifyOTP()
        XCTAssertNotNil(sut.errorMessage)

        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]  // Set some digits

        // When
        sut.reset()

        // Then
        XCTAssertEqual(sut.state, .idle)
        XCTAssertEqual(sut.otpDigits, ["", "", "", "", "", ""])
    }

    // MARK: - Computed Properties Tests

    func testAuthResult() async {
        // Given - Verify OTP successfully to get authResult
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        mockAuthService.shouldSucceed = true
        mockAuthService.mockAuthResult = AuthResult(
            success: true,
            data: AuthResult.AuthResultData(
                userId: "test-id",
                isNewUser: true,
                consentVerificationId: nil,
                consentStatus: nil,
                message: "OK",
                nextSteps: nil
            ),
            error: nil
        )

        _ = await sut.verifyOTP()

        // Then
        XCTAssertNotNil(sut.authResult)
        XCTAssertTrue(sut.authResult!.success)
    }

    func testAuthResult_WhenNotVerified() {
        // Initially - no auth result
        XCTAssertEqual(sut.state, .idle)
        XCTAssertNil(sut.authResult)
    }

    // MARK: - Route Determination Tests

    func testDetermineNextRoute_NewUser() async {
        // Given - Verify OTP successfully as new user
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        mockAuthService.shouldSucceed = true
        mockAuthService.mockAuthResult = AuthResult(
            success: true,
            data: AuthResult.AuthResultData(
                userId: "test-id",
                isNewUser: true,
                consentVerificationId: nil,
                consentStatus: nil,
                message: "OK",
                nextSteps: nil
            ),
            error: nil
        )

        _ = await sut.verifyOTP()

        // When
        let route = sut.determineNextRoute()

        // Then
        XCTAssertEqual(route, .nameVerification)
    }

    func testDetermineNextRoute_ExistingUser() async {
        // Given - Verify OTP successfully as existing user
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        mockAuthService.shouldSucceed = true
        mockAuthService.mockAuthResult = AuthResult(
            success: true,
            data: AuthResult.AuthResultData(
                userId: "test-id",
                isNewUser: false,
                consentVerificationId: nil,
                consentStatus: nil,
                message: "OK",
                nextSteps: nil
            ),
            error: nil
        )

        _ = await sut.verifyOTP()

        // When
        let route = sut.determineNextRoute()

        // Then
        XCTAssertEqual(route, .nameVerification)
    }

    func testDetermineNextRoute_NoAuthResult() {
        // Initially - no auth result
        XCTAssertEqual(sut.state, .idle)
        XCTAssertNil(sut.determineNextRoute())
    }

    // MARK: - Edge Cases

    func testVerifyWithServerError() async {
        // Given
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        mockAuthService.shouldSucceed = false
        mockAuthService.errorToThrow = .serverError("Internal server error")

        // When
        let result = await sut.verifyOTP()

        // Then
        XCTAssertNil(result)
        XCTAssertNotNil(sut.errorMessage)
    }

    func testMultipleVerificationAttempts() async {
        // First attempt - failure
        sut.otpDigits = ["1", "2", "3", "4", "5", "6"]
        mockAuthService.shouldSucceed = false
        mockAuthService.errorToThrow = .invalidOTP

        _ = await sut.verifyOTP()

        XCTAssertEqual(sut.otpDigits, ["", "", "", "", "", ""])  // Should be cleared

        // Second attempt - success
        sut.otpDigits = ["5", "6", "7", "8", "9", "0"]
        mockAuthService.shouldSucceed = true
        mockAuthService.errorToThrow = nil
        mockAuthService.reset()

        let result = await sut.verifyOTP()

        XCTAssertNotNil(result)
        XCTAssertTrue(result!.success)
    }
}
