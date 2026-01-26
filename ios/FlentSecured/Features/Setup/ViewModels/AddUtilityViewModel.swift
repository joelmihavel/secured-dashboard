/// AddUtilityViewModel.swift
/// Flent Secured v2 - Add Utility ViewModel
///
/// Manages utility bill verification via API Club
/// Loads operators and handles verification flow
///
/// Figma: Setup / Add Utility

import Foundation
import Observation

// MARK: - Add Utility ViewModel

@Observable
final class AddUtilityViewModel {

    // MARK: - State

    enum State: Equatable {
        case loadingOperators
        case operatorsLoaded
        case verifying
        case verified(UtilityVerificationResult)
        case error(String)

        static func == (lhs: State, rhs: State) -> Bool {
            switch (lhs, rhs) {
            case (.loadingOperators, .loadingOperators),
                 (.operatorsLoaded, .operatorsLoaded),
                 (.verifying, .verifying):
                return true
            case (.verified(let l), .verified(let r)):
                return l.verificationId == r.verificationId
            case (.error(let l), .error(let r)):
                return l == r
            default:
                return false
            }
        }
    }

    // MARK: - Properties

    private(set) var state: State = .loadingOperators
    private(set) var operators: [UtilityOperator] = []
    private(set) var verificationResult: UtilityVerificationResult?

    // MARK: - Form Fields

    var selectedOperator: UtilityOperator?
    var consumerNumber: String = ""

    // MARK: - Computed Properties

    var isLoadingOperators: Bool {
        if case .loadingOperators = state { return true }
        return false
    }

    var isVerifying: Bool {
        if case .verifying = state { return true }
        return false
    }

    var isVerified: Bool {
        if case .verified = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var isFormValid: Bool {
        selectedOperator != nil && isConsumerNumberValid
    }

    var canVerify: Bool {
        isFormValid && !isVerifying
    }

    var isConsumerNumberValid: Bool {
        // Consumer numbers vary by operator, but generally 8-20 characters
        consumerNumber.count >= 8 && consumerNumber.count <= 20
    }

    var selectedOperatorName: String {
        selectedOperator?.operatorName ?? "Select provider"
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

    /// Load available utility operators
    @MainActor
    func loadOperators() async {
        state = .loadingOperators

        do {
            operators = try await verificationService.getUtilityOperators()
            state = .operatorsLoaded
        } catch {
            // Use fallback operators on error
            operators = Self.fallbackOperators
            state = .operatorsLoaded
        }
    }

    /// Verify the utility bill
    @MainActor
    func verifyUtility() async -> Bool {
        guard canVerify, let operatorCode = selectedOperator?.operatorCode else {
            state = .error("Please select a provider and enter consumer number")
            return false
        }

        state = .verifying

        do {
            let result = try await verificationService.verifyUtility(
                tenancyId: tenancyId,
                consumerNumber: consumerNumber.trimmingCharacters(in: .whitespaces),
                operatorCode: operatorCode
            )

            verificationResult = result

            if result.verified {
                state = .verified(result)
                return true
            } else {
                let errorMessage = buildVerificationErrorMessage(result)
                state = .error(errorMessage)
                return false
            }
        } catch let error as VerificationServiceError {
            state = .error(error.errorDescription ?? "Verification failed")
            return false
        } catch {
            state = .error("Unable to verify utility bill. Please try again.")
            return false
        }
    }

    /// Select an operator
    func selectOperator(_ op: UtilityOperator) {
        selectedOperator = op
        clearError()
    }

    /// Reset form
    func reset() {
        state = .operatorsLoaded
        selectedOperator = nil
        consumerNumber = ""
        verificationResult = nil
    }

    /// Clear error
    func clearError() {
        if case .error = state {
            state = .operatorsLoaded
        }
    }

    // MARK: - Private Methods

    private func buildVerificationErrorMessage(_ result: UtilityVerificationResult) -> String {
        if !result.nameVerified {
            return "Name on utility bill doesn't match landlord name"
        }
        if !result.addressVerified {
            return "Address on utility bill doesn't match property address"
        }
        return result.message ?? "Utility verification failed"
    }

    // MARK: - Fallback Operators

    private static let fallbackOperators: [UtilityOperator] = [
        UtilityOperator(operatorCode: "BESCOM", operatorName: "BESCOM - Bangalore", state: "Karnataka"),
        UtilityOperator(operatorCode: "TPDDL", operatorName: "Tata Power Delhi", state: "Delhi"),
        UtilityOperator(operatorCode: "MSEDCL", operatorName: "MSEDCL - Maharashtra", state: "Maharashtra"),
        UtilityOperator(operatorCode: "TANGEDCO", operatorName: "TANGEDCO - Tamil Nadu", state: "Tamil Nadu"),
        UtilityOperator(operatorCode: "KSEB", operatorName: "KSEB - Kerala", state: "Kerala"),
        UtilityOperator(operatorCode: "WBSEDCL", operatorName: "WBSEDCL - West Bengal", state: "West Bengal"),
        UtilityOperator(operatorCode: "APEPDCL", operatorName: "APEPDCL - Andhra Pradesh", state: "Andhra Pradesh"),
        UtilityOperator(operatorCode: "UGVCL", operatorName: "UGVCL - Gujarat", state: "Gujarat"),
    ]
}

// MARK: - Preview Helpers

extension AddUtilityViewModel {
    static var preview: AddUtilityViewModel {
        let vm = AddUtilityViewModel(
            tenancyId: "test-tenancy",
            verificationService: MockVerificationService()
        )
        vm.operators = fallbackOperators
        vm.state = .operatorsLoaded
        return vm
    }

    static var previewLoading: AddUtilityViewModel {
        let vm = AddUtilityViewModel(
            tenancyId: "test-tenancy",
            verificationService: MockVerificationService()
        )
        vm.state = .loadingOperators
        return vm
    }

    static var previewFilled: AddUtilityViewModel {
        let vm = preview
        vm.selectedOperator = fallbackOperators.first
        vm.consumerNumber = "K1234567890"
        return vm
    }

    static var previewVerifying: AddUtilityViewModel {
        let vm = previewFilled
        vm.state = .verifying
        return vm
    }

    static var previewError: AddUtilityViewModel {
        let vm = previewFilled
        vm.state = .error("Name on utility bill doesn't match landlord name")
        return vm
    }
}
