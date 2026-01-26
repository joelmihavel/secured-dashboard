/// PaymentProcessingViewModel.swift
/// Flent Secured v2 - Payment Processing ViewModel
///
/// Manages payment processing state and realtime status updates
/// Handles PayU WebView and UPI Intent flows
///
/// Figma: Pay Rent / Processing screens

import Foundation
import Observation

// MARK: - Payment Processing ViewModel

@Observable
final class PaymentProcessingViewModel {

    // MARK: - Processing Stage

    enum ProcessingStage: Equatable {
        case initiating
        case processing
        case verifying
        case completed(success: Bool)

        var title: String {
            switch self {
            case .initiating: return "Initiating payment"
            case .processing: return "Processing"
            case .verifying: return "Verifying"
            case .completed(let success): return success ? "Payment successful" : "Payment failed"
            }
        }

        var subtitle: String {
            switch self {
            case .initiating: return "Connecting to payment gateway"
            case .processing: return "This may take a moment"
            case .verifying: return "Almost done"
            case .completed(let success): return success ? "Redirecting..." : "Please try again"
            }
        }

        var iconName: String {
            switch self {
            case .initiating: return "creditcard"
            case .processing: return "arrow.triangle.2.circlepath"
            case .verifying: return "checkmark.shield"
            case .completed(let success): return success ? "checkmark.circle.fill" : "xmark.circle.fill"
            }
        }
    }

    // MARK: - Properties

    private(set) var stage: ProcessingStage = .initiating
    private(set) var paymentStatus: PaymentStatus = .initiated
    private(set) var errorMessage: String?
    private(set) var isCompleted = false

    let paymentId: String
    let payuParams: PayUParams?

    var dots: String = ""
    private var dotsTimer: Timer?
    private var statusTask: Task<Void, Never>?

    // MARK: - Computed Properties

    var showWarning: Bool {
        if case .completed = stage { return false }
        return true
    }

    var isSuccess: Bool {
        if case .completed(let success) = stage { return success }
        return false
    }

    // MARK: - Dependencies

    private let paymentService: PaymentServiceProtocol

    // MARK: - Initialization

    init(
        paymentId: String,
        payuParams: PayUParams? = nil,
        paymentService: PaymentServiceProtocol = AppEnvironment.shared.paymentService
    ) {
        self.paymentId = paymentId
        self.payuParams = payuParams
        self.paymentService = paymentService
    }

    // MARK: - Actions

    @MainActor
    func startProcessing() {
        startDotsAnimation()
        startRealtimeSubscription()
    }

    func stopProcessing() {
        stopDotsAnimation()
        statusTask?.cancel()
        realtimeTask?.cancel()
    }

    private var realtimeTask: Task<Void, Never>?

    @MainActor
    func checkStatus() async {
        do {
            let statusData = try await paymentService.getPaymentStatus(paymentId: paymentId)
            paymentStatus = statusData.paymentStatus

            updateStage(from: statusData.paymentStatus)
        } catch {
            // Continue polling, don't fail on status check
        }
    }

    // MARK: - Dots Animation

    func startDotsAnimation() {
        dotsTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            if self.dots.count >= 3 {
                self.dots = ""
            } else {
                self.dots += "."
            }
        }
    }

    func stopDotsAnimation() {
        dotsTimer?.invalidate()
        dotsTimer = nil
    }

    // MARK: - Realtime Subscription

    @MainActor
    private func startRealtimeSubscription() {
        realtimeTask = Task {
            // First, check current status
            await checkStatus()

            // If already completed, don't start subscription
            if case .completed = stage {
                isCompleted = true
                return
            }

            // Subscribe to Realtime updates
            let stream = SupabaseManager.shared.subscribeToPaymentStatus(paymentId: paymentId)

            for await update in stream {
                guard !Task.isCancelled else { break }

                paymentStatus = update.status
                updateStage(from: update.status)

                if case .completed = stage {
                    isCompleted = true
                    break
                }
            }
        }

        // Also start polling as a fallback (in case Realtime fails)
        startStatusPolling()
    }

    // MARK: - Status Polling (Fallback)

    @MainActor
    private func startStatusPolling() {
        statusTask = Task {
            // Wait a bit before starting polling (give Realtime a chance)
            try? await Task.sleep(nanoseconds: 3_000_000_000)

            // Poll every 3 seconds until completed or cancelled
            while !Task.isCancelled && !isCompleted {
                await checkStatus()

                // Check if we're done
                if case .completed = stage {
                    isCompleted = true
                    break
                }

                // Wait before next poll
                try? await Task.sleep(nanoseconds: 3_000_000_000)
            }
        }
    }

    private func updateStage(from status: PaymentStatus) {
        switch status {
        case .initiated:
            stage = .initiating
        case .processing:
            stage = .processing
        case .success, .settled:
            stopDotsAnimation()
            stage = .completed(success: true)
        case .failed, .refunded:
            stopDotsAnimation()
            stage = .completed(success: false)
        }
    }

    // MARK: - Simulated Processing (for testing)

    @MainActor
    func simulateProcessing() async {
        startDotsAnimation()

        stage = .initiating
        try? await Task.sleep(nanoseconds: 1_500_000_000)

        stage = .processing
        try? await Task.sleep(nanoseconds: 2_000_000_000)

        stage = .verifying
        try? await Task.sleep(nanoseconds: 1_000_000_000)

        stopDotsAnimation()
        stage = .completed(success: true)
        isCompleted = true
    }
}

// Note: PaymentStatus is defined in Core/Models/PaymentStatus.swift

// MARK: - Preview Helpers

extension PaymentProcessingViewModel {
    static var preview: PaymentProcessingViewModel {
        PaymentProcessingViewModel(
            paymentId: "test-payment-123",
            paymentService: MockPaymentService()
        )
    }

    static var previewProcessing: PaymentProcessingViewModel {
        let vm = PaymentProcessingViewModel(
            paymentId: "test-payment-123",
            paymentService: MockPaymentService()
        )
        vm.stage = .processing
        return vm
    }

    static var previewVerifying: PaymentProcessingViewModel {
        let vm = PaymentProcessingViewModel(
            paymentId: "test-payment-123",
            paymentService: MockPaymentService()
        )
        vm.stage = .verifying
        return vm
    }

    static var previewCompleted: PaymentProcessingViewModel {
        let vm = PaymentProcessingViewModel(
            paymentId: "test-payment-123",
            paymentService: MockPaymentService()
        )
        vm.stage = .completed(success: true)
        vm.isCompleted = true
        return vm
    }
}
