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

    // Local state to force view updates
    @State private var isReady = false

    var body: some View {
        @Bindable var coordinator = coordinator

        Group {
            if !isReady {
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
        .onChange(of: appState.isInitialized) { _, newValue in
            isReady = newValue
        }
        .onAppear {
            // Check initial state
            isReady = appState.isInitialized
        }
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
            SplashCarouselView()

        case .phoneEntry(let authIntent):
            PhoneEntryView(authIntent: authIntent)

        case .otpVerification(let phone, let name):
            OTPVerificationView(phone: phone, name: name)

        // Onboarding
        case .nameVerification:
            NameVerificationView()

        case .agreementUpload:
            AgreementUploadView()

        case .agreementReview(let extractionId):
            AgreementReviewView(extractionId: extractionId)

        case .waitlist:
            WaitlistView()

        case .postApprovalStep1:
            PostApprovalStep1View()

        case .postApprovalStep2:
            PostApprovalStep2View()

        // Setup
        case .pendingSteps:
            PendingStepsView()

        case .addBank:
            AddBankView()

        case .addUtility:
            AddUtilityView()

        case .inviteLandlord:
            InviteLandlordView()

        case .setupFlow(let state):
            SetupFlowStateView(initialState: state)

        // Main App
        case .home(let state):
            HomeView(state: state)

        case .homeZeroStateFigma:
            HomeZeroStateFigmaView()

        case .payment:
            PaymentView()

        case .paymentTransaction(let tenancyId, let rentAmountPaise):
            PaymentTransactionView(
                tenancyId: tenancyId,
                rentAmountPaise: rentAmountPaise
            )

        case .paymentMethods:
            PaymentMethodsView()

        case .paymentMethodSelectionSheet:
            PaymentMethodSelectionSheetWrapper()

        case .paymentSummary(let paymentId):
            PaymentSummaryView(paymentId: paymentId)

        case .paymentProcessing(let paymentId):
            PaymentProcessingView(paymentId: paymentId)

        case .paymentResult(let paymentId, let success, let refunded):
            PaymentResultView(paymentId: paymentId, success: success, refunded: refunded)

        // Transactions
        case .transactions:
            TransactionsView()

        case .transactionDetail(let id):
            TransactionDetailView(transactionId: id)

        // Profile
        case .profile:
            ProfileView()

        case .personalDetails:
            PersonalDetailsView()

        case .tenancyDetails:
            TenancyDetailsView()

        case .paymentHistory:
            PaymentHistoryView()

        case .helpFAQ:
            HelpFAQView()

        case .settings:
            SettingsView()

        case .referral:
            ReferralView()

        case .linkedLandlord:
            LinkedLandlordView()

        case .landlordBankAccount:
            LandlordBankAccountView()

        case .agreementDetails:
            AgreementDetailsView()

        case .editUPI:
            ProfileEditUPIView()

        case .editCreditCard:
            ProfileEditCreditCardView()
        }
    }
}

// Note: LoadingView is defined in Core/DesignSystem/Components/LoadingView.swift

// MARK: - Payment Method Selection Sheet Wrapper

/// Wrapper for presenting PaymentMethodSelectionView as a bottom sheet modal
/// Figma: 41:7005 - "Choose a Payment Method" bottom sheet
/// Shows dark overlay with home screen dimmed behind, bottom sheet with rounded corners
struct PaymentMethodSelectionSheetWrapper: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppCoordinator.self) private var coordinator

    @State private var selectedMethod: SavedPaymentMethod? = nil

    var body: some View {
        ZStack {
            // Dark overlay background matching Figma
            AppColors.black700.opacity(0.7)
                .ignoresSafeArea()
                .onTapGesture {
                    dismiss()
                }

            VStack {
                Spacer()

                // Bottom sheet content - setup mode (no saved methods)
                PaymentMethodSelectionView(
                    selectedMethod: $selectedMethod,
                    savedMethods: [],  // Empty = setup mode with "Set it up" buttons
                    rentAmountPaise: 3250000,  // Mock: Rs 32,500
                    onMethodSelected: { method in
                        dismiss()
                        // Handle method selection
                    },
                    onSetupMethod: { methodType in
                        dismiss()
                        coordinator.navigate(to: .paymentMethods)
                    },
                    isVisualTestMode: true
                )
                .frame(maxHeight: UIScreen.main.bounds.height * 0.6)
            }
        }
        .background(Color.clear)
        .presentationBackground(.clear)
        .presentationDragIndicator(.hidden)
    }
}

// MARK: - Preview

#Preview {
    ContentView()
        .environment(AppState())
        .environment(AppCoordinator())
}
