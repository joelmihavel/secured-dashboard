/// VerificationServiceProtocol.swift
/// Flent Secured v2 - Verification Service Protocol
///
/// Defines the contract for verification operations
/// Including bank, utility, and landlord verification

import Foundation

// MARK: - Verification Service Protocol

protocol VerificationServiceProtocol {
    /// Verify bank account via penny drop
    func verifyBank(
        tenancyId: String,
        accountHolderName: String,
        accountNumber: String,
        ifscCode: String,
        partyType: PartyType
    ) async throws -> BankVerificationResult

    /// Get list of utility operators
    func getUtilityOperators() async throws -> [UtilityOperator]

    /// Verify utility bill
    func verifyUtility(
        tenancyId: String,
        consumerNumber: String,
        operatorCode: String
    ) async throws -> UtilityVerificationResult

    /// Send landlord invite
    func sendLandlordInvite(
        tenancyId: String,
        channel: InviteChannel
    ) async throws -> LandlordInviteResult

    /// Get verification status for a tenancy
    func getVerificationStatus(tenancyId: String) async throws -> VerificationStatus
}

// MARK: - Party Type

enum PartyType: String, Codable {
    case tenant
    case landlord
}

// MARK: - Bank Verification Result

struct BankVerificationResult: Codable, Equatable {
    let bankAccountId: String
    let verified: Bool
    let accountNumberMasked: String
    let ifscCode: String
    let verifiedName: String?
    let nameMatchScore: Int?
    let nameMatchThreshold: Int
    let verificationStatus: String
    let bankName: String?
    let branch: String?
    let message: String

    enum CodingKeys: String, CodingKey {
        case bankAccountId = "bank_account_id"
        case verified
        case accountNumberMasked = "account_number_masked"
        case ifscCode = "ifsc_code"
        case verifiedName = "verified_name"
        case nameMatchScore = "name_match_score"
        case nameMatchThreshold = "name_match_threshold"
        case verificationStatus = "verification_status"
        case bankName = "bank_name"
        case branch
        case message
    }

    var isNameMatch: Bool {
        guard let score = nameMatchScore else { return false }
        return score >= nameMatchThreshold
    }
}

// MARK: - Utility Operator

struct UtilityOperator: Codable, Identifiable {
    let operatorCode: String
    let operatorName: String
    let state: String

    var id: String { operatorCode }

    enum CodingKeys: String, CodingKey {
        case operatorCode = "operator_code"
        case operatorName = "operator_name"
        case state
    }
}

// MARK: - Utility Verification Result

struct UtilityVerificationResult: Codable {
    let verificationId: String
    let verified: Bool
    let nameVerified: Bool
    let addressVerified: Bool
    let consumerName: String?
    let landlordName: String?
    let nameMatchScore: Int?
    let addressMatchScore: Int?
    let matchingMethod: String
    let nameReasoning: String?
    let addressReasoning: String?
    let message: String

    enum CodingKeys: String, CodingKey {
        case verificationId = "verification_id"
        case verified
        case nameVerified = "name_verified"
        case addressVerified = "address_verified"
        case consumerName = "consumer_name"
        case landlordName = "landlord_name"
        case nameMatchScore = "name_match_score"
        case addressMatchScore = "address_match_score"
        case matchingMethod = "matching_method"
        case nameReasoning = "name_reasoning"
        case addressReasoning = "address_reasoning"
        case message
    }
}

// MARK: - Invite Channel

enum InviteChannel: String, Codable {
    case sms
    case whatsapp
}

// MARK: - Landlord Invite Result

struct LandlordInviteResult: Codable {
    let inviteId: String
    let status: String
    let sentVia: String
    let expiresAt: String
    let message: String
    let inviteLink: String?

    enum CodingKeys: String, CodingKey {
        case inviteId = "invite_id"
        case status
        case sentVia = "sent_via"
        case expiresAt = "expires_at"
        case message
        case inviteLink = "invite_link"
    }
}

// MARK: - Verification Status

struct VerificationStatus: Codable {
    let tenancyId: String
    let bankVerified: Bool
    let utilityVerified: Bool
    let landlordApproved: Bool
    let bankVerificationDate: String?
    let utilityVerificationDate: String?
    let landlordApprovalDate: String?

    /// Landlord invite status: "pending", "declined", "approved", or nil if not sent
    let landlordInviteStatus: String?

    /// Days since landlord invite was sent (nil if not sent)
    let landlordInviteDaysSinceSent: Int?

    enum CodingKeys: String, CodingKey {
        case tenancyId = "tenancy_id"
        case bankVerified = "bank_verified"
        case utilityVerified = "utility_verified"
        case landlordApproved = "landlord_approved"
        case bankVerificationDate = "bank_verification_date"
        case utilityVerificationDate = "utility_verification_date"
        case landlordApprovalDate = "landlord_approval_date"
        case landlordInviteStatus = "landlord_invite_status"
        case landlordInviteDaysSinceSent = "landlord_invite_days_since_sent"
    }

    var isComplete: Bool {
        bankVerified && utilityVerified && landlordApproved
    }

    var completedCount: Int {
        [bankVerified, utilityVerified, landlordApproved].filter { $0 }.count
    }

    var totalCount: Int { 3 }

    var progress: Double {
        Double(completedCount) / Double(totalCount)
    }
}

// MARK: - Verification Service Error

enum VerificationServiceError: LocalizedError {
    case notAuthenticated
    case tenancyNotFound
    case invalidBankDetails
    case bankVerificationFailed(String)
    case utilityVerificationFailed(String)
    case inviteFailed(String)
    case alreadyVerified
    case networkError(Error)
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Please sign in to continue"
        case .tenancyNotFound:
            return "No active tenancy found"
        case .invalidBankDetails:
            return "Invalid bank account details"
        case .bankVerificationFailed(let reason):
            return "Bank verification failed: \(reason)"
        case .utilityVerificationFailed(let reason):
            return "Utility verification failed: \(reason)"
        case .inviteFailed(let reason):
            return "Failed to send invite: \(reason)"
        case .alreadyVerified:
            return "This verification is already complete"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let message):
            return message
        }
    }
}
