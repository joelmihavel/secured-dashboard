/// SetupFlowViewModel.swift
/// Flent Secured v2 - Setup Flow ViewModel
///
/// Manages the post-agreement upload setup flow state
/// Handles step progression, landlord invitation status, and completion tracking
///
/// Figma Screens:
/// - 41-10859: Upload address proof
/// - 41-11006: Invite landlord
/// - 41-10712: Add landlord bank details
/// - 41-4969: Waiting for landlord response
/// - 41-5587: Landlord declined

import Foundation
import Observation

// MARK: - Setup Flow ViewModel

@MainActor
@Observable
final class SetupFlowViewModel {

    // MARK: - Setup Step

    enum SetupStep: Int, CaseIterable, Identifiable {
        case addBankDetails = 0
        case uploadAddressProof = 1
        case inviteLandlord = 2

        var id: Int { rawValue }

        /// Figma card title (orange text, brand500)
        /// Multi-line format with "to" connector shown separately
        var title: String {
            switch self {
            case .addBankDetails:
                return "Add your landlord's\nbank details"
            case .uploadAddressProof:
                return "Upload\naddress proof"
            case .inviteLandlord:
                return "Invite your landlord"
            }
        }

        /// Figma connector word (white text, shows between title and subtitle)
        var connector: String {
            return "to"
        }

        /// Figma card subtitle (gray text, neutral500)
        var subtitle: String {
            switch self {
            case .addBankDetails:
                return "enable payouts"
            case .uploadAddressProof:
                return "verify your tenancy"
            case .inviteLandlord:
                return "finish setup"
            }
        }

        /// Figma: All setup screens show "Start Flenting" with right arrow
        var buttonTitle: String {
            return "Start Flenting"
        }

        var route: Route {
            switch self {
            case .addBankDetails:
                return .addBank
            case .uploadAddressProof:
                return .addUtility
            case .inviteLandlord:
                return .inviteLandlord
            }
        }
    }

    // MARK: - Landlord Status

    enum LandlordStatus: Equatable {
        case notInvited
        case pending(canResend: Bool, daysSinceSent: Int)
        case declined
        case approved
    }

    // MARK: - State

    enum State: Equatable {
        case loading
        case loaded
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .loading
    private(set) var currentStep: SetupStep = .addBankDetails
    private(set) var completedSteps: Set<SetupStep> = []
    private(set) var landlordStatus: LandlordStatus = .notInvited
    private(set) var isSendingReminder = false

    // MARK: - Computed Properties

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var currentStepIndex: Int {
        currentStep.rawValue
    }

    var totalSteps: Int {
        SetupStep.allCases.count
    }

    var isStepCompleted: Bool {
        completedSteps.contains(currentStep)
    }

    var showLandlordStatusCard: Bool {
        switch landlordStatus {
        case .pending, .declined:
            return true
        default:
            return false
        }
    }

    var isSetupComplete: Bool {
        completedSteps.count == totalSteps && landlordStatus == .approved
    }

    var canProceedToNext: Bool {
        completedSteps.contains(currentStep) || currentStep == .inviteLandlord
    }

    // MARK: - Dependencies

    private let verificationService: VerificationServiceProtocol
    private let userService: UserServiceProtocol

    // MARK: - Initialization

    init(
        verificationService: VerificationServiceProtocol = AppEnvironment.shared.verificationService,
        userService: UserServiceProtocol = AppEnvironment.shared.userService
    ) {
        self.verificationService = verificationService
        self.userService = userService
    }

    // MARK: - Actions

    /// Load current setup status
    func loadStatus() async {
        state = .loading

        do {
            guard let tenancy = try await userService.getCurrentTenancy() else {
                state = .error("No tenancy found. Please complete onboarding first.")
                return
            }

            let status = try await verificationService.getVerificationStatus(tenancyId: tenancy.id)
            updateState(with: status)
            state = .loaded
        } catch let error as VerificationServiceError {
            state = .error(error.errorDescription ?? "Failed to load status")
        } catch let error as UserServiceError {
            state = .error(error.errorDescription ?? "Failed to load tenancy")
        } catch {
            state = .error("Something went wrong")
        }
    }

    /// Refresh status
    func refresh() async {
        await loadStatus()
    }

    /// Move to next step
    func nextStep() {
        guard let nextIndex = SetupStep(rawValue: currentStep.rawValue + 1) else {
            return
        }
        currentStep = nextIndex
    }

    /// Move to previous step
    func previousStep() {
        guard let prevIndex = SetupStep(rawValue: currentStep.rawValue - 1) else {
            return
        }
        currentStep = prevIndex
    }

    /// Go to specific step
    func goToStep(_ step: SetupStep) {
        currentStep = step
    }

    /// Mark step as completed
    func markStepCompleted(_ step: SetupStep) {
        completedSteps.insert(step)
    }

    /// Send reminder to landlord
    func sendReminder() async -> Bool {
        guard case .pending(let canResend, _) = landlordStatus, canResend else {
            return false
        }

        isSendingReminder = true
        defer { isSendingReminder = false }

        do {
            guard let tenancy = try await userService.getCurrentTenancy() else {
                return false
            }

            _ = try await verificationService.sendLandlordInvite(
                tenancyId: tenancy.id,
                channel: .sms
            )

            // Update landlord status to pending with reset timer
            landlordStatus = .pending(canResend: false, daysSinceSent: 0)
            return true
        } catch {
            return false
        }
    }

    // MARK: - Private Methods

    private func updateState(with status: VerificationStatus) {
        // Update completed steps
        completedSteps.removeAll()

        if status.bankVerified {
            completedSteps.insert(.addBankDetails)
        }

        if status.utilityVerified {
            completedSteps.insert(.uploadAddressProof)
        }

        if status.landlordApproved {
            completedSteps.insert(.inviteLandlord)
            landlordStatus = .approved
        } else if let inviteStatus = status.landlordInviteStatus {
            switch inviteStatus {
            case "pending":
                let daysSinceSent = status.landlordInviteDaysSinceSent ?? 0
                landlordStatus = .pending(canResend: daysSinceSent >= 1, daysSinceSent: daysSinceSent)
            case "declined":
                landlordStatus = .declined
            default:
                landlordStatus = .notInvited
            }
        }

        // Determine current step (first incomplete step)
        if !completedSteps.contains(.addBankDetails) {
            currentStep = .addBankDetails
        } else if !completedSteps.contains(.uploadAddressProof) {
            currentStep = .uploadAddressProof
        } else {
            currentStep = .inviteLandlord
        }
    }
}

// MARK: - Preview Helpers

extension SetupFlowViewModel {
    static var preview: SetupFlowViewModel {
        let vm = SetupFlowViewModel(
            verificationService: MockVerificationService(),
            userService: MockUserService()
        )
        vm.state = .loaded
        return vm
    }

    static var previewStep2: SetupFlowViewModel {
        let vm = SetupFlowViewModel(
            verificationService: MockVerificationService(),
            userService: MockUserService()
        )
        vm.completedSteps.insert(.addBankDetails)
        vm.currentStep = .uploadAddressProof
        vm.state = .loaded
        return vm
    }

    static var previewStep3: SetupFlowViewModel {
        let vm = SetupFlowViewModel(
            verificationService: MockVerificationService(),
            userService: MockUserService()
        )
        vm.completedSteps.insert(.addBankDetails)
        vm.completedSteps.insert(.uploadAddressProof)
        vm.currentStep = .inviteLandlord
        vm.state = .loaded
        return vm
    }

    static var previewWaitingLandlord: SetupFlowViewModel {
        let vm = SetupFlowViewModel(
            verificationService: MockVerificationService(),
            userService: MockUserService()
        )
        vm.completedSteps.insert(.addBankDetails)
        vm.completedSteps.insert(.uploadAddressProof)
        vm.currentStep = .inviteLandlord
        vm.landlordStatus = .pending(canResend: true, daysSinceSent: 2)
        vm.state = .loaded
        return vm
    }

    static var previewLandlordDeclined: SetupFlowViewModel {
        let vm = SetupFlowViewModel(
            verificationService: MockVerificationService(),
            userService: MockUserService()
        )
        vm.completedSteps.insert(.addBankDetails)
        vm.completedSteps.insert(.uploadAddressProof)
        vm.currentStep = .inviteLandlord
        vm.landlordStatus = .declined
        vm.state = .loaded
        return vm
    }

    /// Create a preview ViewModel from a SetupFlowState (for ScreenLauncher)
    static func previewFromState(_ state: SetupFlowState) -> SetupFlowViewModel {
        let vm = SetupFlowViewModel(
            verificationService: MockVerificationService(),
            userService: MockUserService()
        )
        vm.state = .loaded

        switch state {
        case .step1BankDetails:
            vm.currentStep = .addBankDetails

        case .step2AddressProof:
            vm.completedSteps.insert(.addBankDetails)
            vm.currentStep = .uploadAddressProof

        case .step3InviteLandlord:
            vm.completedSteps.insert(.addBankDetails)
            vm.completedSteps.insert(.uploadAddressProof)
            vm.currentStep = .inviteLandlord

        case .waitingForLandlord(let daysSinceSent, let canResend):
            vm.completedSteps.insert(.addBankDetails)
            vm.completedSteps.insert(.uploadAddressProof)
            vm.currentStep = .inviteLandlord
            vm.landlordStatus = .pending(canResend: canResend, daysSinceSent: daysSinceSent)

        case .landlordDeclined:
            vm.completedSteps.insert(.addBankDetails)
            vm.completedSteps.insert(.uploadAddressProof)
            vm.currentStep = .inviteLandlord
            vm.landlordStatus = .declined
        }

        return vm
    }
}
