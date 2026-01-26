/// PaymentView.swift
/// Flent Secured v2 - Payment Container View
///
/// Container for payment flow navigation

import SwiftUI

struct PaymentView: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        PaymentMethodsView()
    }
}

#Preview {
    PaymentView()
        .environment(AppCoordinator())
}
