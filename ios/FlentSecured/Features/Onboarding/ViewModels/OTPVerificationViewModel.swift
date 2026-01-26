/// OTPVerificationViewModel.swift
/// Flent Secured v2 - OTP Verification ViewModel
///
/// Manages OTP verification state and authentication
/// Handles OTP entry, verification, and resend logic
///
/// Figma: auth / sign up --enter OTP

import Foundation
import Observation
import Combine

// MARK: - OTP Verification ViewModel

@Observable
final class OTPVerificationViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case verifying
        case resending
        case verified(AuthResult)
        case error(String)

        static func == (lhs: State, rhs: State) -> Bool {
            switch (lhs, rhs) {
            case (.idle, .idle), (.verifying, .verifying), (.resending, .resending):
                return true
            case (.verified(let l), .verified(let r)):
                return l.success == r.success && l.isNewUser == r.isNewUser
            case (.error(let l), .error(let r)):
                return l == r
            default:
                return false
            }
        }
    }

    // MARK: - Properties

    let phone: String

    var otpDigits: [String] = Array(repeating: "", count: 6) {
        didSet {
            if case .error = state {
                state = .idle
            }
        }
    }

    var consentForMobile360: Bool = true

    private(set) var state: State = .idle
    private(set) var resendCountdown: Int = 30
    private(set) var canResend: Bool = false

    private var resendTimer: Timer?

    // MARK: - Computed Properties

    var otpCode: String {
        otpDigits.joined()
    }

    var isOTPComplete: Bool {
        otpCode.count == 6 && otpCode.allSatisfy(\.isNumber)
    }

    var isVerifying: Bool {
        if case .verifying = state { return true }
        return false
    }

    var isResending: Bool {
        if case .resending = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var canVerify: Bool {
        isOTPComplete && !isVerifying && !isResending && consentForMobile360
    }

    var consentErrorMessage: String? {
        if !consentForMobile360 && isOTPComplete {
            return "Please allow identity verification to continue"
        }
        return nil
    }

    var authResult: AuthResult? {
        if case .verified(let result) = state { return result }
        return nil
    }

    // MARK: - Dependencies

    private let authService: AuthServiceProtocol

    // MARK: - Initialization

    init(phone: String, authService: AuthServiceProtocol = AppEnvironment.shared.authService) {
        self.phone = phone
        self.authService = authService
    }

    deinit {
        resendTimer?.invalidate()
    }

    // MARK: - Actions

    /// Verify the entered OTP
    @MainActor
    func verifyOTP() async -> AuthResult? {
        guard isOTPComplete else {
            state = .error("Please enter the complete 6-digit code")
            return nil
        }

        guard consentForMobile360 else {
            state = .error("Please allow identity verification to continue")
            return nil
        }

        state = .verifying

        do {
            let result = try await authService.verifyOTP(
                phone: phone,
                otp: otpCode,
                consentForMobile360: consentForMobile360
            )

            if result.success {
                state = .verified(result)
                return result
            } else {
                state = .error(result.error ?? "Verification failed")
                clearOTP()
                return nil
            }
        } catch let error as AuthError {
            state = .error(error.errorDescription ?? "Verification failed")
            clearOTP()
            return nil
        } catch {
            state = .error("Something went wrong. Please try again.")
            clearOTP()
            return nil
        }
    }

    /// Resend OTP to the phone number
    @MainActor
    func resendOTP() async -> Bool {
        guard canResend else { return false }

        state = .resending

        do {
            let result = try await authService.sendOTP(to: phone)

            if result.success {
                state = .idle
                startResendTimer()
                return true
            } else {
                state = .error(result.message)
                return false
            }
        } catch let error as AuthError {
            state = .error(error.errorDescription ?? "Failed to resend OTP")
            return false
        } catch {
            state = .error("Failed to resend OTP")
            return false
        }
    }

    /// Start the resend countdown timer
    func startResendTimer() {
        resendTimer?.invalidate()
        resendCountdown = 30
        canResend = false

        resendTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }

            if self.resendCountdown > 0 {
                self.resendCountdown -= 1
            } else {
                self.canResend = true
                timer.invalidate()
            }
        }
    }

    /// Handle digit input at specific index
    func handleDigitInput(at index: Int, newValue: String) -> Int? {
        // Handle paste of full OTP
        if newValue.count == 6 && newValue.allSatisfy(\.isNumber) {
            for (i, char) in newValue.enumerated() {
                otpDigits[i] = String(char)
            }
            return nil // No focus change, trigger verification
        }

        // Allow only single digit
        if newValue.count > 1 {
            otpDigits[index] = String(newValue.suffix(1))
        }

        // Return next focus index
        if !newValue.isEmpty && index < 5 {
            return index + 1
        }

        return nil
    }

    /// Handle backspace/delete
    func handleBackspace(at index: Int) -> Int? {
        if otpDigits[index].isEmpty && index > 0 {
            return index - 1
        }
        return nil
    }

    /// Clear all OTP digits
    func clearOTP() {
        otpDigits = Array(repeating: "", count: 6)
    }

    /// Reset state
    func reset() {
        state = .idle
        clearOTP()
    }
}

// MARK: - Destination Determination

extension OTPVerificationViewModel {

    /// Determine the next route based on auth result
    /// For new users: continue to name verification
    /// For existing users: fetch their profile and route based on status
    func determineNextRoute() -> Route? {
        guard let result = authResult else { return nil }

        // For new users, continue onboarding flow
        if result.isNewUser {
            return .nameVerification
        } else {
            // Existing user - check their status to determine routing
            // This will be validated asynchronously, but we can make an initial decision
            // based on what we know from the auth result
            return .nameVerification
        }
    }

    /// Determine route asynchronously by fetching user profile
    /// This is called after initial OTP verification for existing users
    @MainActor
    func determineNextRouteAsync() async -> Route {
        guard let result = authResult, !result.isNewUser else {
            return .nameVerification
        }

        // Fetch user profile to determine routing
        do {
            let userProfile = try await AppEnvironment.shared.userService.getCurrentUser()

            // Route based on user status
            if let status = UserStatus(rawValue: userProfile.userStatus) {
                switch status {
                case .complete:
                    // Fully verified user - go to home with full access
                    return .home(state: .activeComplete)
                case .qualified:
                    // Needs setup steps - go to pending steps or home with limited access
                    return .home(state: .activeQualified)
                case .waitlisted:
                    return .waitlist
                case .notEligible:
                    return .waitlist
                case .signedUp, .unknown:
                    return .nameVerification
                }
            }
        } catch {
            print("[OTPVerificationViewModel] Failed to fetch user profile: \(error)")
        }

        // Fallback to name verification
        return .nameVerification
    }
}

// MARK: - Preview Helpers

extension OTPVerificationViewModel {
    static var preview: OTPVerificationViewModel {
        OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())
    }

    static var previewWithOTP: OTPVerificationViewModel {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())
        vm.otpDigits = ["1", "2", "3", "4", "5", "6"]
        return vm
    }

    static var previewVerifying: OTPVerificationViewModel {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())
        vm.otpDigits = ["1", "2", "3", "4", "5", "6"]
        vm.state = .verifying
        return vm
    }

    static var previewError: OTPVerificationViewModel {
        let vm = OTPVerificationViewModel(phone: "+919876543210", authService: MockAuthService())
        vm.state = .error("Invalid OTP. Please try again.")
        return vm
    }
}
