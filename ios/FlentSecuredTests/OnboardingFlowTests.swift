/// OnboardingFlowTests.swift
/// Flent Secured v2 - Onboarding Flow Tests
///
/// Tests for the complete onboarding flow including splash, phone entry, and OTP verification.
/// Validates user journey from app launch to authentication.

import XCTest
@testable import Flent

@MainActor
final class OnboardingFlowTests: XCTestCase {

    // MARK: - Properties

    private var mockAuthService: MockAuthService!
    private var mockUserService: MockUserService!

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockAuthService = MockAuthService()
        mockAuthService.simulatedDelay = 0
        mockUserService = MockUserService()
        mockUserService.simulatedDelay = 0
    }

    override func tearDown() async throws {
        mockAuthService = nil
        mockUserService = nil
        try await super.tearDown()
    }

    // MARK: - Phone Entry Flow Tests

    func testPhoneEntry_ValidPhoneStartsWith9_CanProceed() {
        // Given
        let viewModel = PhoneEntryViewModel(authService: mockAuthService)

        // When
        viewModel.phoneNumber = "9876543210"

        // Then
        XCTAssertTrue(viewModel.isValidPhone)
        XCTAssertTrue(viewModel.canProceed)
        XCTAssertEqual(viewModel.fullPhoneNumber, "+919876543210")
    }

    func testPhoneEntry_ValidPhoneStartsWith6_CanProceed() {
        // Given
        let viewModel = PhoneEntryViewModel(authService: mockAuthService)

        // When
        viewModel.phoneNumber = "6123456789"

        // Then
        XCTAssertTrue(viewModel.isValidPhone)
    }

    func testPhoneEntry_InvalidPhoneStartsWith5_CannotProceed() {
        // Given
        let viewModel = PhoneEntryViewModel(authService: mockAuthService)

        // When
        viewModel.phoneNumber = "5123456789"

        // Then
        XCTAssertFalse(viewModel.isValidPhone)
        XCTAssertFalse(viewModel.canProceed)
    }

    func testPhoneEntry_SendOTPSuccess_NavigatesToOTPVerification() async {
        // Given
        let viewModel = PhoneEntryViewModel(authService: mockAuthService)
        viewModel.phoneNumber = "9876543210"
        mockAuthService.shouldSucceed = true

        // When
        let success = await viewModel.sendOTP()

        // Then
        XCTAssertTrue(success)
        XCTAssertTrue(mockAuthService.sendOTPCalled)

        if case .success = viewModel.state {
            // Expected - can navigate to OTP verification
        } else {
            XCTFail("Expected success state to navigate to OTP")
        }
    }

    func testPhoneEntry_SendOTPFailure_ShowsError() async {
        // Given
        let viewModel = PhoneEntryViewModel(authService: mockAuthService)
        viewModel.phoneNumber = "9876543210"
        mockAuthService.shouldSucceed = false
        mockAuthService.errorToThrow = .serverError("Rate limited")

        // When
        let success = await viewModel.sendOTP()

        // Then
        XCTAssertFalse(success)
        XCTAssertNotNil(viewModel.errorMessage)
        XCTAssertEqual(viewModel.errorMessage, "Rate limited")
    }

    // MARK: - OTP Verification Flow Tests

    func testOTPVerification_ValidOTP_NewUser_NavigatesToNameVerification() async {
        // Given
        let viewModel = OTPVerificationViewModel(
            phone: "+919876543210",
            authService: mockAuthService
        )
        viewModel.otpDigits = ["1", "2", "3", "4", "5", "6"]

        mockAuthService.shouldSucceed = true
        mockAuthService.mockAuthResult = AuthResult(
            success: true,
            data: AuthResult.AuthResultData(
                userId: "new-user-id",
                isNewUser: true,
                consentVerificationId: nil,
                consentStatus: nil,
                message: "Verified",
                nextSteps: nil
            ),
            error: nil
        )

        // When
        let result = await viewModel.verifyOTP()

        // Then
        XCTAssertNotNil(result)
        XCTAssertTrue(result!.isNewUser)
        XCTAssertEqual(viewModel.determineNextRoute(), .nameVerification)
    }

    func testOTPVerification_ValidOTP_ExistingUser_NavigatesToNameVerification() async {
        // Given
        let viewModel = OTPVerificationViewModel(
            phone: "+919876543210",
            authService: mockAuthService
        )
        viewModel.otpDigits = ["1", "2", "3", "4", "5", "6"]

        mockAuthService.shouldSucceed = true
        mockAuthService.mockAuthResult = AuthResult(
            success: true,
            data: AuthResult.AuthResultData(
                userId: "existing-user-id",
                isNewUser: false,
                consentVerificationId: nil,
                consentStatus: nil,
                message: "Welcome back",
                nextSteps: nil
            ),
            error: nil
        )

        // When
        let result = await viewModel.verifyOTP()

        // Then
        XCTAssertNotNil(result)
        XCTAssertFalse(result!.isNewUser)
        // Existing users still go to name verification initially
        XCTAssertEqual(viewModel.determineNextRoute(), .nameVerification)
    }

    func testOTPVerification_InvalidOTP_ClearsOTPAndShowsError() async {
        // Given
        let viewModel = OTPVerificationViewModel(
            phone: "+919876543210",
            authService: mockAuthService
        )
        viewModel.otpDigits = ["1", "2", "3", "4", "5", "6"]

        mockAuthService.shouldSucceed = false
        mockAuthService.errorToThrow = .invalidOTP

        // When
        let result = await viewModel.verifyOTP()

        // Then
        XCTAssertNil(result)
        XCTAssertEqual(viewModel.otpDigits, ["", "", "", "", "", ""])  // Cleared
        XCTAssertNotNil(viewModel.errorMessage)
    }

    func testOTPVerification_ConsentRequired_CannotProceedWithoutConsent() async {
        // Given
        let viewModel = OTPVerificationViewModel(
            phone: "+919876543210",
            authService: mockAuthService
        )
        viewModel.otpDigits = ["1", "2", "3", "4", "5", "6"]
        viewModel.consentForMobile360 = false

        // When
        let result = await viewModel.verifyOTP()

        // Then
        XCTAssertNil(result)
        XCTAssertFalse(mockAuthService.verifyOTPCalled)
        XCTAssertNotNil(viewModel.errorMessage)
    }

    // MARK: - OTP Resend Flow Tests

    func testOTPVerification_ResendOTP_Success() async {
        // Given
        let viewModel = OTPVerificationViewModel(
            phone: "+919876543210",
            authService: mockAuthService
        )
        // Enable resending (simulates timer expiry)
        viewModel.canResend = true
        mockAuthService.shouldSucceed = true

        // When
        let success = await viewModel.resendOTP()

        // Then
        XCTAssertTrue(success)
        XCTAssertTrue(mockAuthService.sendOTPCalled)
        XCTAssertEqual(mockAuthService.lastPhoneSent, "+919876543210")
    }

    func testOTPVerification_ResendOTP_TimerRunning_CannotResend() async {
        // Given
        let viewModel = OTPVerificationViewModel(
            phone: "+919876543210",
            authService: mockAuthService
        )
        viewModel.startResendTimer()  // Timer is running

        // When
        let success = await viewModel.resendOTP()

        // Then
        XCTAssertFalse(success)
        XCTAssertFalse(mockAuthService.sendOTPCalled)
    }

    // MARK: - OTP Input Flow Tests

    func testOTPVerification_PasteFullOTP_AutoFills() {
        // Given
        let viewModel = OTPVerificationViewModel(
            phone: "+919876543210",
            authService: mockAuthService
        )

        // When - Paste "123456" at first position (6-digit OTP per Figma)
        let _ = viewModel.handleDigitInput(at: 0, newValue: "123456")

        // Then
        XCTAssertEqual(viewModel.otpDigits, ["1", "2", "3", "4", "5", "6"])
        XCTAssertTrue(viewModel.isOTPComplete)
    }

    func testOTPVerification_SingleDigitInput_MovesFocus() {
        // Given
        let viewModel = OTPVerificationViewModel(
            phone: "+919876543210",
            authService: mockAuthService
        )

        // When
        let nextFocus = viewModel.handleDigitInput(at: 0, newValue: "1")

        // Then
        XCTAssertEqual(viewModel.otpDigits[0], "1")
        XCTAssertEqual(nextFocus, 1)  // Focus moves to next field
    }

    func testOTPVerification_Backspace_MovesFocusBack() {
        // Given
        let viewModel = OTPVerificationViewModel(
            phone: "+919876543210",
            authService: mockAuthService
        )
        viewModel.otpDigits = ["1", "", "", "", "", ""]

        // When - Backspace on empty second field
        let prevFocus = viewModel.handleBackspace(at: 1)

        // Then
        XCTAssertEqual(prevFocus, 0)  // Focus moves to first field
    }

    // MARK: - Complete Onboarding Journey Tests

    func testCompleteOnboardingJourney_NewUser() async {
        // Step 1: Phone Entry
        let phoneVM = PhoneEntryViewModel(authService: mockAuthService)
        phoneVM.phoneNumber = "9876543210"

        XCTAssertTrue(phoneVM.isValidPhone)

        let otpSent = await phoneVM.sendOTP()
        XCTAssertTrue(otpSent)

        // Step 2: OTP Verification (6-digit OTP per Figma)
        let otpVM = OTPVerificationViewModel(
            phone: phoneVM.fullPhoneNumber,
            authService: mockAuthService
        )
        otpVM.otpDigits = ["1", "2", "3", "4", "5", "6"]

        mockAuthService.mockAuthResult = AuthResult(
            success: true,
            data: AuthResult.AuthResultData(
                userId: "new-user-id",
                isNewUser: true,
                consentVerificationId: nil,
                consentStatus: nil,
                message: "Verified",
                nextSteps: nil
            ),
            error: nil
        )

        let authResult = await otpVM.verifyOTP()
        XCTAssertNotNil(authResult)
        XCTAssertTrue(authResult!.isNewUser)

        // Step 3: Determine next route
        let nextRoute = otpVM.determineNextRoute()
        XCTAssertEqual(nextRoute, .nameVerification)
    }

    // MARK: - Error Recovery Tests

    func testPhoneEntry_ErrorRecovery_TypingClearsError() async {
        // Given
        let viewModel = PhoneEntryViewModel(authService: mockAuthService)
        mockAuthService.shouldSucceed = false
        viewModel.phoneNumber = "9876543210"

        // Trigger an error state via failed OTP send
        _ = await viewModel.sendOTP()
        XCTAssertNotNil(viewModel.errorMessage)

        // When user types again
        viewModel.phoneNumber = "9876543211"

        // Then error should be cleared
        XCTAssertNil(viewModel.errorMessage)
    }

    func testOTPVerification_ErrorRecovery_TypingClearsError() async {
        // Given
        let viewModel = OTPVerificationViewModel(
            phone: "+919876543210",
            authService: mockAuthService
        )
        mockAuthService.shouldSucceed = false
        viewModel.otpDigits = ["1", "2", "3", "4", "5", "6"]

        // Trigger an error state via failed verification
        _ = await viewModel.verifyOTP()
        XCTAssertNotNil(viewModel.errorMessage)

        // When user types again
        viewModel.otpDigits = ["1", "", "", "", "", ""]

        // Then error should be cleared
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertEqual(viewModel.state, .idle)
    }

    // MARK: - Phone Number Formatting Tests

    func testPhoneEntry_NumberWithSpaces_Cleaned() {
        let viewModel = PhoneEntryViewModel(authService: mockAuthService)
        viewModel.phoneNumber = "98 765 43210"
        XCTAssertEqual(viewModel.phoneNumber, "9876543210")
    }

    func testPhoneEntry_NumberWithDashes_Cleaned() {
        let viewModel = PhoneEntryViewModel(authService: mockAuthService)
        viewModel.phoneNumber = "98-765-43210"
        XCTAssertEqual(viewModel.phoneNumber, "9876543210")
    }

    func testPhoneEntry_NumberTruncatedTo10Digits() {
        let viewModel = PhoneEntryViewModel(authService: mockAuthService)
        viewModel.phoneNumber = "98765432101234"
        XCTAssertEqual(viewModel.phoneNumber.count, 10)
    }

    // MARK: - Timer Tests

    func testOTPVerification_TimerStartsAt30() {
        let viewModel = OTPVerificationViewModel(
            phone: "+919876543210",
            authService: mockAuthService
        )

        viewModel.startResendTimer()

        XCTAssertEqual(viewModel.resendCountdown, 30)
        XCTAssertFalse(viewModel.canResend)
    }
}
