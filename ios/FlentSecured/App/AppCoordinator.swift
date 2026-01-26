/// AppCoordinator.swift
/// Flent Secured v2 - Navigation Coordinator
///
/// Manages all navigation in the app using NavigationStack
/// Implements type-safe routing with Route enum

import SwiftUI
import Observation

// MARK: - App Coordinator

@Observable
final class AppCoordinator {

    // MARK: - Navigation State

    /// Main navigation path
    var path = NavigationPath()

    /// Currently presented sheet
    var sheet: Route?

    /// Currently presented full screen cover
    var fullScreenCover: Route?

    // MARK: - Navigation Actions

    /// Navigate to a route (push)
    func navigate(to route: Route) {
        path.append(route)
    }

    /// Pop the last route
    func pop() {
        guard !path.isEmpty else { return }
        path.removeLast()
    }

    /// Pop to root
    func popToRoot() {
        path = NavigationPath()
    }

    /// Pop multiple levels
    func pop(_ count: Int) {
        let removeCount = min(count, path.count)
        path.removeLast(removeCount)
    }

    /// Present a sheet
    func present(sheet route: Route) {
        self.sheet = route
    }

    /// Present a full screen cover
    func presentFullScreen(_ route: Route) {
        self.fullScreenCover = route
    }

    /// Dismiss any presented view
    func dismiss() {
        sheet = nil
        fullScreenCover = nil
    }

    // MARK: - Deep Link Handling

    /// Handle incoming deep link
    func handle(deepLink url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
              components.scheme == "flent" else {
            return
        }

        switch components.path {
        case "/payment/success":
            if let id = queryValue(from: components, key: "id") {
                navigate(to: .paymentResult(paymentId: id, success: true))
            }

        case "/payment/failure":
            if let id = queryValue(from: components, key: "id") {
                navigate(to: .paymentResult(paymentId: id, success: false))
            }

        case "/home":
            popToRoot()

        default:
            break
        }
    }

    // MARK: - Initial Route

    /// Determine the initial route based on app state
    @MainActor
    func determineInitialRoute(for appState: AppState) -> Route {
        // Not authenticated
        guard appState.isAuthenticated else {
            return .splash
        }

        // Check user status
        guard let userStatus = appState.userStatus else {
            return .phoneEntry
        }

        switch userStatus {
        case .unknown, .signedUp:
            return .phoneEntry

        case .waitlisted:
            return .waitlist

        case .notEligible:
            return .waitlist

        case .qualified:
            // Check if setup is complete
            if let tenancy = appState.currentTenancy, !tenancy.isFullyVerified {
                return .pendingSteps
            }
            return .home(state: .activeQualified)

        case .complete:
            return .home(state: .activeComplete)
        }
    }

    // MARK: - Private Helpers

    private func queryValue(from components: URLComponents, key: String) -> String? {
        components.queryItems?.first(where: { $0.name == key })?.value
    }
}

// MARK: - Route

/// Type-safe navigation routes
enum Route: Hashable {

    // MARK: - Splash & Auth

    case splash
    case phoneEntry
    case otpVerification(phone: String)

    // MARK: - Onboarding

    case nameVerification
    case agreementUpload
    case agreementReview(extractionId: String)
    case waitlist  // View manages its own state via WaitlistViewModel

    // MARK: - Setup

    case pendingSteps
    case addBank
    case addUtility
    case inviteLandlord

    // MARK: - Main App

    case home(state: HomeState)
    case payment
    case paymentMethods
    case paymentSummary(paymentId: String)
    case paymentProcessing(paymentId: String)
    case paymentResult(paymentId: String, success: Bool)

    // MARK: - Transactions

    case transactions
    case transactionDetail(id: String)

    // MARK: - Profile

    case profile
    case settings
    case referral
}

// MARK: - Screen States

/// Waitlist screen states (used by WaitlistViewModel)
enum WaitlistState: Hashable {
    case pending
    case pendingLong           // > 24 hours
    case accepted
    case rejected(reason: String)
    case referralEntry
    case referralInvalid
    case referralValid

    // MARK: - Display Properties

    var title: String {
        switch self {
        case .pending, .pendingLong:
            return "You're on the waitlist!"
        case .accepted:
            return "You're in!"
        case .rejected:
            return "Not eligible"
        case .referralEntry:
            return "Have a referral code?"
        case .referralInvalid:
            return "Invalid code"
        case .referralValid:
            return "Referral applied!"
        }
    }

    var subtitle: String {
        switch self {
        case .pending:
            return "We're reviewing your application. This usually takes a few hours."
        case .pendingLong:
            return "Thanks for your patience. We're working to expand our service to your area."
        case .accepted:
            return "Complete your setup to start paying rent through Flent."
        case .rejected(let reason):
            return reason
        case .referralEntry:
            return "Enter it to skip the queue"
        case .referralInvalid:
            return "Please check and try again"
        case .referralValid:
            return "You've skipped the queue. Let's get you set up."
        }
    }

    var iconName: String {
        switch self {
        case .pending, .pendingLong:
            return "hourglass.circle.fill"
        case .accepted, .referralValid:
            return "checkmark.circle.fill"
        case .rejected:
            return "xmark.circle.fill"
        case .referralEntry:
            return "ticket.fill"
        case .referralInvalid:
            return "xmark.circle"
        }
    }
}

/// Home screen states
enum HomeState: Hashable {
    case zeroState             // Setup incomplete
    case activeQualified       // QUALIFIED user (UPI/NetBanking only)
    case activeComplete        // COMPLETE user (all methods)
    case latePayment           // After 7th, no cashback
    case missedPayment         // Overdue
    case paidThisMonth(settlementStatus: SettlementStatus)
}

// Note: SettlementStatus is defined in Core/Services/Protocols/PaymentServiceProtocol.swift

// MARK: - Route Extensions

extension Route: Identifiable {
    var id: String {
        switch self {
        case .splash: return "splash"
        case .phoneEntry: return "phoneEntry"
        case .otpVerification(let phone): return "otp-\(phone)"
        case .nameVerification: return "nameVerification"
        case .agreementUpload: return "agreementUpload"
        case .agreementReview(let id): return "agreementReview-\(id)"
        case .waitlist: return "waitlist"
        case .pendingSteps: return "pendingSteps"
        case .addBank: return "addBank"
        case .addUtility: return "addUtility"
        case .inviteLandlord: return "inviteLandlord"
        case .home(let state): return "home-\(state)"
        case .payment: return "payment"
        case .paymentMethods: return "paymentMethods"
        case .paymentSummary(let id): return "paymentSummary-\(id)"
        case .paymentProcessing(let id): return "paymentProcessing-\(id)"
        case .paymentResult(let id, let success): return "paymentResult-\(id)-\(success)"
        case .transactions: return "transactions"
        case .transactionDetail(let id): return "transactionDetail-\(id)"
        case .profile: return "profile"
        case .settings: return "settings"
        case .referral: return "referral"
        }
    }
}
