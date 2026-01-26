/// PhoneEntryViewModel.swift
/// Flent Secured v2 - Phone Entry ViewModel
///
/// Manages phone number entry state and OTP sending
/// Validates phone format and handles API communication

import Foundation
import Observation

// MARK: - Phone Entry ViewModel

@Observable
final class PhoneEntryViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case loading
        case success(expiresIn: Int)
        case error(String)
    }

    // MARK: - Properties

    var phoneNumber: String = "" {
        didSet {
            // Remove non-numeric characters
            let cleaned = phoneNumber.filter(\.isNumber)
            if cleaned != phoneNumber {
                phoneNumber = cleaned
            }
            // Limit to 10 digits
            if phoneNumber.count > 10 {
                phoneNumber = String(phoneNumber.prefix(10))
            }
            // Clear error when user types
            if case .error = state {
                state = .idle
            }
        }
    }

    private(set) var state: State = .idle

    // MARK: - Computed Properties

    var isValidPhone: Bool {
        phoneNumber.count == 10 && phoneNumber.first.map { "6789".contains($0) } ?? false
    }

    var fullPhoneNumber: String {
        "+91\(phoneNumber)"
    }

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var canProceed: Bool {
        isValidPhone && !isLoading
    }

    // MARK: - Dependencies

    private let authService: AuthServiceProtocol

    // MARK: - Initialization

    init(authService: AuthServiceProtocol = AppEnvironment.shared.authService) {
        self.authService = authService
    }

    // MARK: - Actions

    /// Send OTP to the entered phone number
    @MainActor
    func sendOTP() async -> Bool {
        guard isValidPhone else {
            state = .error("Please enter a valid 10-digit phone number")
            return false
        }

        state = .loading

        do {
            let result = try await authService.sendOTP(to: fullPhoneNumber)

            if result.success {
                state = .success(expiresIn: 300) // 5 minutes default expiry
                return true
            } else {
                state = .error(result.message)
                return false
            }
        } catch let error as AuthError {
            state = .error(error.errorDescription ?? "Failed to send OTP")
            return false
        } catch {
            state = .error("Something went wrong. Please try again.")
            return false
        }
    }

    /// Reset state for retry
    func reset() {
        state = .idle
    }

    // MARK: - Validation

    func validatePhoneFormat() -> Bool {
        guard phoneNumber.count == 10 else {
            state = .error("Phone number must be 10 digits")
            return false
        }

        guard let firstDigit = phoneNumber.first, "6789".contains(firstDigit) else {
            state = .error("Phone number must start with 6, 7, 8, or 9")
            return false
        }

        return true
    }
}

// MARK: - Preview Helper

extension PhoneEntryViewModel {
    static var preview: PhoneEntryViewModel {
        PhoneEntryViewModel(authService: MockAuthService())
    }

    static var previewWithPhone: PhoneEntryViewModel {
        let vm = PhoneEntryViewModel(authService: MockAuthService())
        vm.phoneNumber = "9876543210"
        return vm
    }

    static var previewLoading: PhoneEntryViewModel {
        let vm = PhoneEntryViewModel(authService: MockAuthService())
        vm.phoneNumber = "9876543210"
        vm.state = .loading
        return vm
    }

    static var previewError: PhoneEntryViewModel {
        let vm = PhoneEntryViewModel(authService: MockAuthService())
        vm.phoneNumber = "9876543210"
        vm.state = .error("Failed to send OTP. Please try again.")
        return vm
    }
}
