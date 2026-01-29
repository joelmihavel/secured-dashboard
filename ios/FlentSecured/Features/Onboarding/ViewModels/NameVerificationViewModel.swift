/// NameVerificationViewModel.swift
/// Flent Secured v2 - Name Verification ViewModel
///
/// Manages name fetching from Mobile 360 and user confirmation
/// Handles identity verification flow
///
/// Figma: onboarding / Name Verification

import Foundation
import Observation

// MARK: - Name Verification ViewModel

@MainActor
@Observable
final class NameVerificationViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case fetchingName
        case nameLoaded(fetchedName: String)
        case saving
        case saved
        case error(String)
        case skipped
    }

    // MARK: - Properties

    var firstName: String = "" {
        didSet {
            if case .error = state {
                state = nameWasFetched ? .nameLoaded(fetchedName: fetchedFullName) : .idle
            }
        }
    }

    var lastName: String = "" {
        didSet {
            if case .error = state {
                state = nameWasFetched ? .nameLoaded(fetchedName: fetchedFullName) : .idle
            }
        }
    }

    private(set) var state: State = .idle
    private(set) var fetchedFullName: String = ""
    private(set) var nameWasFetched: Bool = false

    // MARK: - Computed Properties

    var fullName: String {
        [firstName, lastName]
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    var isValidName: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var isLoading: Bool {
        switch state {
        case .fetchingName, .saving:
            return true
        default:
            return false
        }
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var canProceed: Bool {
        isValidName && !isLoading
    }

    var showSkipOption: Bool {
        // Allow skip if name fetch failed or user wants to enter manually
        if case .error = state { return true }
        return !nameWasFetched
    }

    // MARK: - Dependencies

    private let userService: UserServiceProtocol

    // MARK: - Initialization

    init(userService: UserServiceProtocol = AppEnvironment.shared.userService) {
        self.userService = userService
    }

    // MARK: - Actions

    /// Fetch name from Mobile 360 (Cashfree identity verification)
    @MainActor
    func fetchNameFromIdentity() async {
        state = .fetchingName

        do {
            // Call verify-identity Edge Function to fetch name from Mobile 360
            // This uses the consent given during OTP verification
            let user = try await userService.getCurrentUser()

            if let fName = user.firstName, !fName.isEmpty {
                firstName = fName
                lastName = user.lastName ?? ""
                fetchedFullName = user.fullName
                nameWasFetched = true
                state = .nameLoaded(fetchedName: fetchedFullName)
            } else {
                // No name fetched - user needs to enter manually
                state = .idle
            }
        } catch {
            // Identity fetch failed - allow manual entry
            state = .error("Couldn't fetch your name automatically. Please enter it manually.")
        }
    }

    /// Save the confirmed/entered name
    @MainActor
    func saveName() async -> Bool {
        guard isValidName else {
            state = .error("Please enter your first name")
            return false
        }

        state = .saving

        do {
            _ = try await userService.updateProfile(
                firstName: firstName.trimmingCharacters(in: .whitespaces),
                lastName: lastName.trimmingCharacters(in: .whitespaces).isEmpty ? nil : lastName.trimmingCharacters(in: .whitespaces)
            )

            state = .saved
            return true
        } catch let error as UserServiceError {
            state = .error(error.errorDescription ?? "Failed to save name")
            return false
        } catch {
            state = .error("Something went wrong. Please try again.")
            return false
        }
    }

    /// Skip name verification (manual entry later)
    func skipNameVerification() {
        state = .skipped
    }

    /// Reset state
    func reset() {
        state = .idle
        firstName = ""
        lastName = ""
        fetchedFullName = ""
        nameWasFetched = false
    }

    // MARK: - Validation

    func validateName() -> Bool {
        let trimmedFirst = firstName.trimmingCharacters(in: .whitespaces)

        if trimmedFirst.isEmpty {
            state = .error("Please enter your first name")
            return false
        }

        if trimmedFirst.count < 2 {
            state = .error("First name must be at least 2 characters")
            return false
        }

        // Check for valid characters (letters and spaces only)
        let nameCharacterSet = CharacterSet.letters.union(.whitespaces)
        if trimmedFirst.unicodeScalars.contains(where: { !nameCharacterSet.contains($0) }) {
            state = .error("Name can only contain letters")
            return false
        }

        return true
    }
}

// MARK: - Preview Helpers

extension NameVerificationViewModel {
    static var preview: NameVerificationViewModel {
        NameVerificationViewModel(userService: MockUserService())
    }

    static var previewWithName: NameVerificationViewModel {
        let vm = NameVerificationViewModel(userService: MockUserService())
        vm.firstName = "Amit"
        vm.lastName = "Kumar"
        vm.fetchedFullName = "Amit Kumar"
        vm.nameWasFetched = true
        vm.state = .nameLoaded(fetchedName: "Amit Kumar")
        return vm
    }

    static var previewLoading: NameVerificationViewModel {
        let vm = NameVerificationViewModel(userService: MockUserService())
        vm.state = .fetchingName
        return vm
    }

    static var previewError: NameVerificationViewModel {
        let vm = NameVerificationViewModel(userService: MockUserService())
        vm.state = .error("Couldn't fetch your name. Please enter manually.")
        return vm
    }
}
