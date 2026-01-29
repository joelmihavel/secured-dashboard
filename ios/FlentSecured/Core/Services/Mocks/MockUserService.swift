/// MockUserService.swift
/// Flent Secured v2 - Mock User Service
///
/// Mock implementation of UserServiceProtocol for testing
/// Supports configurable responses and error simulation

import Foundation

// MARK: - Mock User Service

final class MockUserService: UserServiceProtocol {

    // MARK: - Configuration

    var simulatedDelay: TimeInterval = 0.1
    var shouldSucceed: Bool = true
    var errorToThrow: UserServiceError?

    // MARK: - Mock Data

    var mockUser: UserProfileData?
    var mockDashboard: DashboardData?
    var mockTenancy: TenancyData?
    var mockWaitlistStatus: WaitlistStatusData?

    /// When true, getCurrentTenancy returns nil instead of falling back to mock data
    var shouldReturnNilTenancy: Bool = false

    // MARK: - Call Tracking

    private(set) var getCurrentUserCalled = false
    private(set) var updateProfileCalled = false
    private(set) var lastFirstName: String?
    private(set) var lastLastName: String?
    private(set) var getDashboardDataCalled = false
    private(set) var getCurrentTenancyCalled = false
    private(set) var getWaitlistStatusCalled = false

    // MARK: - UserServiceProtocol

    func getCurrentUser() async throws -> UserProfileData {
        getCurrentUserCalled = true

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? UserServiceError.userNotFound
        }

        return mockUser ?? Self.createMockUser()
    }

    func updateProfile(firstName: String?, lastName: String?) async throws -> UserProfileData {
        updateProfileCalled = true
        lastFirstName = firstName
        lastLastName = lastName

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? UserServiceError.serverError("Update failed")
        }

        var user = mockUser ?? Self.createMockUser()
        // Create updated user (UserProfileData is immutable, so we return mock)
        return UserProfileData(
            id: user.id,
            phone: user.phone,
            firstName: firstName ?? user.firstName,
            lastName: lastName ?? user.lastName,
            email: user.email,
            role: user.role,
            isRoleLocked: user.isRoleLocked,
            userStatus: user.userStatus,
            kycStatus: user.kycStatus,
            createdAt: user.createdAt
        )
    }

    func getDashboardData() async throws -> DashboardData {
        getDashboardDataCalled = true

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? UserServiceError.serverError("Failed to load dashboard")
        }

        return mockDashboard ?? Self.createMockDashboard()
    }

    func getCurrentTenancy() async throws -> TenancyData? {
        getCurrentTenancyCalled = true

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? UserServiceError.tenancyNotFound
        }

        // Return nil if explicitly requested (for testing "no tenancy" scenarios)
        if shouldReturnNilTenancy {
            return nil
        }

        return mockTenancy ?? Self.createMockTenancy()
    }

    func getWaitlistStatus() async throws -> WaitlistStatusData {
        getWaitlistStatusCalled = true

        try await simulateDelay()

        if !shouldSucceed {
            throw errorToThrow ?? UserServiceError.serverError("Failed to get status")
        }

        return mockWaitlistStatus ?? WaitlistStatusData(
            status: "pending",
            position: 42,
            estimatedWaitDays: 1,
            reason: nil
        )
    }

    // MARK: - Test Helpers

    func reset() {
        getCurrentUserCalled = false
        updateProfileCalled = false
        lastFirstName = nil
        lastLastName = nil
        getDashboardDataCalled = false
        getCurrentTenancyCalled = false
        getWaitlistStatusCalled = false
        shouldSucceed = true
        errorToThrow = nil
        mockUser = nil
        mockDashboard = nil
        mockTenancy = nil
        mockWaitlistStatus = nil
        shouldReturnNilTenancy = false
    }

    // MARK: - Mock Data Factories

    static func createMockUser(
        status: UserStatus = .complete,
        firstName: String = "Amit",
        lastName: String = "Kumar"
    ) -> UserProfileData {
        UserProfileData(
            id: UUID().uuidString,
            phone: "+919876543210",
            firstName: firstName,
            lastName: lastName,
            email: "amit@example.com",
            role: "tenant",
            isRoleLocked: true,
            userStatus: status.rawValue,
            kycStatus: "verified",
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
    }

    static func createMockTenancy(
        bankVerified: Bool = true,
        utilityVerified: Bool = true,
        landlordApproved: Bool = true,
        monthlyRent: Int = 4000000 // 40,000 in paise
    ) -> TenancyData {
        TenancyData(
            id: UUID().uuidString,
            userId: UUID().uuidString,
            status: "active",
            propertyAddress: "Prestige Lakeside Habitat, Tower A, Flat 1204",
            propertyCity: "Bangalore",
            propertyState: "Karnataka",
            propertyPincode: "560103",
            monthlyRentPaise: monthlyRent,
            securityDepositPaise: monthlyRent * 2,
            rentDueDay: 5,
            leaseStartDate: "2025-01-01",
            leaseEndDate: "2026-12-31",
            landlordName: "Rajesh Gupta",
            landlordPhone: "+919876543211",
            landlordEmail: "rajesh@example.com",
            bankVerified: bankVerified,
            utilityVerified: utilityVerified,
            landlordApproved: landlordApproved,
            landlordDeclined: false,
            landlordInvitationSentAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-86400 * 7)),
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
    }

    static func createMockDashboard(
        userStatus: UserStatus = .complete,
        hasTenancy: Bool = true,
        hasUpcomingPayment: Bool = true,
        daysUntilDue: Int = 5
    ) -> DashboardData {
        let user = createMockUser(status: userStatus)
        let tenancy = hasTenancy ? createMockTenancy() : nil

        let upcomingPayment: UpcomingPaymentData? = hasUpcomingPayment ? UpcomingPaymentData(
            dueDate: ISO8601DateFormatter().string(from: Date().addingTimeInterval(Double(daysUntilDue) * 86400)),
            amountPaise: 4000000,
            daysUntilDue: daysUntilDue,
            isOverdue: daysUntilDue < 0,
            cashbackEligible: daysUntilDue <= 7 && daysUntilDue >= 0
        ) : nil

        let cashback = CashbackData(
            availableBalancePaise: 50000, // 500 rupees
            pendingBalancePaise: 0,
            totalEarnedPaise: 120000, // 1200 rupees
            totalUsedPaise: 70000 // 700 rupees
        )

        return DashboardData(
            user: user,
            tenancy: tenancy,
            upcomingPayment: upcomingPayment,
            cashback: cashback,
            recentPayments: [],
            notifications: [],
            unreadNotificationCount: 2
        )
    }

    // MARK: - Private Helpers

    private func simulateDelay() async throws {
        if simulatedDelay > 0 {
            try await Task.sleep(nanoseconds: UInt64(simulatedDelay * 1_000_000_000))
        }
    }
}
