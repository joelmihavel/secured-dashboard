/// PaymentStatus.swift
/// Flent Secured v2 - Payment Status Enumeration
///
/// Defines all possible payment states

import SwiftUI

// MARK: - Payment Status

enum PaymentStatus: String, Codable, CaseIterable {
    /// Payment initiated but not processed
    case initiated = "initiated"

    /// Payment is being processed
    case processing = "processing"

    /// Payment completed successfully
    case success = "success"

    /// Payment failed
    case failed = "failed"

    /// Payment was refunded
    case refunded = "refunded"

    /// Payment settled to landlord
    case settled = "settled"

    // MARK: - Display Properties

    var displayName: String {
        switch self {
        case .initiated: return "Initiated"
        case .processing: return "Processing"
        case .success: return "Successful"
        case .failed: return "Failed"
        case .refunded: return "Refunded"
        case .settled: return "Settled"
        }
    }

    var color: Color {
        switch self {
        case .success, .settled: return AppColors.success
        case .failed, .refunded: return AppColors.error
        case .initiated, .processing: return AppColors.warning
        }
    }

    var iconName: String {
        switch self {
        case .success, .settled: return "checkmark.circle.fill"
        case .failed, .refunded: return "xmark.circle.fill"
        case .initiated, .processing: return "clock.fill"
        }
    }

    // MARK: - State Checks

    var isTerminal: Bool {
        switch self {
        case .success, .failed, .refunded, .settled:
            return true
        case .initiated, .processing:
            return false
        }
    }

    var isSuccess: Bool {
        self == .success || self == .settled
    }

    var isFailed: Bool {
        self == .failed || self == .refunded
    }

    var isPending: Bool {
        self == .initiated || self == .processing
    }
}

// Note: HomeState is defined in App/AppCoordinator.swift

// MARK: - Pending Step

struct PendingStep: Identifiable, Equatable {
    let id: String
    let type: StepType
    let title: String
    let subtitle: String
    let isComplete: Bool

    enum StepType: String {
        case bank = "bank"
        case utility = "utility"
        case landlord = "landlord"
    }

    var iconName: String {
        switch type {
        case .bank: return "building.columns"
        case .utility: return "bolt.fill"
        case .landlord: return "person.crop.circle.badge.checkmark"
        }
    }

    static func bankStep(isComplete: Bool) -> PendingStep {
        PendingStep(
            id: "bank",
            type: .bank,
            title: "Add Bank Account",
            subtitle: "Verify your bank account",
            isComplete: isComplete
        )
    }

    static func utilityStep(isComplete: Bool) -> PendingStep {
        PendingStep(
            id: "utility",
            type: .utility,
            title: "Verify Utility",
            subtitle: "Connect an electricity bill",
            isComplete: isComplete
        )
    }

    static func landlordStep(isComplete: Bool) -> PendingStep {
        PendingStep(
            id: "landlord",
            type: .landlord,
            title: "Landlord Approval",
            subtitle: "Invite your landlord",
            isComplete: isComplete
        )
    }
}
