/// Tenancy.swift
/// Flent Secured v2 - Tenancy Model
///
/// Represents a rental tenancy relationship between tenant and landlord

import Foundation

// MARK: - Tenancy

struct Tenancy: Equatable, Identifiable, Codable {
    let id: String
    var status: TenancyStatus
    var propertyAddress: String
    var monthlyRentPaise: Int
    var rentDueDay: Int
    var bankVerified: Bool
    var utilityVerified: Bool
    var landlordApproved: Bool

    // Optional landlord info
    var landlordName: String?
    var landlordPhone: String?

    /// Monthly rent in rupees
    var monthlyRent: Double {
        Double(monthlyRentPaise) / 100.0
    }

    /// Whether all verifications are complete
    var isFullyVerified: Bool {
        bankVerified && utilityVerified && landlordApproved
    }

    /// Number of completed verification steps
    var completedVerifications: Int {
        var count = 0
        if bankVerified { count += 1 }
        if utilityVerified { count += 1 }
        if landlordApproved { count += 1 }
        return count
    }

    /// Total number of verification steps
    static let totalVerificationSteps = 3
}

// MARK: - Tenancy Status

enum TenancyStatus: String, Equatable, Codable {
    case pending
    case pendingVerification = "pending_verification"
    case active
    case inactive

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .pendingVerification: return "Verification Pending"
        case .active: return "Active"
        case .inactive: return "Inactive"
        }
    }
}
