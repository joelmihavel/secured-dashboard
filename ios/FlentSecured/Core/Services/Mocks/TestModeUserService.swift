/// TestModeUserService.swift
/// Flent Secured v2 - Test Mode User Service
///
/// Special user service for UI testing that returns different user data
/// based on the authenticated test phone number from TestModeAuthService
///
/// IMPORTANT: This file is only included in DEBUG builds and is automatically
/// stripped from production builds via the #if DEBUG compiler flag.

#if DEBUG
import Foundation

// MARK: - Test Mode User Service

/// User service that coordinates with TestModeAuthService to return
/// appropriate user data based on the test phone number
final class TestModeUserService: UserServiceProtocol {

    // MARK: - Dependencies

    private let authService: TestModeAuthService

    // MARK: - Configuration

    var simulatedDelay: TimeInterval = 0.2

    // MARK: - Initialization

    init(authService: TestModeAuthService) {
        self.authService = authService
    }

    // MARK: - UserServiceProtocol

    func getCurrentUser() async throws -> UserProfileData {
        guard let testPhone = authService.currentTestPhone,
              let userId = authService.currentUserId,
              let phone = authService.currentPhoneNumber else {
            throw UserServiceError.userNotFound
        }

        try await simulateDelay()

        let userData = createUserData(for: testPhone, userId: userId, phone: phone)
        print("[TestModeUser] getCurrentUser: \(testPhone.description), status: \(userData.userStatus)")
        return userData
    }

    func updateProfile(firstName: String?, lastName: String?) async throws -> UserProfileData {
        guard let testPhone = authService.currentTestPhone,
              let userId = authService.currentUserId,
              let phone = authService.currentPhoneNumber else {
            throw UserServiceError.userNotFound
        }

        try await simulateDelay()

        var userData = createUserData(for: testPhone, userId: userId, phone: phone)

        // Return updated user (simulate the update)
        return UserProfileData(
            id: userData.id,
            phone: userData.phone,
            firstName: firstName ?? userData.firstName,
            lastName: lastName ?? userData.lastName,
            email: userData.email,
            role: userData.role,
            isRoleLocked: userData.isRoleLocked,
            userStatus: userData.userStatus,
            kycStatus: userData.kycStatus,
            createdAt: userData.createdAt
        )
    }

    func getDashboardData() async throws -> DashboardData {
        guard let testPhone = authService.currentTestPhone,
              let userId = authService.currentUserId,
              let phone = authService.currentPhoneNumber else {
            throw UserServiceError.userNotFound
        }

        try await simulateDelay()

        let dashboard = createDashboardData(for: testPhone, userId: userId, phone: phone)
        print("[TestModeUser] getDashboardData: \(testPhone.description)")
        return dashboard
    }

    func getCurrentTenancy() async throws -> TenancyData? {
        guard let testPhone = authService.currentTestPhone else {
            throw UserServiceError.tenancyNotFound
        }

        try await simulateDelay()

        // Only COMPLETE and QUALIFIED users have tenancy
        switch testPhone {
        case .complete:
            return createTenancyData(allVerified: true)
        case .qualified:
            return createTenancyData(allVerified: false)
        default:
            return nil
        }
    }

    func getWaitlistStatus() async throws -> WaitlistStatusData {
        guard let testPhone = authService.currentTestPhone else {
            throw UserServiceError.userNotFound
        }

        try await simulateDelay()

        switch testPhone {
        case .waitlisted:
            return WaitlistStatusData(
                status: "pending",
                position: 42,
                estimatedWaitDays: 7,
                reason: nil
            )
        case .notEligible:
            return WaitlistStatusData(
                status: "rejected",
                position: nil,
                estimatedWaitDays: nil,
                reason: "Service not available in your area"
            )
        default:
            return WaitlistStatusData(
                status: "approved",
                position: nil,
                estimatedWaitDays: nil,
                reason: nil
            )
        }
    }

    // MARK: - Data Factories

    private func createUserData(
        for testPhone: TestPhoneNumber,
        userId: String,
        phone: String
    ) -> UserProfileData {
        let (firstName, lastName) = nameForTestPhone(testPhone)

        return UserProfileData(
            id: userId,
            phone: phone,
            firstName: firstName,
            lastName: lastName,
            email: emailForTestPhone(testPhone),
            role: "tenant",
            isRoleLocked: !testPhone.isNewUser,
            userStatus: testPhone.userStatus.rawValue,
            kycStatus: kycStatusForTestPhone(testPhone),
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
    }

    private func createDashboardData(
        for testPhone: TestPhoneNumber,
        userId: String,
        phone: String
    ) -> DashboardData {
        let user = createUserData(for: testPhone, userId: userId, phone: phone)

        let tenancy: TenancyData?
        let upcomingPayment: UpcomingPaymentData?
        let cashback: CashbackData

        switch testPhone {
        case .complete:
            tenancy = createTenancyData(allVerified: true)
            upcomingPayment = createUpcomingPayment(daysUntilDue: 5)
            cashback = createCashback(available: 50000, pending: 0)

        case .qualified:
            tenancy = createTenancyData(allVerified: false)
            upcomingPayment = createUpcomingPayment(daysUntilDue: 10)
            cashback = createCashback(available: 0, pending: 0)

        default:
            tenancy = nil
            upcomingPayment = nil
            cashback = createCashback(available: 0, pending: 0)
        }

        return DashboardData(
            user: user,
            tenancy: tenancy,
            upcomingPayment: upcomingPayment,
            cashback: cashback,
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: testPhone == .complete ? 2 : 0
        )
    }

    private func createTenancyData(allVerified: Bool) -> TenancyData {
        TenancyData(
            id: UUID().uuidString,
            userId: authService.currentUserId ?? UUID().uuidString,
            status: "active",
            propertyAddress: "Prestige Lakeside Habitat, Tower A, Flat 1204",
            propertyCity: "Bangalore",
            propertyState: "Karnataka",
            propertyPincode: "560103",
            monthlyRentPaise: 4000000, // 40,000 INR
            securityDepositPaise: 8000000,
            rentDueDay: 5,
            leaseStartDate: "2025-01-01",
            leaseEndDate: "2026-12-31",
            landlordName: "Rajesh Gupta",
            landlordPhone: "+919876543211",
            landlordEmail: "rajesh@example.com",
            bankVerified: allVerified,
            utilityVerified: allVerified,
            landlordApproved: allVerified,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
    }

    private func createUpcomingPayment(daysUntilDue: Int) -> UpcomingPaymentData {
        UpcomingPaymentData(
            dueDate: ISO8601DateFormatter().string(from: Date().addingTimeInterval(Double(daysUntilDue) * 86400)),
            amountPaise: 4000000,
            daysUntilDue: daysUntilDue,
            isOverdue: daysUntilDue < 0,
            cashbackEligible: daysUntilDue <= 7 && daysUntilDue >= 0
        )
    }

    private func createCashback(available: Int, pending: Int) -> CashbackData {
        CashbackData(
            availableBalancePaise: available,
            pendingBalancePaise: pending,
            totalEarnedPaise: available + 70000,
            totalUsedPaise: 70000
        )
    }

    // MARK: - Helpers

    private func nameForTestPhone(_ testPhone: TestPhoneNumber) -> (String, String) {
        switch testPhone {
        case .success:
            return ("Test", "User")
        case .qualified:
            return ("Amit", "Sharma")
        case .complete:
            return ("Priya", "Kumar")
        case .waitlisted:
            return ("Rahul", "Verma")
        case .notEligible:
            return ("Vikram", "Singh")
        }
    }

    private func emailForTestPhone(_ testPhone: TestPhoneNumber) -> String? {
        switch testPhone {
        case .complete, .qualified:
            let (first, last) = nameForTestPhone(testPhone)
            return "\(first.lowercased()).\(last.lowercased())@example.com"
        default:
            return nil
        }
    }

    private func kycStatusForTestPhone(_ testPhone: TestPhoneNumber) -> String {
        switch testPhone {
        case .complete:
            return "verified"
        case .qualified:
            return "pending"
        default:
            return "not_started"
        }
    }

    private func simulateDelay() async throws {
        if simulatedDelay > 0 {
            try await Task.sleep(nanoseconds: UInt64(simulatedDelay * 1_000_000_000))
        }
    }
}
#endif
