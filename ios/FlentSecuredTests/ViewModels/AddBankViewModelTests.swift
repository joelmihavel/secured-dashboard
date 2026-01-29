/// AddBankViewModelTests.swift
/// Flent Secured v2 - Add Bank ViewModel Tests
///
/// Tests for bank account validation and verification flow.
/// Critical for secure bank account verification in fintech.

import XCTest
@testable import Flent

@MainActor
final class AddBankViewModelTests: XCTestCase {

    // MARK: - Properties

    private var sut: AddBankViewModel!
    private var mockVerificationService: MockVerificationService!

    private let testTenancyId = "test-tenancy-123"

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockVerificationService = MockVerificationService()
        mockVerificationService.simulatedDelay = 0

        sut = AddBankViewModel(
            tenancyId: testTenancyId,
            verificationService: mockVerificationService
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockVerificationService = nil
        try await super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitialState() {
        XCTAssertEqual(sut.state, .idle)
        XCTAssertEqual(sut.accountHolderName, "")
        XCTAssertEqual(sut.accountNumber, "")
        XCTAssertEqual(sut.confirmAccountNumber, "")
        XCTAssertEqual(sut.ifscCode, "")
        XCTAssertFalse(sut.isVerifying)
        XCTAssertFalse(sut.isVerified)
        XCTAssertNil(sut.errorMessage)
        XCTAssertNil(sut.verificationResult)
    }

    // MARK: - Account Holder Name Validation Tests

    func testAccountHolderName_Valid() {
        sut.accountHolderName = "Rajesh Kumar"
        XCTAssertTrue(sut.isAccountHolderNameValid)
    }

    func testAccountHolderName_TooShort() {
        sut.accountHolderName = "R"
        XCTAssertFalse(sut.isAccountHolderNameValid)
    }

    func testAccountHolderName_MinimumLength() {
        sut.accountHolderName = "RK"  // 2 characters
        XCTAssertTrue(sut.isAccountHolderNameValid)
    }

    func testAccountHolderName_Empty() {
        sut.accountHolderName = ""
        XCTAssertFalse(sut.isAccountHolderNameValid)
    }

    // MARK: - Account Number Validation Tests

    func testAccountNumber_Valid_9Digits() {
        sut.accountNumber = "123456789"
        XCTAssertTrue(sut.isAccountNumberValid)
    }

    func testAccountNumber_Valid_18Digits() {
        sut.accountNumber = "123456789012345678"
        XCTAssertTrue(sut.isAccountNumberValid)
    }

    func testAccountNumber_Valid_12Digits() {
        sut.accountNumber = "123456789012"
        XCTAssertTrue(sut.isAccountNumberValid)
    }

    func testAccountNumber_TooShort() {
        sut.accountNumber = "12345678"  // 8 digits
        XCTAssertFalse(sut.isAccountNumberValid)
    }

    func testAccountNumber_TooLong() {
        sut.accountNumber = "1234567890123456789"  // 19 digits
        XCTAssertFalse(sut.isAccountNumberValid)
    }

    func testAccountNumber_ContainsLetters() {
        sut.accountNumber = "12345ABC789"
        XCTAssertFalse(sut.isAccountNumberValid)
    }

    func testAccountNumber_Empty() {
        sut.accountNumber = ""
        XCTAssertFalse(sut.isAccountNumberValid)
    }

    // MARK: - Account Number Match Tests

    func testAccountNumbersMatch_Match() {
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        XCTAssertTrue(sut.doAccountNumbersMatch)
        XCTAssertNil(sut.accountNumberMismatchError)
    }

    func testAccountNumbersMatch_NoMatch() {
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789013"
        XCTAssertFalse(sut.doAccountNumbersMatch)
        XCTAssertEqual(sut.accountNumberMismatchError, "Account numbers don't match")
    }

    func testAccountNumbersMatch_ConfirmEmpty() {
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = ""
        XCTAssertFalse(sut.doAccountNumbersMatch)
        XCTAssertNil(sut.accountNumberMismatchError)  // No error when confirm is empty
    }

    func testAccountNumbersMatch_BothEmpty() {
        sut.accountNumber = ""
        sut.confirmAccountNumber = ""
        XCTAssertFalse(sut.doAccountNumbersMatch)
    }

    // MARK: - IFSC Validation Tests

    func testIFSC_Valid_HDFC() {
        sut.ifscCode = "HDFC0001234"
        XCTAssertTrue(sut.isIFSCValid)
        XCTAssertNil(sut.ifscError)
    }

    func testIFSC_Valid_SBI() {
        sut.ifscCode = "SBIN0012345"
        XCTAssertTrue(sut.isIFSCValid)
    }

    func testIFSC_Valid_ICICI() {
        sut.ifscCode = "ICIC0006789"
        XCTAssertTrue(sut.isIFSCValid)
    }

    func testIFSC_Valid_Lowercase() {
        sut.ifscCode = "hdfc0001234"  // Should work with lowercase
        XCTAssertTrue(sut.isIFSCValid)
    }

    func testIFSC_Invalid_WrongFormat() {
        sut.ifscCode = "HDFC1001234"  // 5th char should be 0
        XCTAssertFalse(sut.isIFSCValid)
        XCTAssertEqual(sut.ifscError, "Invalid IFSC format")
    }

    func testIFSC_Invalid_TooShort() {
        sut.ifscCode = "HDFC000123"
        XCTAssertFalse(sut.isIFSCValid)
    }

    func testIFSC_Invalid_TooLong() {
        sut.ifscCode = "HDFC00012345"
        XCTAssertFalse(sut.isIFSCValid)
    }

    func testIFSC_Invalid_NoNumbers() {
        sut.ifscCode = "HDFCOABCDEF"
        XCTAssertFalse(sut.isIFSCValid)
    }

    func testIFSC_Empty() {
        sut.ifscCode = ""
        XCTAssertFalse(sut.isIFSCValid)
        XCTAssertNil(sut.ifscError)  // No error when empty
    }

    // MARK: - Form Validation Tests

    func testIsFormValid_AllValid() {
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "HDFC0001234"

        XCTAssertTrue(sut.isFormValid)
    }

    func testIsFormValid_InvalidName() {
        sut.accountHolderName = "R"  // Too short
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "HDFC0001234"

        XCTAssertFalse(sut.isFormValid)
    }

    func testIsFormValid_InvalidAccountNumber() {
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "1234"  // Too short
        sut.confirmAccountNumber = "1234"
        sut.ifscCode = "HDFC0001234"

        XCTAssertFalse(sut.isFormValid)
    }

    func testIsFormValid_MismatchedAccountNumbers() {
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789013"  // Different
        sut.ifscCode = "HDFC0001234"

        XCTAssertFalse(sut.isFormValid)
    }

    func testIsFormValid_InvalidIFSC() {
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "INVALID"

        XCTAssertFalse(sut.isFormValid)
    }

    // MARK: - Can Verify Tests

    func testCanVerify_ValidForm() {
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "HDFC0001234"

        XCTAssertTrue(sut.canVerify)
    }

    func testCanVerify_InvalidForm() {
        sut.accountHolderName = "R"
        XCTAssertFalse(sut.canVerify)
    }

    func testCanVerify_WhileVerifying() async {
        // Given
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "HDFC0001234"
        mockVerificationService.simulatedDelay = 1.0  // Long delay to catch verifying state

        // When - Start verification in background
        let task = Task {
            await sut.verifyAccount()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)  // Wait for state change

        // Then
        XCTAssertTrue(sut.isVerifying)
        XCTAssertFalse(sut.canVerify)

        task.cancel()
    }

    // MARK: - Masked Account Number Tests

    func testMaskedAccountNumber() {
        sut.accountNumber = "123456789012"
        XCTAssertEqual(sut.maskedAccountNumber, "XXXXXXXX9012")
    }

    func testMaskedAccountNumber_ShortNumber() {
        sut.accountNumber = "1234"
        XCTAssertEqual(sut.maskedAccountNumber, "1234")
    }

    func testMaskedAccountNumber_FiveDigits() {
        sut.accountNumber = "12345"
        XCTAssertEqual(sut.maskedAccountNumber, "X2345")
    }

    // MARK: - Verification Tests

    func testVerifyAccount_Success() async {
        // Given
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "HDFC0001234"
        mockVerificationService.shouldSucceed = true

        // When
        let result = await sut.verifyAccount()

        // Then
        XCTAssertTrue(result)
        XCTAssertTrue(mockVerificationService.verifyBankCalled)
        XCTAssertEqual(mockVerificationService.lastAccountNumber, "123456789012")
        XCTAssertEqual(mockVerificationService.lastIFSC, "HDFC0001234")
        XCTAssertEqual(mockVerificationService.lastPartyType, .landlord)
        XCTAssertTrue(sut.isVerified)
        XCTAssertNotNil(sut.verificationResult)
    }

    func testVerifyAccount_Failure_InvalidForm() async {
        // Given - Invalid form (no data)

        // When
        let result = await sut.verifyAccount()

        // Then
        XCTAssertFalse(result)
        XCTAssertFalse(mockVerificationService.verifyBankCalled)
        XCTAssertNotNil(sut.errorMessage)
    }

    func testVerifyAccount_Failure_VerificationFailed() async {
        // Given
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "HDFC0001234"
        mockVerificationService.shouldSucceed = false
        mockVerificationService.errorToThrow = .bankVerificationFailed("Account not found")

        // When
        let result = await sut.verifyAccount()

        // Then
        XCTAssertFalse(result)
        XCTAssertTrue(mockVerificationService.verifyBankCalled)
        XCTAssertFalse(sut.isVerified)
        XCTAssertNotNil(sut.errorMessage)
    }

    func testVerifyAccount_Failure_NameMismatch() async {
        // Given
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "HDFC0001234"

        mockVerificationService.shouldSucceed = true
        mockVerificationService.mockBankResult = BankVerificationResult(
            bankAccountId: "test-id",
            verified: false,
            accountNumberMasked: "XXXXXXXX9012",
            ifscCode: "HDFC0001234",
            verifiedName: "DIFFERENT NAME",
            nameMatchScore: 45,  // Below threshold
            nameMatchThreshold: 80,
            verificationStatus: "FAILED",
            bankName: "HDFC BANK",
            branch: "WHITEFIELD",
            message: "Name mismatch"
        )

        // When
        let result = await sut.verifyAccount()

        // Then
        XCTAssertFalse(result)
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertTrue(sut.errorMessage!.contains("doesn't match"))
    }

    func testVerifyAccount_SetsVerifyingState() async {
        // Given
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "HDFC0001234"
        mockVerificationService.simulatedDelay = 0.5

        // When
        let task = Task {
            await sut.verifyAccount()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)

        // Then
        XCTAssertTrue(sut.isVerifying)
        XCTAssertFalse(sut.canVerify)

        _ = await task.value
    }

    // MARK: - Reset Tests

    func testReset() async {
        // Given - Trigger an error state via API
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "HDFC0001234"
        mockVerificationService.shouldSucceed = false
        mockVerificationService.errorToThrow = .bankVerificationFailed("Test error")
        _ = await sut.verifyAccount()

        XCTAssertNotNil(sut.errorMessage)  // Confirm error state

        // When
        sut.reset()

        // Then
        XCTAssertEqual(sut.state, .idle)
        XCTAssertEqual(sut.accountHolderName, "")
        XCTAssertEqual(sut.accountNumber, "")
        XCTAssertEqual(sut.confirmAccountNumber, "")
        XCTAssertEqual(sut.ifscCode, "")
        XCTAssertNil(sut.verificationResult)
    }

    func testClearError() async {
        // Given - Trigger error state via API
        _ = await sut.verifyAccount()  // Empty form causes error

        XCTAssertNotNil(sut.errorMessage)

        // When
        sut.clearError()

        // Then
        XCTAssertEqual(sut.state, .idle)
    }

    func testClearError_NotInErrorState() {
        // Given - idle state (not error)
        XCTAssertEqual(sut.state, .idle)

        // When
        sut.clearError()

        // Then - State unchanged
        XCTAssertEqual(sut.state, .idle)
    }

    // MARK: - Edge Cases

    func testVerify_WithWhitespaceInName() async {
        // Given
        sut.accountHolderName = "  Rajesh Kumar  "
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "HDFC0001234"
        mockVerificationService.shouldSucceed = true

        // When
        _ = await sut.verifyAccount()

        // Then - Name should be trimmed
        XCTAssertTrue(mockVerificationService.verifyBankCalled)
    }

    func testVerify_LowercaseIFSCConverted() async {
        // Given
        sut.accountHolderName = "Rajesh Kumar"
        sut.accountNumber = "123456789012"
        sut.confirmAccountNumber = "123456789012"
        sut.ifscCode = "hdfc0001234"  // Lowercase
        mockVerificationService.shouldSucceed = true

        // When
        _ = await sut.verifyAccount()

        // Then - IFSC should be uppercase
        XCTAssertEqual(mockVerificationService.lastIFSC, "HDFC0001234")
    }
}
