/// PhoneEntryViewModelTests.swift
/// Flent Secured v2 - Phone Entry ViewModel Tests
///
/// Comprehensive tests for phone number validation and OTP sending.
/// Critical for user onboarding flow.

import XCTest
@testable import Flent

@MainActor
final class PhoneEntryViewModelTests: XCTestCase {

    // MARK: - Properties

    private var sut: PhoneEntryViewModel!
    private var mockAuthService: MockAuthService!

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockAuthService = MockAuthService()
        mockAuthService.simulatedDelay = 0 // No delay for tests
        sut = PhoneEntryViewModel(authService: mockAuthService)
    }

    override func tearDown() async throws {
        sut = nil
        mockAuthService = nil
        try await super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitialState() {
        XCTAssertEqual(sut.phoneNumber, "")
        XCTAssertEqual(sut.state, .idle)
        XCTAssertFalse(sut.isValidPhone)
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.errorMessage)
        XCTAssertFalse(sut.canProceed)
    }

    // MARK: - Phone Number Validation Tests

    func testValidPhoneNumber_StartsWith9() {
        sut.phoneNumber = "9876543210"
        XCTAssertTrue(sut.isValidPhone)
        XCTAssertEqual(sut.fullPhoneNumber, "+919876543210")
        XCTAssertTrue(sut.canProceed)
    }

    func testValidPhoneNumber_StartsWith8() {
        sut.phoneNumber = "8765432109"
        XCTAssertTrue(sut.isValidPhone)
    }

    func testValidPhoneNumber_StartsWith7() {
        sut.phoneNumber = "7654321098"
        XCTAssertTrue(sut.isValidPhone)
    }

    func testValidPhoneNumber_StartsWith6() {
        sut.phoneNumber = "6543210987"
        XCTAssertTrue(sut.isValidPhone)
    }

    func testInvalidPhoneNumber_TooShort() {
        sut.phoneNumber = "987654321"  // 9 digits
        XCTAssertFalse(sut.isValidPhone)
        XCTAssertFalse(sut.canProceed)
    }

    func testInvalidPhoneNumber_TooLong_IsTruncated() {
        sut.phoneNumber = "98765432101"  // 11 digits
        XCTAssertEqual(sut.phoneNumber.count, 10)  // Should be truncated to 10
        XCTAssertTrue(sut.isValidPhone)
    }

    func testInvalidPhoneNumber_StartsWithInvalidDigit() {
        // Indian mobile numbers must start with 6, 7, 8, or 9
        sut.phoneNumber = "5876543210"
        XCTAssertFalse(sut.isValidPhone)

        sut.phoneNumber = "1234567890"
        XCTAssertFalse(sut.isValidPhone)

        sut.phoneNumber = "0987654321"
        XCTAssertFalse(sut.isValidPhone)
    }

    func testPhoneNumber_RemovesNonNumericCharacters() {
        sut.phoneNumber = "98-765-43210"
        XCTAssertEqual(sut.phoneNumber, "9876543210")
        XCTAssertTrue(sut.isValidPhone)
    }

    func testPhoneNumber_RemovesLetters() {
        sut.phoneNumber = "98abc76543210"
        XCTAssertEqual(sut.phoneNumber, "9876543210")
    }

    func testPhoneNumber_RemovesSpaces() {
        sut.phoneNumber = "98 765 43210"
        XCTAssertEqual(sut.phoneNumber, "9876543210")
    }

    func testEmptyPhoneNumber() {
        sut.phoneNumber = ""
        XCTAssertFalse(sut.isValidPhone)
        XCTAssertFalse(sut.canProceed)
    }

    // MARK: - Send OTP Tests

    func testSendOTP_Success() async {
        // Given
        sut.phoneNumber = "9876543210"
        mockAuthService.shouldSucceed = true

        // When
        let result = await sut.sendOTP()

        // Then
        XCTAssertTrue(result)
        XCTAssertTrue(mockAuthService.sendOTPCalled)
        XCTAssertEqual(mockAuthService.lastPhoneSent, "+919876543210")

        if case .success(let expiresIn) = sut.state {
            XCTAssertEqual(expiresIn, 300)
        } else {
            XCTFail("Expected success state")
        }
    }

    func testSendOTP_InvalidPhone_DoesNotCallService() async {
        // Given
        sut.phoneNumber = "123"  // Invalid phone

        // When
        let result = await sut.sendOTP()

        // Then
        XCTAssertFalse(result)
        XCTAssertFalse(mockAuthService.sendOTPCalled)

        if case .error(let message) = sut.state {
            XCTAssertEqual(message, "Please enter a valid 10-digit phone number")
        } else {
            XCTFail("Expected error state")
        }
    }

    func testSendOTP_Failure_NetworkError() async {
        // Given
        sut.phoneNumber = "9876543210"
        mockAuthService.shouldSucceed = false
        mockAuthService.errorToThrow = .serverError("Network unavailable")

        // When
        let result = await sut.sendOTP()

        // Then
        XCTAssertFalse(result)
        XCTAssertTrue(mockAuthService.sendOTPCalled)

        if case .error(let message) = sut.state {
            XCTAssertEqual(message, "Network unavailable")
        } else {
            XCTFail("Expected error state")
        }
    }

    func testSendOTP_Failure_InvalidPhoneError() async {
        // Given
        sut.phoneNumber = "9876543210"
        mockAuthService.shouldSucceed = false
        mockAuthService.errorToThrow = .invalidPhone

        // When
        let result = await sut.sendOTP()

        // Then
        XCTAssertFalse(result)
        XCTAssertNotNil(sut.errorMessage)
    }

    func testSendOTP_SetsLoadingState() async {
        // Given
        sut.phoneNumber = "9876543210"
        mockAuthService.simulatedDelay = 0.5  // Add delay to observe loading state

        // When
        let task = Task {
            await sut.sendOTP()
        }

        // Give time for state to change
        try? await Task.sleep(nanoseconds: 100_000_000)  // 0.1s

        // Then
        XCTAssertTrue(sut.isLoading)
        XCTAssertFalse(sut.canProceed)  // Cannot proceed while loading

        _ = await task.value
    }

    // MARK: - State Management Tests

    func testTypingClearsError() async {
        // Given - Trigger error state via API
        sut.phoneNumber = "123"  // Invalid phone
        _ = await sut.sendOTP()
        XCTAssertNotNil(sut.errorMessage)

        // When
        sut.phoneNumber = "9"

        // Then
        XCTAssertEqual(sut.state, .idle)
        XCTAssertNil(sut.errorMessage)
    }

    func testReset() async {
        // Given - Trigger error state via API
        sut.phoneNumber = "123"  // Invalid phone
        _ = await sut.sendOTP()
        XCTAssertNotNil(sut.errorMessage)

        // When
        sut.reset()

        // Then
        XCTAssertEqual(sut.state, .idle)
    }

    // MARK: - Validation Method Tests

    func testValidatePhoneFormat_Valid() {
        sut.phoneNumber = "9876543210"
        XCTAssertTrue(sut.validatePhoneFormat())
        XCTAssertEqual(sut.state, .idle)
    }

    func testValidatePhoneFormat_TooShort() {
        sut.phoneNumber = "987654321"
        XCTAssertFalse(sut.validatePhoneFormat())

        if case .error(let message) = sut.state {
            XCTAssertEqual(message, "Phone number must be 10 digits")
        } else {
            XCTFail("Expected error state")
        }
    }

    func testValidatePhoneFormat_InvalidStartDigit() {
        sut.phoneNumber = "5876543210"
        XCTAssertFalse(sut.validatePhoneFormat())

        if case .error(let message) = sut.state {
            XCTAssertEqual(message, "Phone number must start with 6, 7, 8, or 9")
        } else {
            XCTFail("Expected error state")
        }
    }

    // MARK: - Computed Properties Tests

    func testCanProceed_ValidPhoneNotLoading() {
        sut.phoneNumber = "9876543210"
        XCTAssertTrue(sut.canProceed)
    }

    func testCanProceed_ValidPhoneButLoading() async {
        // Given
        sut.phoneNumber = "9876543210"
        mockAuthService.simulatedDelay = 1.0  // Long delay to stay in loading state

        // When - Start loading
        let task = Task {
            await sut.sendOTP()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)  // Wait for state change

        // Then
        XCTAssertTrue(sut.isLoading)
        XCTAssertFalse(sut.canProceed)

        task.cancel()
    }

    func testCanProceed_InvalidPhone() {
        sut.phoneNumber = "123"
        XCTAssertFalse(sut.canProceed)
    }

    func testIsLoading() async {
        // Initially not loading
        XCTAssertFalse(sut.isLoading)

        // Start loading
        sut.phoneNumber = "9876543210"
        mockAuthService.simulatedDelay = 0.5

        let task = Task {
            await sut.sendOTP()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertTrue(sut.isLoading)

        // Wait for completion - we don't need the result
        let _ = await task.value
        XCTAssertFalse(sut.isLoading)
    }

    func testErrorMessage() async {
        // Initially no error
        XCTAssertNil(sut.errorMessage)

        // Trigger error via API
        sut.phoneNumber = "123"  // Invalid
        _ = await sut.sendOTP()
        XCTAssertNotNil(sut.errorMessage)

        // Reset clears error
        sut.reset()
        XCTAssertNil(sut.errorMessage)
    }

    // MARK: - Edge Cases

    func testMultipleSendOTPRequests() async {
        // Given
        sut.phoneNumber = "9876543210"
        mockAuthService.simulatedDelay = 0.2

        // When - Send multiple requests
        async let result1 = sut.sendOTP()
        async let result2 = sut.sendOTP()

        let results = await [result1, result2]

        // Then - Both should complete (implementation may vary based on debouncing)
        XCTAssertTrue(results.contains(true))
    }

    func testAllValidIndianPrefixes() {
        let validPrefixes = ["6", "7", "8", "9"]

        for prefix in validPrefixes {
            sut.phoneNumber = "\(prefix)123456789"
            XCTAssertTrue(sut.isValidPhone, "Phone starting with \(prefix) should be valid")
        }
    }

    func testAllInvalidPrefixes() {
        let invalidPrefixes = ["0", "1", "2", "3", "4", "5"]

        for prefix in invalidPrefixes {
            sut.phoneNumber = "\(prefix)123456789"
            XCTAssertFalse(sut.isValidPhone, "Phone starting with \(prefix) should be invalid")
        }
    }
}
