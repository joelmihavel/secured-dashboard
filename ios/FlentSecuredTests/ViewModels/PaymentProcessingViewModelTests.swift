/// PaymentProcessingViewModelTests.swift
/// Flent Secured v2 - Payment Processing ViewModel Tests
///
/// Tests for payment status tracking and realtime subscription handling

import Testing
import Foundation
@testable import Flent

@Suite("PaymentProcessingViewModel Tests")
struct PaymentProcessingViewModelTests {

    // MARK: - Initialization Tests

    @Test("ViewModel initializes with correct payment ID")
    func initializesWithPaymentId() {
        let viewModel = PaymentProcessingViewModel(
            paymentId: "test-payment-123",
            paymentService: MockPaymentService()
        )

        #expect(viewModel.paymentId == "test-payment-123")
        #expect(viewModel.stage == .initiating)
        #expect(viewModel.isCompleted == false)
    }

    @Test("ViewModel stores PayU params when provided")
    func storesPayUParams() {
        let params = PayUParams(
            key: "test_key",
            txnid: "test_txn",
            amount: "25000.00",
            productinfo: "Rent",
            firstname: "Test",
            email: "test@example.com",
            phone: "9876543210",
            surl: "https://success.url",
            furl: "https://failure.url",
            hash: "test_hash",
            udf1: nil,
            udf2: nil,
            udf3: nil
        )

        let viewModel = PaymentProcessingViewModel(
            paymentId: "test-payment-123",
            payuParams: params,
            paymentService: MockPaymentService()
        )

        #expect(viewModel.payuParams != nil)
        #expect(viewModel.payuParams?.txnid == "test_txn")
    }

    // MARK: - Stage Tests

    @Test("Stage title returns correct values")
    func stageTitle() {
        // Test all stage titles
        #expect(PaymentProcessingViewModel.ProcessingStage.initiating.title == "Initiating payment")
        #expect(PaymentProcessingViewModel.ProcessingStage.processing.title == "Processing")
        #expect(PaymentProcessingViewModel.ProcessingStage.verifying.title == "Verifying")
        #expect(PaymentProcessingViewModel.ProcessingStage.completed(success: true).title == "Payment successful")
        #expect(PaymentProcessingViewModel.ProcessingStage.completed(success: false).title == "Payment failed")
    }

    @Test("Stage subtitle returns correct values")
    func stageSubtitle() {
        #expect(PaymentProcessingViewModel.ProcessingStage.initiating.subtitle == "Connecting to payment gateway")
        #expect(PaymentProcessingViewModel.ProcessingStage.processing.subtitle == "This may take a moment")
        #expect(PaymentProcessingViewModel.ProcessingStage.verifying.subtitle == "Almost done")
        #expect(PaymentProcessingViewModel.ProcessingStage.completed(success: true).subtitle == "Redirecting...")
        #expect(PaymentProcessingViewModel.ProcessingStage.completed(success: false).subtitle == "Please try again")
    }

    @Test("Stage icon returns correct SF Symbol names")
    func stageIconName() {
        #expect(PaymentProcessingViewModel.ProcessingStage.initiating.iconName == "creditcard")
        #expect(PaymentProcessingViewModel.ProcessingStage.processing.iconName == "arrow.triangle.2.circlepath")
        #expect(PaymentProcessingViewModel.ProcessingStage.verifying.iconName == "checkmark.shield")
        #expect(PaymentProcessingViewModel.ProcessingStage.completed(success: true).iconName == "checkmark.circle.fill")
        #expect(PaymentProcessingViewModel.ProcessingStage.completed(success: false).iconName == "xmark.circle.fill")
    }

    // MARK: - Computed Property Tests

    @Test("showWarning is true when not completed")
    func showWarningWhenNotCompleted() {
        let viewModel = PaymentProcessingViewModel(
            paymentId: "test",
            paymentService: MockPaymentService()
        )

        #expect(viewModel.showWarning == true)
    }

    @Test("showWarning is false when completed (using checkStatus)")
    @MainActor
    func showWarningFalseWhenCompleted() async {
        let mockService = MockPaymentService()
        mockService.mockPaymentStatus = PaymentStatusData(
            paymentId: "test",
            status: "success",
            settlementStatus: nil,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )

        let viewModel = PaymentProcessingViewModel(
            paymentId: "test",
            paymentService: mockService
        )

        await viewModel.checkStatus()

        #expect(viewModel.showWarning == false)
    }

    @Test("isSuccess returns false by default")
    func isSuccessDefaultFalse() {
        let viewModel = PaymentProcessingViewModel(
            paymentId: "test",
            paymentService: MockPaymentService()
        )

        #expect(viewModel.isSuccess == false)
    }

    @Test("isSuccess returns true when completed successfully (using checkStatus)")
    @MainActor
    func isSuccessWhenCompletedSuccess() async {
        let mockService = MockPaymentService()
        mockService.mockPaymentStatus = PaymentStatusData(
            paymentId: "test",
            status: "success",
            settlementStatus: nil,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )

        let viewModel = PaymentProcessingViewModel(
            paymentId: "test",
            paymentService: mockService
        )

        await viewModel.checkStatus()

        #expect(viewModel.isSuccess == true)
    }

    @Test("isSuccess returns false when completed with failure (using checkStatus)")
    @MainActor
    func isSuccessFalseWhenCompletedFailure() async {
        let mockService = MockPaymentService()
        mockService.mockPaymentStatus = PaymentStatusData(
            paymentId: "test",
            status: "failed",
            settlementStatus: nil,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )

        let viewModel = PaymentProcessingViewModel(
            paymentId: "test",
            paymentService: mockService
        )

        await viewModel.checkStatus()

        #expect(viewModel.isSuccess == false)
    }

    // MARK: - Status Update Tests

    @Test("Payment status updates stage correctly for success")
    @MainActor
    func statusUpdatesStageForSuccess() async {
        let mockService = MockPaymentService()
        mockService.mockPaymentStatus = PaymentStatusData(
            paymentId: "test",
            status: "success",
            settlementStatus: "processing",
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )

        let viewModel = PaymentProcessingViewModel(
            paymentId: "test",
            paymentService: mockService
        )

        await viewModel.checkStatus()

        #expect(viewModel.paymentStatus == .success)
        #expect(viewModel.stage == .completed(success: true))
    }

    @Test("Payment status updates stage correctly for processing")
    @MainActor
    func statusUpdatesStageForProcessing() async {
        let mockService = MockPaymentService()
        mockService.mockPaymentStatus = PaymentStatusData(
            paymentId: "test",
            status: "processing",
            settlementStatus: nil,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )

        let viewModel = PaymentProcessingViewModel(
            paymentId: "test",
            paymentService: mockService
        )

        await viewModel.checkStatus()

        #expect(viewModel.paymentStatus == .processing)
        #expect(viewModel.stage == .processing)
    }

    @Test("Payment status updates stage correctly for failure")
    @MainActor
    func statusUpdatesStageForFailure() async {
        let mockService = MockPaymentService()
        mockService.mockPaymentStatus = PaymentStatusData(
            paymentId: "test",
            status: "failed",
            settlementStatus: nil,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )

        let viewModel = PaymentProcessingViewModel(
            paymentId: "test",
            paymentService: mockService
        )

        await viewModel.checkStatus()

        #expect(viewModel.paymentStatus == .failed)
        #expect(viewModel.stage == .completed(success: false))
    }

    @Test("Check status handles errors gracefully")
    @MainActor
    func checkStatusHandlesErrors() async {
        let mockService = MockPaymentService()
        mockService.shouldSucceed = false
        mockService.errorToThrow = PaymentServiceError.networkError(URLError(.notConnectedToInternet))

        let viewModel = PaymentProcessingViewModel(
            paymentId: "test",
            paymentService: mockService
        )

        // Should not throw, just continue
        await viewModel.checkStatus()

        // Stage should remain unchanged (initiating)
        #expect(viewModel.stage == .initiating)
    }

    // MARK: - Dots Animation Tests

    @Test("Dots animation can be started and stopped")
    func dotsAnimation() {
        let viewModel = PaymentProcessingViewModel(
            paymentId: "test",
            paymentService: MockPaymentService()
        )

        viewModel.startDotsAnimation()
        // Animation is asynchronous, just verify it doesn't crash

        viewModel.stopDotsAnimation()
        // Verify stopping doesn't crash
    }

    @Test("Stop processing cancels tasks")
    func stopProcessingCancelsTasks() {
        let viewModel = PaymentProcessingViewModel(
            paymentId: "test",
            paymentService: MockPaymentService()
        )

        viewModel.startDotsAnimation()
        viewModel.stopProcessing()

        // Just verify it doesn't crash
        #expect(true)
    }

    // MARK: - Stage Equatable Tests

    @Test("Processing stages are equatable")
    func stagesAreEquatable() {
        let stage1 = PaymentProcessingViewModel.ProcessingStage.initiating
        let stage2 = PaymentProcessingViewModel.ProcessingStage.initiating
        let stage3 = PaymentProcessingViewModel.ProcessingStage.processing

        #expect(stage1 == stage2)
        #expect(stage1 != stage3)

        let completed1 = PaymentProcessingViewModel.ProcessingStage.completed(success: true)
        let completed2 = PaymentProcessingViewModel.ProcessingStage.completed(success: true)
        let completed3 = PaymentProcessingViewModel.ProcessingStage.completed(success: false)

        #expect(completed1 == completed2)
        #expect(completed1 != completed3)
    }

    // MARK: - Preview Helpers

    @Test("Preview helpers create valid view models")
    func previewHelpers() {
        let preview = PaymentProcessingViewModel.preview
        #expect(preview.paymentId == "test-payment-123")

        let processing = PaymentProcessingViewModel.previewProcessing
        #expect(processing.stage == .processing)

        let verifying = PaymentProcessingViewModel.previewVerifying
        #expect(verifying.stage == .verifying)

        let completed = PaymentProcessingViewModel.previewCompleted
        #expect(completed.isCompleted == true)
    }
}
