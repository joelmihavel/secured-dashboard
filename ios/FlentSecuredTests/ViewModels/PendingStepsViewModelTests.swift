/// PendingStepsViewModelTests.swift
/// Flent Secured v2 - Pending Steps ViewModel Tests
///
/// Tests for verification step tracking and progress.
/// Critical for user setup flow completion.

import XCTest
@testable import Flent

@MainActor
final class PendingStepsViewModelTests: XCTestCase {

    // MARK: - Properties

    private var sut: PendingStepsViewModel!
    private var mockVerificationService: MockVerificationService!
    private var mockUserService: MockUserService!

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()
        mockVerificationService = MockVerificationService()
        mockVerificationService.simulatedDelay = 0
        mockUserService = MockUserService()
        mockUserService.simulatedDelay = 0

        sut = PendingStepsViewModel(
            verificationService: mockVerificationService,
            userService: mockUserService
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockVerificationService = nil
        mockUserService = nil
        try await super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitialState() {
        XCTAssertEqual(sut.state, .loading)
        XCTAssertEqual(sut.steps.count, 3)
        XCTAssertFalse(sut.allStepsCompleted)
    }

    func testStepsInitialization() {
        // Bank step
        XCTAssertEqual(sut.steps[0].id, "bank")
        XCTAssertEqual(sut.steps[0].number, 1)
        XCTAssertEqual(sut.steps[0].title, "Add landlord's bank account")
        XCTAssertFalse(sut.steps[0].isCompleted)
        XCTAssertEqual(sut.steps[0].route, .addBank)

        // Utility step
        XCTAssertEqual(sut.steps[1].id, "utility")
        XCTAssertEqual(sut.steps[1].number, 2)
        XCTAssertEqual(sut.steps[1].title, "Verify utility bill")
        XCTAssertFalse(sut.steps[1].isCompleted)
        XCTAssertEqual(sut.steps[1].route, .addUtility)

        // Landlord step
        XCTAssertEqual(sut.steps[2].id, "landlord")
        XCTAssertEqual(sut.steps[2].number, 3)
        XCTAssertEqual(sut.steps[2].title, "Get landlord approval")
        XCTAssertFalse(sut.steps[2].isCompleted)
        XCTAssertEqual(sut.steps[2].route, .inviteLandlord)
    }

    // MARK: - Load Status Tests

    func testLoadStatus_Success() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertEqual(sut.state, .loaded)
        XCTAssertTrue(mockUserService.getCurrentTenancyCalled)
        XCTAssertTrue(mockVerificationService.getVerificationStatusCalled)
        XCTAssertTrue(sut.steps[0].isCompleted)  // Bank
        XCTAssertTrue(sut.steps[1].isCompleted)  // Utility
        XCTAssertFalse(sut.steps[2].isCompleted)  // Landlord
    }

    func testLoadStatus_NoTenancy() async {
        // Given
        mockUserService.shouldReturnNilTenancy = true

        // When
        await sut.loadStatus()

        // Then
        if case .error(let message) = sut.state {
            XCTAssertTrue(message.contains("No tenancy found"))
        } else {
            XCTFail("Expected error state")
        }
    }

    func testLoadStatus_Failure() async {
        // Given
        mockUserService.shouldSucceed = false
        mockUserService.errorToThrow = .serverError("Server error")

        // When
        await sut.loadStatus()

        // Then
        if case .error(let message) = sut.state {
            XCTAssertEqual(message, "Server error")
        } else {
            XCTFail("Expected error state")
        }
    }

    func testLoadStatus_SetsLoadingState() async {
        // Given
        mockVerificationService.simulatedDelay = 0.5
        mockUserService.mockTenancy = MockUserService.createMockTenancy()

        // When
        let task = Task {
            await sut.loadStatus()
        }

        try? await Task.sleep(nanoseconds: 100_000_000)

        // Then
        XCTAssertTrue(sut.isLoading)

        await task.value
    }

    // MARK: - Progress Tests

    func testCompletedStepsCount_NoSteps() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: false,
            utilityVerified: false,
            landlordApproved: false
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: false,
            utilityVerified: false,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertEqual(sut.completedStepsCount, 0)
    }

    func testCompletedStepsCount_OneStep() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: false,
            landlordApproved: false
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: false,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertEqual(sut.completedStepsCount, 1)
    }

    func testCompletedStepsCount_TwoSteps() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertEqual(sut.completedStepsCount, 2)
    }

    func testCompletedStepsCount_AllSteps() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: true
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: true,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertEqual(sut.completedStepsCount, 3)
    }

    func testTotalSteps() {
        XCTAssertEqual(sut.totalSteps, 3)
    }

    func testProgress_NoSteps() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: false,
            utilityVerified: false,
            landlordApproved: false
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: false,
            utilityVerified: false,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertEqual(sut.progress, 0.0)
    }

    func testProgress_OneThird() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: false,
            landlordApproved: false
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: false,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertEqual(sut.progress, 1.0/3.0, accuracy: 0.001)
    }

    func testProgress_TwoThirds() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertEqual(sut.progress, 2.0/3.0, accuracy: 0.001)
    }

    func testProgress_Complete() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: true
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: true,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertEqual(sut.progress, 1.0)
    }

    // MARK: - All Steps Completed Tests

    func testAllStepsCompleted_True() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: true
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: true,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertTrue(sut.allStepsCompleted)
    }

    func testAllStepsCompleted_False() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: true,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertFalse(sut.allStepsCompleted)
    }

    // MARK: - Can Skip To Home Tests

    func testCanSkipToHome_NoStepsCompleted() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: false,
            utilityVerified: false,
            landlordApproved: false
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: false,
            utilityVerified: false,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertFalse(sut.canSkipToHome)
    }

    func testCanSkipToHome_OneStepCompleted() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy(
            bankVerified: true,
            utilityVerified: false,
            landlordApproved: false
        )
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: false,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertTrue(sut.canSkipToHome)
    }

    // MARK: - Refresh Tests

    func testRefresh() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy()
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: true,
            utilityVerified: false,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.refresh()

        // Then
        XCTAssertEqual(sut.state, .loaded)
        XCTAssertTrue(mockUserService.getCurrentTenancyCalled)
    }

    // MARK: - Computed Properties Tests

    func testErrorMessage_WhenError() async {
        // Given
        mockUserService.shouldSucceed = false
        mockUserService.errorToThrow = .serverError("Test error")

        // When
        await sut.loadStatus()

        // Then
        XCTAssertEqual(sut.errorMessage, "Test error")
    }

    func testErrorMessage_WhenNotError() async {
        // Given
        mockUserService.mockTenancy = MockUserService.createMockTenancy()
        mockVerificationService.mockVerificationStatus = VerificationStatus(
            tenancyId: "test",
            bankVerified: false,
            utilityVerified: false,
            landlordApproved: false,
            bankVerificationDate: nil,
            utilityVerificationDate: nil,
            landlordApprovalDate: nil
        )

        // When
        await sut.loadStatus()

        // Then
        XCTAssertNil(sut.errorMessage)
    }
}
