/// UserStatus.swift
/// Flent Secured v2 - User Status Enumeration
///
/// Defines all possible user status states in the app lifecycle
/// Critical for navigation and feature gating

import Foundation

// MARK: - User Status

/// User status state machine:
/// ```
/// NEW USER → SIGNED_UP → WAITLISTED → QUALIFIED → COMPLETE
///                                  ↘ NOT_ELIGIBLE
/// ```
enum UserStatus: String, Codable, CaseIterable {
    /// User has signed up but not uploaded documents
    case signedUp = "signed_up"

    /// User has uploaded documents and is in waitlist
    case waitlisted = "waitlisted"

    /// User is qualified but verifications pending
    case qualified = "qualified"

    /// User has completed all verifications
    case complete = "complete"

    /// User is not eligible for the service
    case notEligible = "not_eligible"

    /// Unknown status (fallback)
    case unknown = "unknown"

    // MARK: - Display Properties

    var displayName: String {
        switch self {
        case .signedUp:
            return "Getting Started"
        case .waitlisted:
            return "In Waitlist"
        case .qualified:
            return "Verified"
        case .complete:
            return "Active"
        case .notEligible:
            return "Not Eligible"
        case .unknown:
            return "Unknown"
        }
    }

    var description: String {
        switch self {
        case .signedUp:
            return "Upload your rental agreement to continue"
        case .waitlisted:
            return "We're reviewing your application"
        case .qualified:
            return "Complete your verification to start paying rent"
        case .complete:
            return "You're all set to pay rent"
        case .notEligible:
            return "We're not available in your area yet"
        case .unknown:
            return "Please contact support"
        }
    }

    // MARK: - Feature Gating

    /// Can user access the home screen
    var canAccessHome: Bool {
        switch self {
        case .qualified, .complete:
            return true
        case .signedUp, .waitlisted, .notEligible, .unknown:
            return false
        }
    }

    /// Can user initiate payments
    var canPay: Bool {
        switch self {
        case .qualified, .complete:
            return true
        case .signedUp, .waitlisted, .notEligible, .unknown:
            return false
        }
    }

    /// Can user use credit card payment
    var canUseCreditCard: Bool {
        self == .complete
    }

    /// Can user use all payment methods
    var hasFullPaymentAccess: Bool {
        self == .complete
    }

    /// Needs to complete verification steps
    var needsVerification: Bool {
        self == .qualified
    }

    /// Is in onboarding flow
    var isOnboarding: Bool {
        switch self {
        case .signedUp, .waitlisted:
            return true
        case .qualified, .complete, .notEligible, .unknown:
            return false
        }
    }
}

// Note: WaitlistState is defined in App/AppCoordinator.swift
