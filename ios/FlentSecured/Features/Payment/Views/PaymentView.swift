/// PaymentView.swift
/// Flent Secured v2 - Payment Container View
///
/// PIXEL PERFECT from Figma:
/// - Background: #131313 with dotted grid pattern
/// - Horizontal padding: 48pt (sp-48)
///
/// Container for payment flow navigation
/// Routes to appropriate payment screen based on state
///
/// Payment Flow:
/// 1. PaymentTransactionView - Shows rent summary with cashback info
/// 2. PaymentMethodsView - Select payment method (UPI, Card, Net Banking)
/// 3. PayUWebView - PayU checkout (or UPI Intent)
/// 4. PaymentProcessingView - Realtime status polling
/// 5. PaymentResultView - Success/Failure/Refunded result

import SwiftUI

struct PaymentView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var isLoading = true
    @State private var hasPendingPayment = false
    @State private var pendingPaymentId: String?

    var body: some View {
        Group {
            if isLoading {
                loadingView
            } else if hasPendingPayment, let paymentId = pendingPaymentId {
                // Resume pending payment
                PaymentProcessingView(paymentId: paymentId)
            } else {
                // Start new payment - show transaction summary
                PaymentTransactionView(
                    tenancyId: appState.currentTenancy?.id ?? "",
                    rentAmountPaise: appState.currentTenancy?.monthlyRentPaise ?? 2500000,
                    cashbackAvailablePaise: 0,
                    dueDate: calculateDueDate(),
                    isCashbackEligible: isCashbackEligible()
                )
            }
        }
        .task {
            await checkPendingPayments()
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            DottedGridPattern()
                .ignoresSafeArea()

            VStack(spacing: Spacing.md) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AppColors.brand500))
                    .scaleEffect(1.2)

                Text("Loading payment...")
                    .font(Typography.bodyMd2) // 14px Regular
                    .foregroundColor(AppColors.black200) // #A6A6A6
            }
        }
    }

    // MARK: - Helper Methods

    private func checkPendingPayments() async {
        isLoading = true

        // Check for any pending/processing payments
        do {
            let currentMonth = currentRentMonth()
            if let tenancyId = appState.currentTenancy?.id {
                let paymentService = AppEnvironment.shared.paymentService
                let hasPayment = try await paymentService.hasPaymentForMonth(
                    tenancyId: tenancyId,
                    rentMonth: currentMonth
                )

                if hasPayment {
                    // Get payment history to find pending payment
                    let payments = try await paymentService.getPaymentHistory(
                        tenancyId: tenancyId,
                        limit: 1,
                        offset: 0
                    )

                    if let latestPayment = payments.first,
                       latestPayment.paymentMonth == currentMonth {
                        switch latestPayment.paymentStatus {
                        case .initiated, .processing:
                            hasPendingPayment = true
                            pendingPaymentId = latestPayment.id
                        case .success, .settled:
                            // Payment already complete - navigate to result
                            coordinator.navigate(to: .paymentResult(
                                paymentId: latestPayment.id,
                                success: true
                            ))
                            return
                        case .failed, .refunded:
                            // Allow retry
                            hasPendingPayment = false
                        }
                    }
                }
            }
        } catch {
            // Continue to transaction view on error
            print("[PaymentView] Error checking pending payments: \(error)")
        }

        isLoading = false
    }

    private func currentRentMonth() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: Date())
    }

    private func calculateDueDate() -> Date {
        let calendar = Calendar.current
        var components = calendar.dateComponents([.year, .month], from: Date())

        // Use rent due day from tenancy or default to 5th
        let dueDay: Int
        if let tenancy = appState.currentTenancy {
            dueDay = tenancy.rentDueDay
        } else {
            dueDay = 5
        }
        components.day = dueDay

        return calendar.date(from: components) ?? Date()
    }

    private func isCashbackEligible() -> Bool {
        // Cashback is available if paying before the 7th
        let calendar = Calendar.current
        let day = calendar.component(.day, from: Date())
        return day <= 7
    }
}

#Preview {
    PaymentView()
        .environment(AppCoordinator())
        .environment(AppState())
}
