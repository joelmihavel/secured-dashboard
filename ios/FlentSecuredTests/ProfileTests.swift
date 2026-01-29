/// ProfileTests.swift
/// Flent Secured v2 - Profile Tests
///
/// Tests for user profile, personal details, tenancy details, and payment history.
/// Validates user data display and navigation.

import XCTest
@testable import Flent

@MainActor
final class ProfileTests: XCTestCase {

    // MARK: - Properties

    private var mockUserService: MockUserService!
    private var mockPaymentService: MockPaymentService!

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockUserService = MockUserService()
        mockUserService.simulatedDelay = 0
        mockPaymentService = MockPaymentService()
        mockPaymentService.simulatedDelay = 0
    }

    override func tearDown() async throws {
        mockUserService = nil
        mockPaymentService = nil
        try await super.tearDown()
    }

    // MARK: - User Profile Data Tests

    func testUserProfileData_FullName() {
        // Given
        let profile = UserProfileData(
            id: "test-id",
            phone: "+919876543210",
            firstName: "Amit",
            lastName: "Kumar",
            email: "amit@example.com",
            role: "tenant",
            isRoleLocked: true,
            userStatus: "complete",
            kycStatus: "verified",
            createdAt: nil
        )

        // Then
        XCTAssertEqual(profile.fullName, "Amit Kumar")
    }

    func testUserProfileData_FullName_OnlyFirstName() {
        // Given
        let profile = UserProfileData(
            id: "test-id",
            phone: "+919876543210",
            firstName: "Amit",
            lastName: nil,
            email: nil,
            role: nil,
            isRoleLocked: nil,
            userStatus: "complete",
            kycStatus: nil,
            createdAt: nil
        )

        // Then
        XCTAssertEqual(profile.fullName, "Amit")
    }

    func testUserProfileData_FullName_NoName() {
        // Given
        let profile = UserProfileData(
            id: "test-id",
            phone: "+919876543210",
            firstName: nil,
            lastName: nil,
            email: nil,
            role: nil,
            isRoleLocked: nil,
            userStatus: nil,
            kycStatus: nil,
            createdAt: nil
        )

        // Then
        XCTAssertEqual(profile.fullName, "")
    }

    func testUserProfileData_Status_Complete() {
        // Given
        let profile = UserProfileData(
            id: "test-id",
            phone: "+919876543210",
            firstName: nil,
            lastName: nil,
            email: nil,
            role: nil,
            isRoleLocked: nil,
            userStatus: "complete",
            kycStatus: nil,
            createdAt: nil
        )

        // Then
        XCTAssertEqual(profile.status, .complete)
        XCTAssertTrue(profile.status.canUseCreditCard)
    }

    func testUserProfileData_Status_Qualified() {
        // Given
        let profile = UserProfileData(
            id: "test-id",
            phone: "+919876543210",
            firstName: nil,
            lastName: nil,
            email: nil,
            role: nil,
            isRoleLocked: nil,
            userStatus: "qualified",
            kycStatus: nil,
            createdAt: nil
        )

        // Then
        XCTAssertEqual(profile.status, .qualified)
        XCTAssertFalse(profile.status.canUseCreditCard)
        XCTAssertTrue(profile.status.needsVerification)
    }

    func testUserProfileData_Status_Unknown() {
        // Given
        let profile = UserProfileData(
            id: "test-id",
            phone: "+919876543210",
            firstName: nil,
            lastName: nil,
            email: nil,
            role: nil,
            isRoleLocked: nil,
            userStatus: nil,
            kycStatus: nil,
            createdAt: nil
        )

        // Then
        XCTAssertEqual(profile.status, .unknown)
    }

    // MARK: - Tenancy Data Tests

    func testTenancyData_MonthlyRent() {
        // Given
        let tenancy = MockUserService.createMockTenancy(monthlyRent: 4000000)

        // Then - 40,000 rupees
        XCTAssertEqual(tenancy.monthlyRent, 40000.0)
    }

    func testTenancyData_FullAddress() {
        // Given
        let tenancy = MockUserService.createMockTenancy()

        // Then
        XCTAssertTrue(tenancy.fullAddress.contains("Bangalore"))
        XCTAssertTrue(tenancy.fullAddress.contains("Karnataka"))
        XCTAssertTrue(tenancy.fullAddress.contains("560103"))
    }

    func testTenancyData_IsFullyVerified() {
        // Given - All verified
        let verifiedTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: true
        )

        // Given - Not fully verified
        let partialTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false
        )

        // Then
        XCTAssertTrue(verifiedTenancy.isFullyVerified)
        XCTAssertFalse(partialTenancy.isFullyVerified)
    }

    func testTenancyData_CompletedVerificationCount() {
        // Given
        let tenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false
        )

        // Then
        XCTAssertEqual(tenancy.completedVerificationCount, 2)
    }

    func testTenancyData_PropertyName() {
        // Given
        let tenancy = MockUserService.createMockTenancy()

        // Then
        XCTAssertTrue(tenancy.propertyName.contains("Prestige"))
    }

    func testTenancyData_RentDueDay() {
        // Given
        let tenancy = MockUserService.createMockTenancy()

        // Then
        XCTAssertEqual(tenancy.rentDueDay, 5)
    }

    // MARK: - Payment History Tests

    func testPaymentData_RentAmount() {
        // Given
        let payment = MockPaymentService.createMockPaymentData()

        // Then - 40,000 rupees
        XCTAssertEqual(payment.rentAmount, 40000.0)
    }

    func testPaymentData_TotalAmount() {
        // Given
        let payment = MockPaymentService.createMockPaymentData()

        // Then - 39,500 rupees (40000 - 500 cashback)
        XCTAssertEqual(payment.totalAmount, 39500.0)
    }

    func testPaymentData_Status_Success() {
        // Given
        let payment = MockPaymentService.createMockPaymentData(status: .success)

        // Then
        XCTAssertEqual(payment.paymentStatus, .success)
        XCTAssertTrue(payment.paymentStatus.isSuccess)
        XCTAssertFalse(payment.paymentStatus.isFailed)
        XCTAssertTrue(payment.paymentStatus.isTerminal)
    }

    func testPaymentData_Status_Failed() {
        // Given
        let payment = MockPaymentService.createMockPaymentData(status: .failed)

        // Then
        XCTAssertEqual(payment.paymentStatus, .failed)
        XCTAssertFalse(payment.paymentStatus.isSuccess)
        XCTAssertTrue(payment.paymentStatus.isFailed)
    }

    func testPaymentData_Status_Processing() {
        // Given
        let payment = MockPaymentService.createMockPaymentData(status: .processing)

        // Then
        XCTAssertEqual(payment.paymentStatus, .processing)
        XCTAssertTrue(payment.paymentStatus.isPending)
        XCTAssertFalse(payment.paymentStatus.isTerminal)
    }

    // MARK: - Cashback Data Tests

    func testCashbackData_AvailableBalance() {
        // Given
        let cashback = CashbackData(
            availableBalancePaise: 50000,
            pendingBalancePaise: 10000,
            totalEarnedPaise: 100000,
            totalUsedPaise: 40000
        )

        // Then
        XCTAssertEqual(cashback.availableBalance, 500.0)
        XCTAssertEqual(cashback.pendingBalance, 100.0)
        XCTAssertEqual(cashback.totalEarned, 1000.0)
    }

    // MARK: - Dashboard Data Tests

    func testDashboardData_UserProfile() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        let dashboard = try? await mockUserService.getDashboardData()

        // Then
        XCTAssertNotNil(dashboard)
        XCTAssertEqual(dashboard?.user.firstName, "Amit")
        XCTAssertEqual(dashboard?.user.lastName, "Kumar")
    }

    func testDashboardData_Tenancy() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        let dashboard = try? await mockUserService.getDashboardData()

        // Then
        XCTAssertNotNil(dashboard?.tenancy)
        XCTAssertEqual(dashboard?.tenancy?.rentDueDay, 5)
    }

    func testDashboardData_UpcomingPayment() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard(
            hasUpcomingPayment: true,
            daysUntilDue: 5
        )

        // When
        let dashboard = try? await mockUserService.getDashboardData()

        // Then
        XCTAssertNotNil(dashboard?.upcomingPayment)
        XCTAssertEqual(dashboard?.upcomingPayment?.daysUntilDue, 5)
    }

    func testDashboardData_Cashback() async {
        // Given
        mockUserService.mockDashboard = MockUserService.createMockDashboard()

        // When
        let dashboard = try? await mockUserService.getDashboardData()

        // Then
        XCTAssertNotNil(dashboard?.cashback)
        XCTAssertEqual(dashboard?.cashback.availableBalancePaise, 50000)
    }

    // MARK: - User Status Feature Gating Tests

    func testUserStatus_CanAccessHome() {
        XCTAssertFalse(UserStatus.signedUp.canAccessHome)
        XCTAssertFalse(UserStatus.waitlisted.canAccessHome)
        XCTAssertTrue(UserStatus.qualified.canAccessHome)
        XCTAssertTrue(UserStatus.complete.canAccessHome)
        XCTAssertFalse(UserStatus.notEligible.canAccessHome)
    }

    func testUserStatus_CanPay() {
        XCTAssertFalse(UserStatus.signedUp.canPay)
        XCTAssertFalse(UserStatus.waitlisted.canPay)
        XCTAssertTrue(UserStatus.qualified.canPay)
        XCTAssertTrue(UserStatus.complete.canPay)
        XCTAssertFalse(UserStatus.notEligible.canPay)
    }

    func testUserStatus_CreditCardAccess() {
        // Critical: Only COMPLETE users can use credit cards
        XCTAssertFalse(UserStatus.qualified.canUseCreditCard)
        XCTAssertTrue(UserStatus.complete.canUseCreditCard)
    }

    func testUserStatus_HasFullPaymentAccess() {
        XCTAssertFalse(UserStatus.qualified.hasFullPaymentAccess)
        XCTAssertTrue(UserStatus.complete.hasFullPaymentAccess)
    }

    // MARK: - Waitlist Status Tests

    func testWaitlistStatusData_Pending() {
        // Given
        let status = WaitlistStatusData(
            status: "pending",
            position: 42,
            estimatedWaitDays: 1,
            reason: nil
        )

        // Then
        XCTAssertEqual(status.waitlistState, .pending)
    }

    func testWaitlistStatusData_PendingLong() {
        // Given
        let status = WaitlistStatusData(
            status: "pending",
            position: 100,
            estimatedWaitDays: 7,
            reason: nil
        )

        // Then
        XCTAssertEqual(status.waitlistState, .pendingLong)
    }

    func testWaitlistStatusData_Accepted() {
        // Given
        let status = WaitlistStatusData(
            status: "accepted",
            position: nil,
            estimatedWaitDays: nil,
            reason: nil
        )

        // Then
        XCTAssertEqual(status.waitlistState, .accepted)
    }

    func testWaitlistStatusData_Rejected() {
        // Given
        let status = WaitlistStatusData(
            status: "rejected",
            position: nil,
            estimatedWaitDays: nil,
            reason: "Not serviceable area"
        )

        // Then
        if case .rejected(let reason) = status.waitlistState {
            XCTAssertEqual(reason, "Not serviceable area")
        } else {
            XCTFail("Expected rejected state")
        }
    }

    // MARK: - Verification Status Tests

    func testVerificationStatus_IsComplete() {
        // Given
        let complete = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: true,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        let incomplete = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: false,
            landlordApproved: true,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // Then
        XCTAssertTrue(complete.isComplete)
        XCTAssertFalse(incomplete.isComplete)
    }

    func testVerificationStatus_Progress() {
        // Given
        let status = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // Then
        XCTAssertEqual(status.completedCount, 2)
        XCTAssertEqual(status.totalCount, 3)
        XCTAssertEqual(status.progress, 2.0/3.0, accuracy: 0.001)
    }

    // MARK: - Payment Method Tests

    func testPaymentMethod_DisplayNames() {
        XCTAssertEqual(PaymentMethod.upiIntent.displayName, "UPI")
        XCTAssertEqual(PaymentMethod.upiCollect.displayName, "UPI ID")
        XCTAssertEqual(PaymentMethod.netBanking.displayName, "Net Banking")
        XCTAssertEqual(PaymentMethod.creditCard.displayName, "Credit Card")
        XCTAssertEqual(PaymentMethod.debitCard.displayName, "Debit Card")
        XCTAssertEqual(PaymentMethod.wallet.displayName, "Wallet")
    }

    func testPaymentMethod_RequiresFullVerification() {
        // UPI, NetBanking, DebitCard - available to QUALIFIED
        XCTAssertFalse(PaymentMethod.upiIntent.requiresFullVerification)
        XCTAssertFalse(PaymentMethod.upiCollect.requiresFullVerification)
        XCTAssertFalse(PaymentMethod.netBanking.requiresFullVerification)
        XCTAssertFalse(PaymentMethod.debitCard.requiresFullVerification)

        // Credit Card, Wallet - require COMPLETE
        XCTAssertTrue(PaymentMethod.creditCard.requiresFullVerification)
        XCTAssertTrue(PaymentMethod.wallet.requiresFullVerification)
    }
}
