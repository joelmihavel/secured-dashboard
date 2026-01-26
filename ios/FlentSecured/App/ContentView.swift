/// ContentView.swift
/// Flent Secured v2 - Root Content View
///
/// Main view container that handles:
/// - Navigation stack setup
/// - Route-based view switching
/// - Sheet/fullscreen presentations
/// - Loading and error states

import SwiftUI

// MARK: - Content View

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        @Bindable var coordinator = coordinator

        Group {
            if !appState.isInitialized {
                // App is loading
                LoadingView()
            } else {
                // Main navigation
                NavigationStack(path: $coordinator.path) {
                    initialView
                        .navigationDestination(for: Route.self) { route in
                            viewForRoute(route)
                        }
                }
                .sheet(item: $coordinator.sheet) { route in
                    viewForRoute(route)
                }
                .fullScreenCover(item: $coordinator.fullScreenCover) { route in
                    viewForRoute(route)
                }
            }
        }
        .preferredColorScheme(.dark) // Force dark mode
        .alert("Error", isPresented: .init(
            get: { appState.showError },
            set: { if !$0 { appState.dismissError() } }
        )) {
            Button("OK") {
                appState.dismissError()
            }
        } message: {
            if let message = appState.errorMessage {
                Text(message)
            }
        }
    }

    // MARK: - Initial View

    @ViewBuilder
    private var initialView: some View {
        let route = coordinator.determineInitialRoute(for: appState)
        viewForRoute(route)
    }

    // MARK: - Route View Builder

    @ViewBuilder
    private func viewForRoute(_ route: Route) -> some View {
        switch route {
        // Splash & Auth
        case .splash:
            SplashView()

        case .phoneEntry:
            PhoneEntryView()

        case .otpVerification(let phone):
            OTPVerificationView(phone: phone)

        // Onboarding
        case .nameVerification:
            NameVerificationView()

        case .agreementUpload:
            AgreementUploadView()

        case .agreementReview(let extractionId):
            AgreementReviewView(extractionId: extractionId)

        case .waitlist:
            WaitlistView()

        // Setup
        case .pendingSteps:
            PendingStepsView()

        case .addBank:
            AddBankView()

        case .addUtility:
            AddUtilityView()

        case .inviteLandlord:
            InviteLandlordView()

        // Main App
        case .home(let state):
            HomeView(state: state)

        case .payment:
            PaymentView()

        case .paymentMethods:
            PaymentMethodsView()

        case .paymentSummary(let paymentId):
            PaymentSummaryView(paymentId: paymentId)

        case .paymentProcessing(let paymentId):
            PaymentProcessingView(paymentId: paymentId)

        case .paymentResult(let paymentId, let success):
            PaymentResultView(paymentId: paymentId, success: success)

        // Transactions
        case .transactions:
            TransactionsView()

        case .transactionDetail(let id):
            TransactionDetailView(transactionId: id)

        // Profile
        case .profile:
            ProfileView()

        case .settings:
            SettingsView()

        case .referral:
            ReferralView()
        }
    }
}

// Note: LoadingView is defined in Core/DesignSystem/Components/LoadingView.swift

// MARK: - Preview

#Preview {
    ContentView()
        .environment(AppState())
        .environment(AppCoordinator())
}
