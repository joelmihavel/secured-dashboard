/// PaymentSummaryView.swift
/// Flent Secured v2 - Payment Summary Screen
///
/// Shows payment breakdown before confirmation

import SwiftUI

struct PaymentSummaryView: View {
    @Environment(AppCoordinator.self) private var coordinator

    let paymentId: String

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            Text("Payment Summary: \(paymentId)")
                .foregroundColor(AppColors.textPrimary)
        }
        .navigationBarHidden(true)
    }
}

#Preview {
    PaymentSummaryView(paymentId: "test-123")
        .environment(AppCoordinator())
}
