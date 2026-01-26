/// AddBankViewModelTests.swift
/// Flent Secured v2 - Add Bank ViewModel Tests
///
/// Tests bank account form validation and verification flow

import Foundation
import Testing
@testable import Flent

@Suite("AddBankViewModel Tests")
struct AddBankViewModelTests {

    // MARK: - Form Validation

    @Test("Account holder name validation")
    func accountHolderNameValidation() {
        let vm = AddBankViewModel(tenancyId: "test", verificationService: MockVerificationService())

        // Too short
        vm.accountHolderName = "A"
        #expect(vm.isAccountHolderNameValid == false)

        // Valid
        vm.accountHolderName = "Rajesh Kumar"
        #expect(vm.isAccountHolderNameValid == true)
    }

    @Test("Account number validation")
    func accountNumberValidation() {
        let vm = AddBankViewModel(tenancyId: "test", verificationService: MockVerificationService())

        // Too short
        vm.accountNumber = "12345678"
        #expect(vm.isAccountNumberValid == false)

        // Non-numeric
        vm.accountNumber = "12345678ABC"
        #expect(vm.isAccountNumberValid == false)

        // Valid (9 digits)
        vm.accountNumber = "123456789"
        #expect(vm.isAccountNumberValid == true)

        // Valid (18 digits)
        vm.accountNumber = "123456789012345678"
        #expect(vm.isAccountNumberValid == true)

        // Too long
        vm.accountNumber = "1234567890123456789"
        #expect(vm.isAccountNumberValid == false)
    }

    @Test("Account numbers must match")
    func accountNumbersMatch() {
        let vm = AddBankViewModel(tenancyId: "test", verificationService: MockVerificationService())

        vm.accountNumber = "1234567890"
        vm.confirmAccountNumber = "1234567891"
        #expect(vm.doAccountNumbersMatch == false)
        #expect(vm.accountNumberMismatchError != nil)

        vm.confirmAccountNumber = "1234567890"
        #expect(vm.doAccountNumbersMatch == true)
        #expect(vm.accountNumberMismatchError == nil)
    }

    @Test("IFSC code validation")
    func ifscCodeValidation() {
        let vm = AddBankViewModel(tenancyId: "test", verificationService: MockVerificationService())

        // Invalid format - wrong length
        vm.ifscCode = "HDFC"
        #expect(vm.isIFSCValid == false)

        // Invalid format - 5th char not 0
        vm.ifscCode = "HDFC10001234"
        #expect(vm.isIFSCValid == false)

        // Invalid format - first 4 not letters
        vm.ifscCode = "HDF10001234"
        #expect(vm.isIFSCValid == false)

        // Valid IFSC
        vm.ifscCode = "HDFC0001234"
        #expect(vm.isIFSCValid == true)

        // Valid IFSC lowercase (should normalize)
        vm.ifscCode = "hdfc0001234"
        #expect(vm.isIFSCValid == true)
    }

    @Test("Form is valid only when all fields are valid")
    func formValidation() {
        let vm = AddBankViewModel(tenancyId: "test", verificationService: MockVerificationService())

        // All empty
        #expect(vm.isFormValid == false)
        #expect(vm.canVerify == false)

        // Fill valid data
        vm.accountHolderName = "Rajesh Kumar"
        vm.accountNumber = "1234567890123"
        vm.confirmAccountNumber = "1234567890123"
        vm.ifscCode = "HDFC0001234"

        #expect(vm.isFormValid == true)
        #expect(vm.canVerify == true)
    }

    // MARK: - Masked Account Number

    @Test("Masked account number shows last 4 digits")
    func maskedAccountNumber() {
        let vm = AddBankViewModel(tenancyId: "test", verificationService: MockVerificationService())

        vm.accountNumber = "1234567890123"

        #expect(vm.maskedAccountNumber == "XXXXXXXXX0123")
    }

    // MARK: - Verification Flow

    @Test("Cannot verify with invalid form")
    @MainActor
    func cannotVerifyInvalidForm() async {
        let mockService = MockVerificationService()
        let vm = AddBankViewModel(tenancyId: "test", verificationService: mockService)

        // Incomplete form
        vm.accountHolderName = "Test"
        vm.accountNumber = "123" // Invalid

        let result = await vm.verifyAccount()

        #expect(result == false)
        #expect(mockService.verifyBankCalled == false)
    }

    @Test("Successful bank verification")
    @MainActor
    func successfulVerification() async {
        let mockService = MockVerificationService()
        mockService.mockBankResult = MockVerificationService.createMockBankResult(
            accountNumber: "1234567890123",
            ifscCode: "HDFC0001234",
            name: "RAJESH KUMAR",
            verified: true
        )

        let vm = AddBankViewModel(tenancyId: "test-tenancy-id", verificationService: mockService)
        vm.accountHolderName = "Rajesh Kumar"
        vm.accountNumber = "1234567890123"
        vm.confirmAccountNumber = "1234567890123"
        vm.ifscCode = "HDFC0001234"

        let result = await vm.verifyAccount()

        #expect(result == true)
        #expect(vm.isVerified == true)
        #expect(mockService.verifyBankCalled == true)
        #expect(mockService.lastAccountNumber == "1234567890123")
        #expect(mockService.lastIFSC == "HDFC0001234")
        #expect(mockService.lastPartyType == .landlord)
    }

    @Test("Failed verification shows error")
    @MainActor
    func failedVerificationShowsError() async {
        let mockService = MockVerificationService()
        mockService.mockBankResult = MockVerificationService.createMockBankResult(
            accountNumber: "1234567890123",
            ifscCode: "HDFC0001234",
            name: "SOMEONE ELSE",
            verified: false
        )

        let vm = AddBankViewModel(tenancyId: "test", verificationService: mockService)
        vm.accountHolderName = "Rajesh Kumar"
        vm.accountNumber = "1234567890123"
        vm.confirmAccountNumber = "1234567890123"
        vm.ifscCode = "HDFC0001234"

        let result = await vm.verifyAccount()

        #expect(result == false)
        #expect(vm.isVerified == false)
        #expect(vm.errorMessage != nil)
    }

    @Test("Network error handling")
    @MainActor
    func networkErrorHandling() async {
        let mockService = MockVerificationService()
        mockService.shouldSucceed = false
        mockService.errorToThrow = .networkError(URLError(.notConnectedToInternet))

        let vm = AddBankViewModel(tenancyId: "test", verificationService: mockService)
        vm.accountHolderName = "Rajesh Kumar"
        vm.accountNumber = "1234567890123"
        vm.confirmAccountNumber = "1234567890123"
        vm.ifscCode = "HDFC0001234"

        let result = await vm.verifyAccount()

        #expect(result == false)
        #expect(vm.errorMessage != nil)
    }

    // MARK: - State Management

    @Test("Reset clears all form data")
    @MainActor
    func resetClearsForm() async {
        let mockService = MockVerificationService()
        mockService.shouldSucceed = false
        mockService.errorToThrow = .networkError(URLError(.notConnectedToInternet))

        let vm = AddBankViewModel(tenancyId: "test", verificationService: mockService)

        // Fill form with valid data
        vm.accountHolderName = "Rajesh Kumar"
        vm.accountNumber = "1234567890123"
        vm.confirmAccountNumber = "1234567890123"
        vm.ifscCode = "HDFC0001234"

        // Trigger an error state by attempting verification
        _ = await vm.verifyAccount()

        // Now reset should clear everything
        vm.reset()

        #expect(vm.accountHolderName == "")
        #expect(vm.accountNumber == "")
        #expect(vm.confirmAccountNumber == "")
        #expect(vm.ifscCode == "")
        #expect(vm.errorMessage == nil)
    }

    @Test("Clear error resets error message to nil")
    @MainActor
    func clearErrorResetsState() async {
        let mockService = MockVerificationService()
        mockService.shouldSucceed = false
        mockService.errorToThrow = .networkError(URLError(.notConnectedToInternet))

        let vm = AddBankViewModel(tenancyId: "test", verificationService: mockService)

        // Set up valid form
        vm.accountHolderName = "Rajesh Kumar"
        vm.accountNumber = "1234567890123"
        vm.confirmAccountNumber = "1234567890123"
        vm.ifscCode = "HDFC0001234"

        // Trigger error
        _ = await vm.verifyAccount()
        #expect(vm.errorMessage != nil)

        // Clear the error
        vm.clearError()

        #expect(vm.errorMessage == nil)
    }
}
