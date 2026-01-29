/// FlentSecuredTests.swift
/// Flent Secured v2 - Unit Tests Entry Point
///
/// Main test file for the Flent Secured iOS app.
/// Uses XCTest for reliability in fintech testing.

import XCTest
@testable import Flent

// MARK: - Core Model Tests

final class FlentSecuredTests: XCTestCase {

    // MARK: - UserStatus Tests

    func testUserStatusDisplayNames() {
        XCTAssertEqual(UserStatus.signedUp.displayName, "Getting Started")
        XCTAssertEqual(UserStatus.waitlisted.displayName, "In Waitlist")
        XCTAssertEqual(UserStatus.qualified.displayName, "Verified")
        XCTAssertEqual(UserStatus.complete.displayName, "Active")
        XCTAssertEqual(UserStatus.notEligible.displayName, "Not Eligible")
    }

    func testUserStatusCanAccessHome() {
        // Users who cannot access home
        XCTAssertFalse(UserStatus.signedUp.canAccessHome)
        XCTAssertFalse(UserStatus.waitlisted.canAccessHome)
        XCTAssertFalse(UserStatus.notEligible.canAccessHome)
        XCTAssertFalse(UserStatus.unknown.canAccessHome)

        // Users who can access home
        XCTAssertTrue(UserStatus.qualified.canAccessHome)
        XCTAssertTrue(UserStatus.complete.canAccessHome)
    }

    func testUserStatusCanPay() {
        // Users who cannot pay
        XCTAssertFalse(UserStatus.signedUp.canPay)
        XCTAssertFalse(UserStatus.waitlisted.canPay)
        XCTAssertFalse(UserStatus.notEligible.canPay)

        // Users who can pay
        XCTAssertTrue(UserStatus.qualified.canPay)
        XCTAssertTrue(UserStatus.complete.canPay)
    }

    func testOnlyCOMPLETEUsersCanUseCreditCard() {
        // Critical fintech test: Credit card access is gated to COMPLETE users
        XCTAssertFalse(UserStatus.signedUp.canUseCreditCard)
        XCTAssertFalse(UserStatus.waitlisted.canUseCreditCard)
        XCTAssertFalse(UserStatus.qualified.canUseCreditCard)
        XCTAssertFalse(UserStatus.notEligible.canUseCreditCard)

        // Only COMPLETE users can use credit card
        XCTAssertTrue(UserStatus.complete.canUseCreditCard)
    }

    func testUserStatusNeedsVerification() {
        XCTAssertTrue(UserStatus.qualified.needsVerification)
        XCTAssertFalse(UserStatus.complete.needsVerification)
        XCTAssertFalse(UserStatus.signedUp.needsVerification)
    }

    func testUserStatusIsOnboarding() {
        XCTAssertTrue(UserStatus.signedUp.isOnboarding)
        XCTAssertTrue(UserStatus.waitlisted.isOnboarding)
        XCTAssertFalse(UserStatus.qualified.isOnboarding)
        XCTAssertFalse(UserStatus.complete.isOnboarding)
    }

    // MARK: - PaymentStatus Tests

    func testPaymentStatusDisplayNames() {
        XCTAssertEqual(PaymentStatus.initiated.displayName, "Initiated")
        XCTAssertEqual(PaymentStatus.processing.displayName, "Processing")
        XCTAssertEqual(PaymentStatus.success.displayName, "Successful")
        XCTAssertEqual(PaymentStatus.failed.displayName, "Failed")
        XCTAssertEqual(PaymentStatus.refunded.displayName, "Refunded")
        XCTAssertEqual(PaymentStatus.settled.displayName, "Settled")
    }

    func testPaymentStatusIsTerminal() {
        // Non-terminal states
        XCTAssertFalse(PaymentStatus.initiated.isTerminal)
        XCTAssertFalse(PaymentStatus.processing.isTerminal)

        // Terminal states
        XCTAssertTrue(PaymentStatus.success.isTerminal)
        XCTAssertTrue(PaymentStatus.failed.isTerminal)
        XCTAssertTrue(PaymentStatus.refunded.isTerminal)
        XCTAssertTrue(PaymentStatus.settled.isTerminal)
    }

    func testPaymentStatusIsSuccess() {
        XCTAssertTrue(PaymentStatus.success.isSuccess)
        XCTAssertTrue(PaymentStatus.settled.isSuccess)
        XCTAssertFalse(PaymentStatus.failed.isSuccess)
        XCTAssertFalse(PaymentStatus.initiated.isSuccess)
    }

    func testPaymentStatusIsFailed() {
        XCTAssertTrue(PaymentStatus.failed.isFailed)
        XCTAssertTrue(PaymentStatus.refunded.isFailed)
        XCTAssertFalse(PaymentStatus.success.isFailed)
    }

    func testPaymentStatusIsPending() {
        XCTAssertTrue(PaymentStatus.initiated.isPending)
        XCTAssertTrue(PaymentStatus.processing.isPending)
        XCTAssertFalse(PaymentStatus.success.isPending)
        XCTAssertFalse(PaymentStatus.failed.isPending)
    }

    // MARK: - PaymentMethod Tests

    func testPaymentMethodRequiresFullVerification() {
        // Methods available to QUALIFIED users
        XCTAssertFalse(PaymentMethod.upiIntent.requiresFullVerification)
        XCTAssertFalse(PaymentMethod.upiCollect.requiresFullVerification)
        XCTAssertFalse(PaymentMethod.netBanking.requiresFullVerification)
        XCTAssertFalse(PaymentMethod.debitCard.requiresFullVerification)

        // Methods requiring COMPLETE status
        XCTAssertTrue(PaymentMethod.creditCard.requiresFullVerification)
        XCTAssertTrue(PaymentMethod.wallet.requiresFullVerification)
    }

    func testPaymentMethodDisplayNames() {
        XCTAssertEqual(PaymentMethod.upiIntent.displayName, "UPI")
        XCTAssertEqual(PaymentMethod.upiCollect.displayName, "UPI ID")
        XCTAssertEqual(PaymentMethod.netBanking.displayName, "Net Banking")
        XCTAssertEqual(PaymentMethod.creditCard.displayName, "Credit Card")
        XCTAssertEqual(PaymentMethod.debitCard.displayName, "Debit Card")
        XCTAssertEqual(PaymentMethod.wallet.displayName, "Wallet")
    }

    // MARK: - UserProfileData Tests

    func testUserProfileDataFullName() {
        let profile1 = UserProfileData(
            id: "test-id",
            phone: "+919876543210",
            firstName: "Amit",
            lastName: "Kumar",
            email: nil,
            role: nil,
            isRoleLocked: nil,
            userStatus: "complete",
            kycStatus: nil,
            createdAt: nil
        )
        XCTAssertEqual(profile1.fullName, "Amit Kumar")

        let profile2 = UserProfileData(
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
        XCTAssertEqual(profile2.fullName, "Amit")

        let profile3 = UserProfileData(
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
        XCTAssertEqual(profile3.fullName, "")
    }

    func testUserProfileDataStatus() {
        let completeProfile = UserProfileData(
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
        XCTAssertEqual(completeProfile.status, .complete)

        let qualifiedProfile = UserProfileData(
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
        XCTAssertEqual(qualifiedProfile.status, .qualified)

        let unknownProfile = UserProfileData(
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
        XCTAssertEqual(unknownProfile.status, .unknown)
    }

    // MARK: - TenancyData Tests

    func testTenancyDataMonthlyRent() {
        let tenancy = MockUserService.createMockTenancy(monthlyRent: 4000000)
        XCTAssertEqual(tenancy.monthlyRent, 40000.0)
    }

    func testTenancyDataFullAddress() {
        let tenancy = MockUserService.createMockTenancy()
        XCTAssertTrue(tenancy.fullAddress.contains("Bangalore"))
        XCTAssertTrue(tenancy.fullAddress.contains("Karnataka"))
    }

    func testTenancyDataIsFullyVerified() {
        let fullyVerified = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: true
        )
        XCTAssertTrue(fullyVerified.isFullyVerified)

        let partiallyVerified = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false
        )
        XCTAssertFalse(partiallyVerified.isFullyVerified)

        let notVerified = MockUserService.createMockTenancy(
            bankVerified: false,
            utilityVerified: false,
            landlordApproved: false
        )
        XCTAssertFalse(notVerified.isFullyVerified)
    }

    func testTenancyDataCompletedVerificationCount() {
        let tenancy1 = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: true
        )
        XCTAssertEqual(tenancy1.completedVerificationCount, 3)

        let tenancy2 = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: false,
            landlordApproved: false
        )
        XCTAssertEqual(tenancy2.completedVerificationCount, 1)

        let tenancy3 = MockUserService.createMockTenancy(
            bankVerified: false,
            utilityVerified: false,
            landlordApproved: false
        )
        XCTAssertEqual(tenancy3.completedVerificationCount, 0)
    }

    // MARK: - CashbackData Tests

    func testCashbackDataConversions() {
        let cashback = CashbackData(
            availableBalancePaise: 50000,
            pendingBalancePaise: 10000,
            totalEarnedPaise: 100000,
            totalUsedPaise: 40000
        )

        XCTAssertEqual(cashback.availableBalance, 500.0)
        XCTAssertEqual(cashback.pendingBalance, 100.0)
        XCTAssertEqual(cashback.totalEarned, 1000.0)
    }

    // MARK: - VerificationStatus Tests

    func testVerificationStatusIsComplete() {
        let complete = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: true,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )
        XCTAssertTrue(complete.isComplete)

        let incomplete = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )
        XCTAssertFalse(incomplete.isComplete)
    }

    func testVerificationStatusProgress() {
        let status = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        XCTAssertEqual(status.completedCount, 2)
        XCTAssertEqual(status.totalCount, 3)
        XCTAssertEqual(status.progress, 2.0/3.0, accuracy: 0.001)
    }

    // MARK: - AppError Tests

    func testAppErrorIsRetryable() {
        XCTAssertTrue(AppError.noInternet.isRetryable)
        XCTAssertTrue(AppError.timeout.isRetryable)
        XCTAssertTrue(AppError.serverUnavailable.isRetryable)

        XCTAssertFalse(AppError.sessionExpired.isRetryable)
        XCTAssertFalse(AppError.notAuthenticated.isRetryable)
        XCTAssertFalse(AppError.paymentCancelled.isRetryable)
        XCTAssertFalse(AppError.paymentInProgress.isRetryable)
    }

    func testAppErrorRequiresSignOut() {
        XCTAssertTrue(AppError.sessionExpired.requiresSignOut)
        XCTAssertFalse(AppError.noInternet.requiresSignOut)
        XCTAssertFalse(AppError.paymentFailed(reason: "test").requiresSignOut)
    }

    func testAppErrorAnalyticsCategory() {
        XCTAssertEqual(AppError.noInternet.analyticsCategory, "network")
        XCTAssertEqual(AppError.sessionExpired.analyticsCategory, "auth")
        XCTAssertEqual(AppError.paymentFailed(reason: "test").analyticsCategory, "payment")
        XCTAssertEqual(AppError.bankVerificationFailed.analyticsCategory, "verification")
    }
}
