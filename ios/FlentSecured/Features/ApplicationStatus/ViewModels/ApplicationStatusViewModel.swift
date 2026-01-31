/// ApplicationStatusViewModel.swift
/// Flent Secured v2 - Application Status ViewModel
///
/// Manages application review state, referral code validation, and benefits display
///
/// Figma: 41-11206, 41-11825 - Application Status screens

import Foundation
import Observation
import UIKit

// MARK: - Application Status Step

/// Represents a step in the application status timeline
struct ApplicationStatusStep: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let subtitle: String
    let isComplete: Bool
    let isCurrent: Bool
}

// MARK: - Application Status

/// Overall application status
enum ApplicationStatus: String, Codable, Equatable {
    case submitted = "submitted"
    case inReview = "in_review"
    case approved = "approved"
    case rejected = "rejected"
    case settingUp = "setting_up"

    var displayTitle: String {
        switch self {
        case .submitted:
            return "Application Submitted"
        case .inReview:
            return "In Review"
        case .approved:
            return "Approved"
        case .rejected:
            return "Not Approved"
        case .settingUp:
            return "Setting Up"
        }
    }
}

// MARK: - Benefit Item

/// Represents a benefit of Flent Secured
struct BenefitItem: Identifiable, Equatable {
    let id = UUID()
    let icon: String
    let title: String
    let description: String
}

// MARK: - Application Status ViewModel

@MainActor
@Observable
final class ApplicationStatusViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case loading
        case loaded
        case validatingCode
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .idle

    /// User's first name for welcome message
    private(set) var firstName: String = ""

    /// User's last name for welcome message
    private(set) var lastName: String = ""

    /// Full name for display
    var fullName: String {
        "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
    }

    /// Current application status
    private(set) var applicationStatus: ApplicationStatus = .inReview

    /// Whether we're still setting things up (alternate header)
    var isSettingUp: Bool {
        applicationStatus == .settingUp
    }

    /// Submission date
    private(set) var submissionDate: Date = Date()

    /// Formatted submission date
    var formattedSubmissionDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: submissionDate)
    }

    /// Estimated review time
    private(set) var estimatedReviewTime: String = "Approximately 24 hrs"

    /// Application status timeline steps
    var timelineSteps: [ApplicationStatusStep] {
        switch applicationStatus {
        case .submitted:
            return [
                ApplicationStatusStep(
                    title: "Application Sent",
                    subtitle: "Submitted on \(formattedSubmissionDate)",
                    isComplete: true,
                    isCurrent: false
                ),
                ApplicationStatusStep(
                    title: "In Review",
                    subtitle: estimatedReviewTime,
                    isComplete: false,
                    isCurrent: true
                ),
                ApplicationStatusStep(
                    title: "Account Status",
                    subtitle: "Pending",
                    isComplete: false,
                    isCurrent: false
                )
            ]
        case .inReview, .settingUp:
            return [
                ApplicationStatusStep(
                    title: "Application Sent",
                    subtitle: "Submitted on \(formattedSubmissionDate)",
                    isComplete: true,
                    isCurrent: false
                ),
                ApplicationStatusStep(
                    title: "In Review",
                    subtitle: estimatedReviewTime,
                    isComplete: false,
                    isCurrent: true
                ),
                ApplicationStatusStep(
                    title: "Account Status",
                    subtitle: "Pending",
                    isComplete: false,
                    isCurrent: false
                )
            ]
        case .approved:
            return [
                ApplicationStatusStep(
                    title: "Application Sent",
                    subtitle: "Submitted on \(formattedSubmissionDate)",
                    isComplete: true,
                    isCurrent: false
                ),
                ApplicationStatusStep(
                    title: "In Review",
                    subtitle: "Completed",
                    isComplete: true,
                    isCurrent: false
                ),
                ApplicationStatusStep(
                    title: "Account Status",
                    subtitle: "Approved",
                    isComplete: true,
                    isCurrent: true
                )
            ]
        case .rejected:
            return [
                ApplicationStatusStep(
                    title: "Application Sent",
                    subtitle: "Submitted on \(formattedSubmissionDate)",
                    isComplete: true,
                    isCurrent: false
                ),
                ApplicationStatusStep(
                    title: "In Review",
                    subtitle: "Completed",
                    isComplete: true,
                    isCurrent: false
                ),
                ApplicationStatusStep(
                    title: "Account Status",
                    subtitle: "Not Approved",
                    isComplete: false,
                    isCurrent: true
                )
            ]
        }
    }

    // MARK: - Referral Properties

    /// Current members onboarded count
    private(set) var membersOnboarded: Int = 18

    /// Total members target
    private(set) var membersTarget: Int = 150

    /// Referral progress (0.0 to 1.0)
    var referralProgress: Double {
        Double(membersOnboarded) / Double(membersTarget)
    }

    /// Referral progress display text
    var referralProgressText: String {
        "\(membersOnboarded) / \(membersTarget)"
    }

    /// Referral code input (4 characters)
    var referralCode: String = "" {
        didSet {
            // Limit to uppercase alphanumeric characters
            let filtered = referralCode
                .uppercased()
                .filter { $0.isLetter || $0.isNumber }
            if filtered != referralCode {
                referralCode = filtered
            }
            // Limit to 4 characters
            if referralCode.count > 4 {
                referralCode = String(referralCode.prefix(4))
            }
        }
    }

    /// Whether referral code is complete (4 characters)
    var isReferralCodeComplete: Bool {
        referralCode.count == 4
    }

    /// Error message for invalid referral code
    private(set) var referralCodeError: String?

    /// Whether referral code was successfully validated
    private(set) var referralCodeValid: Bool = false

    // MARK: - Benefits

    /// List of benefits to display
    let benefits: [BenefitItem] = [
        BenefitItem(
            icon: "percent",
            title: "Earn 1% back for paying rent on time",
            description: ""
        ),
        BenefitItem(
            icon: "chart.line.uptrend.xyaxis",
            title: "Build a stronger rent history",
            description: ""
        ),
        BenefitItem(
            icon: "creditcard.fill",
            title: "Unlock exclusive renting benefits over time",
            description: ""
        )
    ]

    // MARK: - Dependencies

    private let userService: UserServiceProtocol

    // MARK: - Initialization

    init(userService: UserServiceProtocol = AppEnvironment.shared.userService) {
        self.userService = userService
    }

    // MARK: - Actions

    /// Load application status data
    @MainActor
    func loadStatus() async {
        state = .loading

        do {
            // Fetch user data and application status
            let dashboard = try await userService.getDashboardData()

            // Update properties from dashboard
            firstName = dashboard.user.firstName ?? ""
            lastName = dashboard.user.lastName ?? ""

            // Determine application status based on user status
            switch dashboard.user.status {
            case .signedUp:
                applicationStatus = .submitted
            case .waitlisted:
                applicationStatus = .inReview
            case .qualified, .complete:
                applicationStatus = .approved
            case .notEligible:
                applicationStatus = .rejected
            case .unknown:
                applicationStatus = .settingUp
            }

            // Parse submission date from user data if available
            // For now, use a default recent date
            let calendar = Calendar.current
            submissionDate = calendar.date(byAdding: .day, value: -1, to: Date()) ?? Date()

            // Update estimated review time based on status
            if applicationStatus == .settingUp {
                estimatedReviewTime = "Approximately 24-48 hrs"
            } else {
                estimatedReviewTime = "Approximately 24 hrs"
            }

            state = .loaded

        } catch {
            state = .error(error.localizedDescription)
        }
    }

    /// Validate and apply referral code
    @MainActor
    func validateReferralCode() async {
        guard isReferralCodeComplete else { return }

        state = .validatingCode
        referralCodeError = nil

        do {
            // Simulate API call to validate referral code
            try await Task.sleep(nanoseconds: 1_000_000_000) // 1 second

            // In production, this would call the actual referral validation endpoint
            // let result = try await referralService.validateCode(referralCode)

            // For now, simulate validation (accept codes starting with "FL")
            if referralCode.hasPrefix("FL") {
                referralCodeValid = true
                HapticManager.shared.success()
            } else {
                referralCodeError = "Invalid referral code"
                referralCodeValid = false
                HapticManager.shared.error()
            }

            state = .loaded

        } catch {
            referralCodeError = "Failed to validate code"
            referralCodeValid = false
            state = .loaded
        }
    }

    /// Copy referral link to clipboard
    func copyReferralLink() {
        // In production, this would use the user's actual referral link
        let link = "https://flent.app/invite/\(referralCode)"
        UIPasteboard.general.string = link
        HapticManager.shared.lightImpact()
    }

    // MARK: - Computed State Properties

    var isLoading: Bool {
        state == .loading
    }

    var isValidatingCode: Bool {
        state == .validatingCode
    }

    var errorMessage: String? {
        if case .error(let message) = state {
            return message
        }
        return nil
    }
}

// MARK: - Preview Helpers

extension ApplicationStatusViewModel {

    /// Preview instance with default state
    static var preview: ApplicationStatusViewModel {
        let vm = ApplicationStatusViewModel(userService: MockUserService())
        vm.firstName = "Rishabh"
        vm.lastName = "Agnihotri"
        vm.applicationStatus = .inReview
        vm.submissionDate = {
            let formatter = DateFormatter()
            formatter.dateFormat = "d MMM yyyy"
            return formatter.date(from: "27 Jan 2026") ?? Date()
        }()
        vm.state = .loaded
        return vm
    }

    /// Preview instance with setting up state
    static var previewSettingUp: ApplicationStatusViewModel {
        let vm = ApplicationStatusViewModel(userService: MockUserService())
        vm.firstName = "Rishabh"
        vm.lastName = "Agnihotri"
        vm.applicationStatus = .settingUp
        vm.estimatedReviewTime = "Approximately 24-48 hrs"
        vm.submissionDate = {
            let formatter = DateFormatter()
            formatter.dateFormat = "d MMM yyyy"
            return formatter.date(from: "27 Jan 2026") ?? Date()
        }()
        vm.state = .loaded
        return vm
    }

    /// Preview instance with approved state
    static var previewApproved: ApplicationStatusViewModel {
        let vm = ApplicationStatusViewModel(userService: MockUserService())
        vm.firstName = "Rishabh"
        vm.lastName = "Agnihotri"
        vm.applicationStatus = .approved
        vm.state = .loaded
        return vm
    }
}
