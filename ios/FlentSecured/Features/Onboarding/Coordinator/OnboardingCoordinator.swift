/// OnboardingCoordinator.swift
/// Flent Secured v2 - Onboarding Flow Coordinator
///
/// Manages the onboarding flow navigation and state
/// Coordinates between onboarding screens
///
/// Flow: Phone → OTP → Name → Agreement Upload → Agreement Review → Waitlist

import Foundation
import Observation

// MARK: - Onboarding Coordinator

@Observable
final class OnboardingCoordinator {

    // MARK: - Onboarding Step

    enum Step: Int, CaseIterable, Identifiable {
        case phoneEntry = 0
        case otpVerification = 1
        case nameVerification = 2
        case agreementUpload = 3
        case agreementReview = 4
        case waitlist = 5

        var id: Int { rawValue }

        var title: String {
            switch self {
            case .phoneEntry: return "Phone"
            case .otpVerification: return "Verify"
            case .nameVerification: return "Name"
            case .agreementUpload: return "Upload"
            case .agreementReview: return "Review"
            case .waitlist: return "Status"
            }
        }

        var isDocumentStep: Bool {
            self == .agreementUpload || self == .agreementReview
        }
    }

    // MARK: - Properties

    private(set) var currentStep: Step = .phoneEntry
    private(set) var completedSteps: Set<Step> = []

    // Data passed between steps
    var phoneNumber: String?
    var extractionId: String?
    var authResult: AuthResult?

    // MARK: - Computed Properties

    var progress: Double {
        Double(currentStep.rawValue) / Double(Step.allCases.count - 1)
    }

    var canGoBack: Bool {
        currentStep.rawValue > Step.phoneEntry.rawValue
    }

    var showProgressIndicator: Bool {
        currentStep != .waitlist
    }

    var currentStepIndex: Int {
        currentStep.rawValue
    }

    var totalSteps: Int {
        Step.allCases.count - 1 // Exclude waitlist from progress
    }

    // MARK: - Navigation

    /// Move to next step in onboarding
    func nextStep() -> Step? {
        guard let nextIndex = Step(rawValue: currentStep.rawValue + 1) else {
            return nil
        }

        completedSteps.insert(currentStep)
        currentStep = nextIndex
        return currentStep
    }

    /// Move to previous step
    func previousStep() -> Step? {
        guard let previousIndex = Step(rawValue: currentStep.rawValue - 1) else {
            return nil
        }

        currentStep = previousIndex
        return currentStep
    }

    /// Jump to specific step (if allowed)
    func goTo(step: Step) {
        // Only allow jumping to completed steps or current step
        guard completedSteps.contains(step) || step == currentStep else {
            return
        }
        currentStep = step
    }

    /// Complete onboarding with specific status
    func completeOnboarding(with status: UserStatus) -> Route {
        switch status {
        case .waitlisted:
            currentStep = .waitlist
            return .waitlist
        case .qualified:
            return .pendingSteps
        case .complete:
            return .home(state: .activeComplete)
        case .signedUp:
            // Should continue with document upload
            if currentStep.rawValue < Step.agreementUpload.rawValue {
                currentStep = .agreementUpload
            }
            return .agreementUpload
        case .notEligible:
            currentStep = .waitlist
            return .waitlist
        case .unknown:
            return .phoneEntry
        }
    }

    /// Reset coordinator state
    func reset() {
        currentStep = .phoneEntry
        completedSteps = []
        phoneNumber = nil
        extractionId = nil
        authResult = nil
    }

    // MARK: - Step Completion Handlers

    /// Handle phone entry completion
    func phoneEntryCompleted(phone: String) {
        phoneNumber = phone
        _ = nextStep()
    }

    /// Handle OTP verification completion
    func otpVerificationCompleted(result: AuthResult) {
        authResult = result

        // Determine next step based on whether user is new or existing
        if result.isNewUser {
            // New user - continue to name verification
            _ = nextStep()
        } else {
            // Existing user - they've already completed onboarding
            // App coordinator will check their status and route appropriately
            // For now, continue the flow (app coordinator handles final routing)
            _ = nextStep()
        }
    }

    /// Handle name verification completion
    func nameVerificationCompleted() {
        _ = nextStep()
    }

    /// Handle agreement upload completion
    func agreementUploadCompleted(extractionId: String) {
        self.extractionId = extractionId
        _ = nextStep()
    }

    /// Handle agreement review completion (user confirmed extraction)
    func agreementReviewCompleted() {
        completedSteps.insert(.agreementReview)
        currentStep = .waitlist
    }

    // MARK: - Route Mapping

    /// Convert current step to Route
    func currentRoute() -> Route {
        switch currentStep {
        case .phoneEntry:
            return .phoneEntry
        case .otpVerification:
            return .otpVerification(phone: phoneNumber ?? "")
        case .nameVerification:
            return .nameVerification
        case .agreementUpload:
            return .agreementUpload
        case .agreementReview:
            return .agreementReview(extractionId: extractionId ?? "")
        case .waitlist:
            return .waitlist
        }
    }

    /// Convert Route to Step (if applicable)
    func step(for route: Route) -> Step? {
        switch route {
        case .phoneEntry:
            return .phoneEntry
        case .otpVerification(_):
            return .otpVerification
        case .nameVerification:
            return .nameVerification
        case .agreementUpload:
            return .agreementUpload
        case .agreementReview(_):
            return .agreementReview
        case .waitlist:
            return .waitlist
        case .splash, .home, .payment, .paymentMethods, .paymentProcessing, .paymentResult, .paymentSummary, .transactions, .transactionDetail, .profile, .personalDetails, .tenancyDetails, .paymentHistory, .helpFAQ, .settings, .pendingSteps, .addBank, .addUtility, .inviteLandlord, .referral:
            return nil
        }
    }
}

// MARK: - Preview Helpers

extension OnboardingCoordinator {
    static var preview: OnboardingCoordinator {
        OnboardingCoordinator()
    }

    static var previewAtOTP: OnboardingCoordinator {
        let coordinator = OnboardingCoordinator()
        coordinator.phoneNumber = "+919876543210"
        coordinator.currentStep = .otpVerification
        coordinator.completedSteps = [.phoneEntry]
        return coordinator
    }

    static var previewAtName: OnboardingCoordinator {
        let coordinator = OnboardingCoordinator()
        coordinator.phoneNumber = "+919876543210"
        coordinator.currentStep = .nameVerification
        coordinator.completedSteps = [.phoneEntry, .otpVerification]
        return coordinator
    }

    static var previewAtUpload: OnboardingCoordinator {
        let coordinator = OnboardingCoordinator()
        coordinator.currentStep = .agreementUpload
        coordinator.completedSteps = [.phoneEntry, .otpVerification, .nameVerification]
        return coordinator
    }

    static var previewAtReview: OnboardingCoordinator {
        let coordinator = OnboardingCoordinator()
        coordinator.currentStep = .agreementReview
        coordinator.extractionId = "test-extraction-id"
        coordinator.completedSteps = [.phoneEntry, .otpVerification, .nameVerification, .agreementUpload]
        return coordinator
    }

    static var previewAtWaitlist: OnboardingCoordinator {
        let coordinator = OnboardingCoordinator()
        coordinator.currentStep = .waitlist
        coordinator.completedSteps = Set(Step.allCases.dropLast())
        return coordinator
    }
}
