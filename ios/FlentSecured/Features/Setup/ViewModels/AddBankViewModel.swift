/// AddBankViewModel.swift
/// Flent Secured v2 - Add Bank Account ViewModel
///
/// Manages bank account verification via Cashfree Penny Drop
/// Validates form input and handles verification flow
///
/// Figma: Setup / Add Bank

import Foundation
import Observation

// MARK: - Add Bank ViewModel

@Observable
final class AddBankViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case verifying
        case verified(BankVerificationResult)
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var verificationResult: BankVerificationResult?

    // MARK: - Form Fields

    var accountHolderName: String = ""
    var accountNumber: String = ""
    var confirmAccountNumber: String = ""
    var ifscCode: String = ""

    // MARK: - Computed Properties

    var isVerifying: Bool {
        if case .verifying = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var isVerified: Bool {
        if case .verified = state { return true }
        return false
    }

    var isFormValid: Bool {
        isAccountHolderNameValid &&
        isAccountNumberValid &&
        doAccountNumbersMatch &&
        isIFSCValid
    }

    var canVerify: Bool {
        isFormValid && !isVerifying
    }

    // MARK: - Field Validations

    var isAccountHolderNameValid: Bool {
        accountHolderName.count >= 2
    }

    var isAccountNumberValid: Bool {
        // Indian bank account numbers are typically 9-18 digits
        accountNumber.count >= 9 && accountNumber.count <= 18 &&
        accountNumber.allSatisfy { $0.isNumber }
    }

    var doAccountNumbersMatch: Bool {
        !accountNumber.isEmpty && accountNumber == confirmAccountNumber
    }

    var isIFSCValid: Bool {
        // IFSC format: 4 letters + 0 + 6 alphanumeric
        let pattern = "^[A-Z]{4}0[A-Z0-9]{6}$"
        let uppercased = ifscCode.uppercased()
        return uppercased.range(of: pattern, options: .regularExpression) != nil
    }

    var accountNumberMismatchError: String? {
        if confirmAccountNumber.isEmpty { return nil }
        if accountNumber != confirmAccountNumber {
            return "Account numbers don't match"
        }
        return nil
    }

    var ifscError: String? {
        if ifscCode.isEmpty { return nil }
        if !isIFSCValid {
            return "Invalid IFSC format"
        }
        return nil
    }

    var maskedAccountNumber: String {
        guard accountNumber.count > 4 else { return accountNumber }
        let suffix = String(accountNumber.suffix(4))
        let masked = String(repeating: "X", count: accountNumber.count - 4)
        return masked + suffix
    }

    // MARK: - Dependencies

    private let tenancyId: String
    private let verificationService: VerificationServiceProtocol

    // MARK: - Initialization

    init(
        tenancyId: String,
        verificationService: VerificationServiceProtocol = AppEnvironment.shared.verificationService
    ) {
        self.tenancyId = tenancyId
        self.verificationService = verificationService
    }

    // MARK: - Actions

    /// Verify the bank account
    @MainActor
    func verifyAccount() async -> Bool {
        guard canVerify else {
            state = .error("Please fill all fields correctly")
            return false
        }

        state = .verifying

        do {
            let result = try await verificationService.verifyBank(
                tenancyId: tenancyId,
                accountHolderName: accountHolderName.trimmingCharacters(in: .whitespaces),
                accountNumber: accountNumber,
                ifscCode: ifscCode.uppercased(),
                partyType: .landlord
            )

            verificationResult = result

            if result.verified {
                state = .verified(result)
                return true
            } else {
                // Name mismatch or verification failed
                let errorMessage = buildVerificationErrorMessage(result)
                state = .error(errorMessage)
                return false
            }
        } catch let error as VerificationServiceError {
            state = .error(error.errorDescription ?? "Verification failed")
            return false
        } catch {
            state = .error("Unable to verify account. Please try again.")
            return false
        }
    }

    /// Reset form
    func reset() {
        state = .idle
        accountHolderName = ""
        accountNumber = ""
        confirmAccountNumber = ""
        ifscCode = ""
        verificationResult = nil
    }

    /// Clear error
    func clearError() {
        if case .error = state {
            state = .idle
        }
    }

    // MARK: - Private Methods

    private func buildVerificationErrorMessage(_ result: BankVerificationResult) -> String {
        if let nameMatchScore = result.nameMatchScore,
           nameMatchScore < result.nameMatchThreshold {
            return "Account holder name doesn't match. Expected: \(result.verifiedName ?? "Unknown"). Score: \(nameMatchScore)%"
        }

        return result.message
    }
}

// MARK: - Preview Helpers

extension AddBankViewModel {
    static var preview: AddBankViewModel {
        AddBankViewModel(
            tenancyId: "test-tenancy",
            verificationService: MockVerificationService()
        )
    }

    static var previewFilled: AddBankViewModel {
        let vm = AddBankViewModel(
            tenancyId: "test-tenancy",
            verificationService: MockVerificationService()
        )
        vm.accountHolderName = "RAJESH KUMAR GUPTA"
        vm.accountNumber = "1234567890123"
        vm.confirmAccountNumber = "1234567890123"
        vm.ifscCode = "HDFC0001234"
        return vm
    }

    static var previewVerifying: AddBankViewModel {
        let vm = previewFilled
        vm.state = .verifying
        return vm
    }

    static var previewError: AddBankViewModel {
        let vm = previewFilled
        vm.state = .error("Account holder name doesn't match bank records")
        return vm
    }
}
