/// UserServiceProtocol.swift
/// Flent Secured v2 - User Service Protocol
///
/// Defines the contract for user-related operations
/// Including profile, tenancy, and dashboard data

import Foundation

// MARK: - User Service Protocol

protocol UserServiceProtocol {
    /// Fetch current user's profile
    func getCurrentUser() async throws -> UserProfileData

    /// Update user profile
    func updateProfile(firstName: String?, lastName: String?) async throws -> UserProfileData

    /// Get dashboard data (home screen)
    func getDashboardData() async throws -> DashboardData

    /// Get current tenancy
    func getCurrentTenancy() async throws -> TenancyData?

    /// Get waitlist status
    func getWaitlistStatus() async throws -> WaitlistStatusData
}

// MARK: - User Profile Data

struct UserProfileData: Codable, Equatable {
    let id: String
    let phone: String?
    let firstName: String?
    let lastName: String?
    let email: String?
    let role: String?
    let isRoleLocked: Bool?
    let userStatus: String?
    let kycStatus: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case phone
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case role
        case isRoleLocked = "is_role_locked"
        case userStatus = "user_status"
        case kycStatus = "kyc_status"
        case createdAt = "created_at"
    }

    var fullName: String {
        [firstName, lastName]
            .compactMap { $0 }
            .joined(separator: " ")
    }

    var status: UserStatus {
        guard let userStatus = userStatus else { return .unknown }
        return UserStatus(rawValue: userStatus) ?? .unknown
    }
}

// MARK: - Dashboard Data

struct DashboardData: Codable {
    let user: UserProfileData
    let tenancy: TenancyData?
    let upcomingPayment: UpcomingPaymentData?
    let cashback: CashbackData
    let recentPayments: [PaymentData]
    let notifications: [NotificationData]
    let unreadNotificationCount: Int

    enum CodingKeys: String, CodingKey {
        case user
        case tenancy
        case upcomingPayment = "upcoming_payment"
        case cashback
        case recentPayments = "recent_payments"
        case notifications
        case unreadNotificationCount = "unread_notification_count"
    }
}

// MARK: - Tenancy Data

struct TenancyData: Codable, Identifiable, Equatable {
    let id: String
    let userId: String
    let status: String
    let propertyAddress: String?
    let propertyCity: String?
    let propertyState: String?
    let propertyPincode: String?
    let monthlyRentPaise: Int
    let securityDepositPaise: Int?
    let rentDueDay: Int
    let leaseStartDate: String?
    let leaseEndDate: String?
    let landlordName: String?
    let landlordPhone: String?
    let landlordEmail: String?
    let bankVerified: Bool
    let utilityVerified: Bool
    let landlordApproved: Bool
    let landlordDeclined: Bool
    let landlordInvitationSentAt: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case status
        case propertyAddress = "property_address"
        case propertyCity = "property_city"
        case propertyState = "property_state"
        case propertyPincode = "property_pincode"
        case monthlyRentPaise = "monthly_rent_paise"
        case securityDepositPaise = "security_deposit_paise"
        case rentDueDay = "rent_due_day"
        case leaseStartDate = "lease_start_date"
        case leaseEndDate = "lease_end_date"
        case landlordName = "landlord_name"
        case landlordPhone = "landlord_phone"
        case landlordEmail = "landlord_email"
        case bankVerified = "bank_verified"
        case utilityVerified = "utility_verified"
        case landlordApproved = "landlord_approved"
        case landlordDeclined = "landlord_declined"
        case landlordInvitationSentAt = "landlord_invitation_sent_at"
        case createdAt = "created_at"
    }

    /// Initialize with defaults for optional fields
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        userId = try container.decode(String.self, forKey: .userId)
        status = try container.decode(String.self, forKey: .status)
        propertyAddress = try container.decodeIfPresent(String.self, forKey: .propertyAddress)
        propertyCity = try container.decodeIfPresent(String.self, forKey: .propertyCity)
        propertyState = try container.decodeIfPresent(String.self, forKey: .propertyState)
        propertyPincode = try container.decodeIfPresent(String.self, forKey: .propertyPincode)
        monthlyRentPaise = try container.decode(Int.self, forKey: .monthlyRentPaise)
        securityDepositPaise = try container.decodeIfPresent(Int.self, forKey: .securityDepositPaise)
        rentDueDay = try container.decode(Int.self, forKey: .rentDueDay)
        leaseStartDate = try container.decodeIfPresent(String.self, forKey: .leaseStartDate)
        leaseEndDate = try container.decodeIfPresent(String.self, forKey: .leaseEndDate)
        landlordName = try container.decodeIfPresent(String.self, forKey: .landlordName)
        landlordPhone = try container.decodeIfPresent(String.self, forKey: .landlordPhone)
        landlordEmail = try container.decodeIfPresent(String.self, forKey: .landlordEmail)
        bankVerified = try container.decode(Bool.self, forKey: .bankVerified)
        utilityVerified = try container.decode(Bool.self, forKey: .utilityVerified)
        landlordApproved = try container.decode(Bool.self, forKey: .landlordApproved)
        landlordDeclined = try container.decodeIfPresent(Bool.self, forKey: .landlordDeclined) ?? false
        landlordInvitationSentAt = try container.decodeIfPresent(String.self, forKey: .landlordInvitationSentAt)
        createdAt = try container.decode(String.self, forKey: .createdAt)
    }

    /// Memberwise initializer for mock data and testing
    init(
        id: String,
        userId: String,
        status: String,
        propertyAddress: String? = nil,
        propertyCity: String? = nil,
        propertyState: String? = nil,
        propertyPincode: String? = nil,
        monthlyRentPaise: Int,
        securityDepositPaise: Int? = nil,
        rentDueDay: Int,
        leaseStartDate: String? = nil,
        leaseEndDate: String? = nil,
        landlordName: String? = nil,
        landlordPhone: String? = nil,
        landlordEmail: String? = nil,
        bankVerified: Bool,
        utilityVerified: Bool,
        landlordApproved: Bool,
        landlordDeclined: Bool = false,
        landlordInvitationSentAt: String? = nil,
        createdAt: String
    ) {
        self.id = id
        self.userId = userId
        self.status = status
        self.propertyAddress = propertyAddress
        self.propertyCity = propertyCity
        self.propertyState = propertyState
        self.propertyPincode = propertyPincode
        self.monthlyRentPaise = monthlyRentPaise
        self.securityDepositPaise = securityDepositPaise
        self.rentDueDay = rentDueDay
        self.leaseStartDate = leaseStartDate
        self.leaseEndDate = leaseEndDate
        self.landlordName = landlordName
        self.landlordPhone = landlordPhone
        self.landlordEmail = landlordEmail
        self.bankVerified = bankVerified
        self.utilityVerified = utilityVerified
        self.landlordApproved = landlordApproved
        self.landlordDeclined = landlordDeclined
        self.landlordInvitationSentAt = landlordInvitationSentAt
        self.createdAt = createdAt
    }

    /// Monthly rent in rupees
    var monthlyRent: Double {
        Double(monthlyRentPaise) / 100.0
    }

    /// Full property address
    var fullAddress: String {
        [propertyAddress, propertyCity, propertyState, propertyPincode]
            .compactMap { $0 }
            .joined(separator: ", ")
    }

    /// Whether all verifications are complete
    var isFullyVerified: Bool {
        bankVerified && utilityVerified && landlordApproved
    }

    /// Count of completed verifications
    var completedVerificationCount: Int {
        [bankVerified, utilityVerified, landlordApproved].filter { $0 }.count
    }

    // MARK: - Convenience Aliases for UI

    /// Alias for bankVerified (UI naming)
    var bankDetailsComplete: Bool {
        bankVerified
    }

    /// Alias for utilityVerified (UI naming)
    var addressProofComplete: Bool {
        utilityVerified
    }

    /// Alias for landlordApproved (UI naming)
    var landlordInvited: Bool {
        landlordApproved
    }

    /// Property name from address line
    var propertyName: String {
        propertyAddress ?? "Your Property"
    }

    /// Address line 1 for display
    var addressLine1: String? {
        propertyAddress
    }
}

// MARK: - Upcoming Payment Data

struct UpcomingPaymentData: Codable {
    let dueDate: String
    let amountPaise: Int
    let daysUntilDue: Int
    let isOverdue: Bool
    let cashbackEligible: Bool

    enum CodingKeys: String, CodingKey {
        case dueDate = "due_date"
        case amountPaise = "amount"
        case daysUntilDue = "days_until_due"
        case isOverdue = "is_overdue"
        case cashbackEligible = "cashback_eligible"
    }

    var amount: Double {
        Double(amountPaise) / 100.0
    }
}

// MARK: - Cashback Data

struct CashbackData: Codable {
    let availableBalancePaise: Int
    let pendingBalancePaise: Int
    let totalEarnedPaise: Int
    let totalUsedPaise: Int

    enum CodingKeys: String, CodingKey {
        case availableBalancePaise = "available_balance"
        case pendingBalancePaise = "pending_balance"
        case totalEarnedPaise = "total_earned"
        case totalUsedPaise = "total_used"
    }

    var availableBalance: Double {
        Double(availableBalancePaise) / 100.0
    }

    var pendingBalance: Double {
        Double(pendingBalancePaise) / 100.0
    }

    var totalEarned: Double {
        Double(totalEarnedPaise) / 100.0
    }
}

// MARK: - Payment Data

struct PaymentData: Codable, Identifiable {
    let id: String
    let tenancyId: String
    let rentAmountPaise: Int
    let pgFeePaise: Int
    let cashbackAppliedPaise: Int
    let totalAmountPaise: Int
    let status: String
    let paymentMethod: String?
    let paymentMonth: String
    let createdAt: String
    let completedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case tenancyId = "tenancy_id"
        case rentAmountPaise = "rent_amount_paise"
        case pgFeePaise = "pg_fee_paise"
        case cashbackAppliedPaise = "cashback_applied_paise"
        case totalAmountPaise = "total_amount_paise"
        case status
        case paymentMethod = "payment_method"
        case paymentMonth = "payment_month"
        case createdAt = "created_at"
        case completedAt = "completed_at"
    }

    var rentAmount: Double {
        Double(rentAmountPaise) / 100.0
    }

    var totalAmount: Double {
        Double(totalAmountPaise) / 100.0
    }

    var paymentStatus: PaymentStatus {
        PaymentStatus(rawValue: status) ?? .initiated
    }
}

// MARK: - Notification Data

struct NotificationData: Codable, Identifiable {
    let id: String
    let title: String
    let message: String
    let type: String
    let isRead: Bool
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case message
        case type
        case isRead = "is_read"
        case createdAt = "created_at"
    }
}

// MARK: - Waitlist Status Data

struct WaitlistStatusData: Codable {
    let status: String
    let position: Int?
    let estimatedWaitDays: Int?
    let reason: String?

    enum CodingKeys: String, CodingKey {
        case status
        case position
        case estimatedWaitDays = "estimated_wait_days"
        case reason
    }

    var waitlistState: WaitlistState {
        switch status {
        case "pending":
            if let days = estimatedWaitDays, days > 1 {
                return .pendingLong
            }
            return .pending
        case "accepted", "qualified":
            return .accepted
        case "rejected", "not_eligible":
            return .rejected(reason: reason ?? "Not eligible for service")
        default:
            return .pending
        }
    }
}

// MARK: - User Service Error

enum UserServiceError: LocalizedError {
    case notAuthenticated
    case userNotFound
    case tenancyNotFound
    case networkError(Error)
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Please sign in to continue"
        case .userNotFound:
            return "User profile not found"
        case .tenancyNotFound:
            return "No tenancy found"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let message):
            return message
        }
    }
}
