/// WaitlistViewModel.swift
/// Flent Secured v2 - Waitlist ViewModel
///
/// Manages waitlist status display and polling
/// Handles transition when user is approved
///
/// Figma: onboarding / waitlist

import Foundation
import Observation

// MARK: - Waitlist ViewModel

@MainActor
@Observable
final class WaitlistViewModel {

    // MARK: - State

    enum State: Equatable {
        case loading
        case pending(position: Int?, estimatedDays: Int?)
        case pendingLong(estimatedDays: Int)
        case approved
        case rejected(reason: String)
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .loading
    private(set) var lastUpdated: Date?

    /// User's full name for display
    private(set) var userName: String = ""

    /// Submission date for timeline
    private(set) var submissionDate: Date?

    /// Total members onboarded (for release gauge)
    private(set) var membersOnboarded: Int = 18

    /// Total member slots (for release gauge)
    private(set) var totalMemberSlots: Int = 150

    /// Estimated review time text
    private(set) var reviewTimeText: String = "Approximately 24 hrs"

    /// Rejection reasons list (for rejected state)
    private(set) var rejectionReasons: [String] = []

    /// Countdown seconds until next application window (rejected state)
    private(set) var nextApplicationCountdown: Int = 0

    /// Timer for countdown (nonisolated for deinit access)
    nonisolated(unsafe) private var countdownTimer: Timer?

    nonisolated(unsafe) private var pollingTimer: Timer?
    private let pollInterval: TimeInterval = 30 // Check every 30 seconds

    // MARK: - Computed Properties

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var isPolling: Bool {
        pollingTimer != nil
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var waitlistState: WaitlistState {
        switch state {
        case .loading:
            return .pending
        case .pending:
            return .pending
        case .pendingLong:
            return .pendingLong
        case .approved:
            return .accepted
        case .rejected(let reason):
            return .rejected(reason: reason)
        case .error:
            return .pending
        }
    }

    var position: Int? {
        if case .pending(let pos, _) = state { return pos }
        return nil
    }

    var estimatedWaitDays: Int? {
        switch state {
        case .pending(_, let days):
            return days
        case .pendingLong(let days):
            return days
        default:
            return nil
        }
    }

    var title: String {
        waitlistState.title
    }

    var subtitle: String {
        waitlistState.subtitle
    }

    var iconName: String {
        waitlistState.iconName
    }

    var showPosition: Bool {
        if case .pending(let pos, _) = state {
            return pos != nil
        }
        return false
    }

    var positionText: String {
        guard let pos = position else { return "" }
        return "#\(pos) in queue"
    }

    var showContinueButton: Bool {
        if case .approved = state { return true }
        return false
    }

    var showContactSupport: Bool {
        if case .rejected = state { return true }
        if case .error = state { return true }
        return false
    }

    // MARK: - Dependencies

    private let userService: UserServiceProtocol

    // MARK: - Initialization

    init(userService: UserServiceProtocol = AppEnvironment.shared.userService, userName: String = "") {
        self.userService = userService
        self.userName = userName
    }

    deinit {
        countdownTimer?.invalidate()
        // Timer cleanup will happen automatically when the object is deallocated
    }

    // MARK: - Countdown Timer

    func startCountdownTimer(seconds: Int) {
        nextApplicationCountdown = seconds
        countdownTimer?.invalidate()
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in
                if self.nextApplicationCountdown > 0 {
                    self.nextApplicationCountdown -= 1
                } else {
                    self.countdownTimer?.invalidate()
                }
            }
        }
    }

    var countdownText: String {
        let hours = nextApplicationCountdown / 3600
        let minutes = (nextApplicationCountdown % 3600) / 60
        let seconds = nextApplicationCountdown % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }

    // MARK: - Actions

    /// Load initial waitlist status
    @MainActor
    func loadStatus() async {
        state = .loading

        do {
            // Fetch user profile for name
            let profile = try await userService.getCurrentUser()
            userName = profile.fullName.isEmpty ? "User" : profile.fullName

            // Set submission date (use profile creation date or current date)
            if let createdAt = profile.createdAt, let date = ISO8601DateFormatter().date(from: createdAt) {
                submissionDate = date
            } else {
                submissionDate = Date()
            }

            let status = try await userService.getWaitlistStatus()
            updateState(from: status)
            lastUpdated = Date()

            // Update review time text based on state
            if case .pendingLong = state {
                reviewTimeText = "Approximately 24-48 hrs"
            } else {
                reviewTimeText = "Approximately 24 hrs"
            }

            // Start polling if still pending
            if case .pending = state {
                startPolling()
            } else if case .pendingLong = state {
                startPolling()
            }

            // Start countdown for rejected state
            if case .rejected = state {
                // Start 24-hour countdown (mock: 28:24:24 = 102264 seconds)
                startCountdownTimer(seconds: 102264)
            }
        } catch let error as UserServiceError {
            state = .error(error.errorDescription ?? "Failed to load status")
        } catch {
            state = .error("Something went wrong")
        }
    }

    /// Refresh status manually
    @MainActor
    func refresh() async {
        await loadStatus()
    }

    /// Start polling for status updates
    func startPolling() {
        stopPolling()

        pollingTimer = Timer.scheduledTimer(withTimeInterval: pollInterval, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            Task { @MainActor in
                do {
                    let status = try await self.userService.getWaitlistStatus()
                    self.updateState(from: status)
                    self.lastUpdated = Date()

                    // Stop polling if no longer pending
                    if case .approved = self.state {
                        self.stopPolling()
                    } else if case .rejected = self.state {
                        self.stopPolling()
                    }
                } catch {
                    // Ignore polling errors, continue trying
                }
            }
        }
    }

    /// Stop polling
    func stopPolling() {
        pollingTimer?.invalidate()
        pollingTimer = nil
    }

    // MARK: - Private Methods

    private func updateState(from status: WaitlistStatusData) {
        switch status.waitlistState {
        case .pending:
            state = .pending(position: status.position, estimatedDays: status.estimatedWaitDays)
        case .pendingLong:
            state = .pendingLong(estimatedDays: status.estimatedWaitDays ?? 7)
        case .accepted, .referralValid:
            state = .approved
        case .rejected(let reason):
            state = .rejected(reason: reason)
            // Set rejection reasons for UI
            rejectionReasons = [
                "You're renting outside Bangalore",
                "You did not use an invite code.",
                "Your rent agreement didn't qualify."
            ]
        case .referralEntry, .referralInvalid:
            // Referral states are handled by the view directly, not via API response
            state = .pending(position: status.position, estimatedDays: status.estimatedWaitDays)
        }
    }
}

// MARK: - Next Route

extension WaitlistViewModel {
    /// Determine next route when user is approved
    func nextRoute() -> Route? {
        guard case .approved = state else { return nil }
        // Navigate to post-approval welcome flow first
        return .postApprovalStep1
    }
}

// MARK: - Preview Helpers

extension WaitlistViewModel {
    static var preview: WaitlistViewModel {
        let vm = WaitlistViewModel(userService: MockUserService())
        vm.state = .pending(position: 42, estimatedDays: 1)
        return vm
    }

    static var previewLoading: WaitlistViewModel {
        let vm = WaitlistViewModel(userService: MockUserService())
        vm.state = .loading
        return vm
    }

    static var previewLongWait: WaitlistViewModel {
        let vm = WaitlistViewModel(userService: MockUserService())
        vm.state = .pendingLong(estimatedDays: 5)
        return vm
    }

    static var previewApproved: WaitlistViewModel {
        let vm = WaitlistViewModel(userService: MockUserService())
        vm.state = .approved
        return vm
    }

    static var previewRejected: WaitlistViewModel {
        let vm = WaitlistViewModel(userService: MockUserService())
        vm.state = .rejected(reason: "We're not available in your city yet. We'll notify you when we expand.")
        return vm
    }

    static var previewError: WaitlistViewModel {
        let vm = WaitlistViewModel(userService: MockUserService())
        vm.state = .error("Failed to load status")
        return vm
    }
}
