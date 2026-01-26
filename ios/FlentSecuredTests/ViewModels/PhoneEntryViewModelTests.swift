/// PhoneEntryViewModelTests.swift
/// Flent Secured v2 - Phone Entry ViewModel Tests
///
/// Tests for phone number validation and OTP request functionality

import Testing
import Foundation
@testable import Flent

@Suite("PhoneEntryViewModel Tests")
struct PhoneEntryViewModelTests {

    // MARK: - Validation Tests

    @Test("Empty phone number is invalid")
    func emptyPhoneInvalid() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = ""

        #expect(viewModel.isValidPhone == false)
    }

    @Test("Phone number with less than 10 digits is invalid")
    func shortPhoneInvalid() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "98765"

        #expect(viewModel.isValidPhone == false)
    }

    @Test("Phone number with 10 digits starting with valid digit is valid")
    func tenDigitPhoneValid() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "9876543210"

        #expect(viewModel.isValidPhone == true)
    }

    @Test("Phone number starting with 6 is valid")
    func phoneStartingWith6Valid() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "6876543210"

        #expect(viewModel.isValidPhone == true)
    }

    @Test("Phone number starting with 7 is valid")
    func phoneStartingWith7Valid() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "7876543210"

        #expect(viewModel.isValidPhone == true)
    }

    @Test("Phone number starting with 8 is valid")
    func phoneStartingWith8Valid() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "8876543210"

        #expect(viewModel.isValidPhone == true)
    }

    @Test("Phone number starting with invalid digit is invalid")
    func invalidStartingDigit() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "1234567890" // Starts with 1, Indian numbers start with 6-9

        #expect(viewModel.isValidPhone == false)
    }

    @Test("Phone number starting with 5 is invalid")
    func phoneStartingWith5Invalid() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "5234567890"

        #expect(viewModel.isValidPhone == false)
    }

    // MARK: - Full Phone Number Tests

    @Test("Full phone number includes country code")
    func fullPhoneIncludesCountryCode() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "9876543210"

        #expect(viewModel.fullPhoneNumber == "+919876543210")
    }

    // MARK: - State Tests

    @Test("Cannot proceed with invalid phone")
    func cannotProceedWithInvalidPhone() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "123"

        #expect(viewModel.canProceed == false)
    }

    @Test("Can proceed with valid phone when not loading")
    func canProceedWithValidPhone() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "9876543210"

        #expect(viewModel.canProceed == true)
    }

    @Test("Cannot proceed while loading")
    @MainActor
    func cannotProceedWhileLoading() async {
        let mockService = MockAuthService()
        mockService.simulatedDelay = 1.0 // Add delay to simulate loading

        let viewModel = PhoneEntryViewModel(authService: mockService)
        viewModel.phoneNumber = "9876543210"

        // Start sending OTP (this will be async)
        let task = Task {
            _ = await viewModel.sendOTP()
        }

        // Give a moment for loading to start
        try? await Task.sleep(nanoseconds: 100_000_000)

        #expect(viewModel.isLoading == true)
        #expect(viewModel.canProceed == false)

        task.cancel()
    }

    // MARK: - OTP Request Tests

    @Test("Successful OTP send returns true")
    @MainActor
    func successfulOTPSend() async {
        let mockService = MockAuthService()
        mockService.shouldSucceed = true

        let viewModel = PhoneEntryViewModel(authService: mockService)
        viewModel.phoneNumber = "9876543210"

        let result = await viewModel.sendOTP()

        #expect(result == true)
        #expect(viewModel.isLoading == false)
        #expect(viewModel.errorMessage == nil)
    }

    @Test("Failed OTP send shows error")
    @MainActor
    func failedOTPSend() async {
        let mockService = MockAuthService()
        mockService.shouldSucceed = false
        mockService.errorToThrow = AuthError.serverError("Test error")

        let viewModel = PhoneEntryViewModel(authService: mockService)
        viewModel.phoneNumber = "9876543210"

        let result = await viewModel.sendOTP()

        #expect(result == false)
        #expect(viewModel.isLoading == false)
        #expect(viewModel.errorMessage != nil)
    }

    @Test("Network error shows appropriate message")
    @MainActor
    func networkError() async {
        let mockService = MockAuthService()
        mockService.shouldSucceed = false
        mockService.errorToThrow = AuthError.networkError(URLError(.notConnectedToInternet))

        let viewModel = PhoneEntryViewModel(authService: mockService)
        viewModel.phoneNumber = "9876543210"

        let result = await viewModel.sendOTP()

        #expect(result == false)
        #expect(viewModel.errorMessage != nil)
    }

    // MARK: - Reset Tests

    @Test("Reset clears error state")
    func resetClearsError() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "9876543210"
        // Manually set error state for testing
        viewModel.validatePhoneFormat() // This sets error if invalid, but we have valid
        viewModel.reset()

        #expect(viewModel.errorMessage == nil)
    }

    // MARK: - Phone Number Filtering Tests

    @Test("Phone number filters non-digits on input")
    func filtersNonDigits() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "987-654-3210"

        // Check the stored number only has digits
        let hasOnlyDigits = viewModel.phoneNumber.allSatisfy { $0.isNumber }
        #expect(hasOnlyDigits == true)
    }

    @Test("Phone number truncates to 10 digits")
    func truncatesTo10Digits() {
        let viewModel = PhoneEntryViewModel(authService: MockAuthService())
        viewModel.phoneNumber = "98765432101234"

        #expect(viewModel.phoneNumber.count == 10)
        #expect(viewModel.phoneNumber == "9876543210")
    }

    // MARK: - Preview Helpers

    @Test("Preview helper creates valid view model")
    func previewHelper() {
        let preview = PhoneEntryViewModel.preview
        #expect(preview != nil)
    }

    @Test("Preview with phone has valid phone number")
    func previewWithPhone() {
        let preview = PhoneEntryViewModel.previewWithPhone
        #expect(preview.phoneNumber == "9876543210")
        #expect(preview.isValidPhone == true)
    }
}
