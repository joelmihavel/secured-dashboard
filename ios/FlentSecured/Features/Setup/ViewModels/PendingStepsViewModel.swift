/// PendingStepsViewModel.swift
/// Flent Secured v2 - Pending Steps ViewModel
///
/// Manages verification status for QUALIFIED users
/// Tracks bank, utility, and landlord verification steps
///
/// Figma: Setup / Pending Steps

import Foundation
import Observation

// MARK: - Pending Steps ViewModel

@Observable
final class PendingStepsViewModel {

    // MARK: - State

    enum State: Equatable {
        case loading
        case loaded
        case error(String)
    }

    // MARK: - Verification Step

    struct VerificationStep: Identifiable {
        let id: String
        let number: Int
        let title: String
        let subtitle: String
        let icon: String
        var isCompleted: Bool
        let route: Route
    }

    // MARK: - Properties

    private(set) var state: State = .loading
    private(set) var steps: [VerificationStep] = []

    // MARK: - Computed Properties

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var completedStepsCount: Int {
        steps.filter { $0.isCompleted }.count
    }

    var totalSteps: Int {
        steps.count
    }

    var progress: Double {
        guard totalSteps > 0 else { return 0 }
        return Double(completedStepsCount) / Double(totalSteps)
    }

    var allStepsCompleted: Bool {
        completedStepsCount == totalSteps && totalSteps > 0
    }

    var canSkipToHome: Bool {
        // Allow skip if at least one step is completed
        completedStepsCount > 0
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
        initializeSteps()
    }

    // MARK: - Actions

    /// Load current verification status
    @MainActor
    func loadStatus() async {
        state = .loading

        do {
            // First get the current tenancy to get the tenancyId
            guard let tenancy = try await userService.getCurrentTenancy() else {
                state = .error("No tenancy found. Please complete onboarding first.")
                return
            }

            let status = try await verificationService.getVerificationStatus(tenancyId: tenancy.id)
            updateSteps(with: status)
            state = .loaded

            // Check if user should be upgraded to COMPLETE
            if allStepsCompleted {
                await checkForStatusUpgrade()
            }
        } catch let error as VerificationServiceError {
            state = .error(error.errorDescription ?? "Failed to load status")
        } catch let error as UserServiceError {
            state = .error(error.errorDescription ?? "Failed to load tenancy")
        } catch {
            state = .error("Something went wrong")
        }
    }

    /// Refresh status
    @MainActor
    func refresh() async {
        await loadStatus()
    }

    // MARK: - Private Methods

    private func initializeSteps() {
        steps = [
            VerificationStep(
                id: "bank",
                number: 1,
                title: "Add landlord's bank account",
                subtitle: "For rent transfer",
                icon: "building.columns.fill",
                isCompleted: false,
                route: .addBank
            ),
            VerificationStep(
                id: "utility",
                number: 2,
                title: "Verify utility bill",
                subtitle: "Proof of address",
                icon: "bolt.fill",
                isCompleted: false,
                route: .addUtility
            ),
            VerificationStep(
                id: "landlord",
                number: 3,
                title: "Get landlord approval",
                subtitle: "Confirm tenancy details",
                icon: "person.fill.checkmark",
                isCompleted: false,
                route: .inviteLandlord
            )
        ]
    }

    private func updateSteps(with status: VerificationStatus) {
        for i in steps.indices {
            switch steps[i].id {
            case "bank":
                steps[i].isCompleted = status.bankVerified
            case "utility":
                steps[i].isCompleted = status.utilityVerified
            case "landlord":
                steps[i].isCompleted = status.landlordApproved
            default:
                break
            }
        }
    }

    @MainActor
    private func checkForStatusUpgrade() async {
        // If all steps are complete, the user should be upgraded to COMPLETE
        // This happens server-side, but we can refresh user status
        do {
            let _ = try await userService.getCurrentUser()
            // AppState will be updated via the service
        } catch {
            // Ignore - status will be checked on next app launch
        }
    }
}

// MARK: - Preview Helpers

extension PendingStepsViewModel {
    static var preview: PendingStepsViewModel {
        let vm = PendingStepsViewModel(
            verificationService: MockVerificationService(),
            userService: MockUserService()
        )
        vm.state = .loaded
        return vm
    }

    static var previewPartialComplete: PendingStepsViewModel {
        let vm = PendingStepsViewModel(
            verificationService: MockVerificationService(),
            userService: MockUserService()
        )
        vm.steps[0].isCompleted = true
        vm.state = .loaded
        return vm
    }

    static var previewAllComplete: PendingStepsViewModel {
        let vm = PendingStepsViewModel(
            verificationService: MockVerificationService(),
            userService: MockUserService()
        )
        vm.steps[0].isCompleted = true
        vm.steps[1].isCompleted = true
        vm.steps[2].isCompleted = true
        vm.state = .loaded
        return vm
    }
}
