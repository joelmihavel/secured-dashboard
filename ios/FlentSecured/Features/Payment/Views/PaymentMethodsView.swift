/// PaymentMethodsView.swift
/// Flent Secured v2 - Payment Methods Selection Screen
///
/// Figma: node-id=1:34854
/// - Presented as bottom sheet (dark bg #1A1A1A)
/// - "Choose a" white + "Payment Method" orange
/// - Cashback pill badge
/// - Radio buttons for payment options
/// - Fee labels on right
/// - Primary button with amount

import SwiftUI

struct PaymentMethodsView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel: PaymentMethodsViewModel
    @State private var showPayUWebView = false
    @State private var currentPaymentInitiation: PaymentInitiation?

    // Store init params to rebuild viewModel with correct userStatus from AppState
    private let tenancyId: String
    private let rentAmountPaise: Int
    private let providedUserStatus: UserStatus?

    init(tenancyId: String = "", rentAmountPaise: Int = 2500000, userStatus: UserStatus? = nil) {
        self.tenancyId = tenancyId
        self.rentAmountPaise = rentAmountPaise
        self.providedUserStatus = userStatus

        // Initialize with provided status or default to qualified (will be updated in onAppear)
        self._viewModel = State(initialValue: PaymentMethodsViewModel(
            tenancyId: tenancyId,
            rentMonth: Self.currentRentMonth(),
            rentAmountPaise: rentAmountPaise,
            cashbackAvailablePaise: 0,
            userStatus: userStatus ?? .qualified
        ))
    }

    private static func currentRentMonth() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: Date())
    }

    var body: some View {
        ZStack {
            // Background with dimmed content
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern (like onboarding screens)
            DottedGridPattern()
                .ignoresSafeArea()

            // Dimmed header content
            VStack(alignment: .leading) {
                FlentLogo()
                    .padding(.top, Spacing.xxl)
                    .opacity(0.3)

                Spacer()
            }
            .padding(.horizontal, Spacing.screenHorizontal)

            // Bottom sheet
            VStack {
                Spacer()

                BottomSheetContainer {
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        // Title - Split color
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Choose a")
                                .font(.system(size: 28, weight: .regular))
                                .foregroundColor(.white)
                            Text("Payment Method")
                                .font(.system(size: 28, weight: .regular))
                                .foregroundColor(AppColors.brand500)
                        }

                        // Cashback pill
                        Text("You'll earn ₹\(viewModel.estimatedCashbackFormatted) cashback on this payment")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.white)
                            .padding(.horizontal, Spacing.md)
                            .padding(.vertical, Spacing.sm)
                            .frame(maxWidth: .infinity)
                            .background(AppColors.black500)
                            .cornerRadius(Radius.pill)

                        // Payment Methods with Radio Buttons
                        VStack(spacing: Spacing.md) {
                            // UPI Option
                            PaymentMethodRadioRow(
                                icon: "link",
                                title: "UPI",
                                fee: "No fee",
                                isSelected: viewModel.selectedMethod == .upiIntent
                            ) {
                                viewModel.selectMethod(.upiIntent)
                            }

                            // Cards Option (conditionally available)
                            if viewModel.canUseCreditCard {
                                PaymentMethodRadioRow(
                                    icon: "creditcard",
                                    title: "Credit/Debit Card",
                                    fee: "1.2% fee",
                                    isSelected: viewModel.selectedMethod == .creditCard
                                ) {
                                    viewModel.selectMethod(.creditCard)
                                }
                            } else {
                                PaymentMethodRadioRow(
                                    icon: "creditcard",
                                    title: "Credit/Debit Card",
                                    fee: "1.2% fee",
                                    isSelected: false,
                                    isLocked: true,
                                    lockMessage: "Complete 3 payments to unlock"
                                ) {}
                            }

                            // Net Banking Option
                            PaymentMethodRadioRow(
                                icon: "building.columns",
                                title: "Net Banking",
                                fee: "No fee",
                                isSelected: viewModel.selectedMethod == .netBanking
                            ) {
                                viewModel.selectMethod(.netBanking)
                            }
                        }

                        // Error Message
                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(.system(size: 14, weight: .regular))
                                .foregroundColor(AppColors.error)
                        }

                        // Pay Button
                        PrimaryButton(
                            title: "Pay \(viewModel.formattedTotalAmount)",
                            isLoading: viewModel.isInitiating,
                            isEnabled: viewModel.canInitiate
                        ) {
                            initiatePayment()
                        }
                    }
                }
            }
        }
        .navigationBarHidden(true)
        .task {
            // Fetch user profile to get correct userStatus
            do {
                let userProfile = try await AppEnvironment.shared.userService.getCurrentUser()
                let status = userProfile.userStatus.flatMap { UserStatus(rawValue: $0) } ?? .qualified

                // Also try to get tenancy data
                let tenancy = try? await AppEnvironment.shared.userService.getCurrentTenancy()

                viewModel = PaymentMethodsViewModel(
                    tenancyId: tenancy?.id ?? tenancyId,
                    rentMonth: Self.currentRentMonth(),
                    rentAmountPaise: tenancy?.monthlyRentPaise ?? rentAmountPaise,
                    cashbackAvailablePaise: 0,
                    userStatus: providedUserStatus ?? status
                )
            } catch {
                print("[PaymentMethodsView] Failed to fetch user data: \(error)")
                // Keep the default viewModel
            }
        }
        .fullScreenCover(isPresented: $showPayUWebView) {
            if let initiation = currentPaymentInitiation {
                PayUWebViewContainer(
                    params: initiation.payuParams,
                    paymentId: initiation.paymentId,
                    onComplete: handlePaymentComplete
                )
            }
        }
    }

    private func initiatePayment() {
        Task {
            if let initiation = await viewModel.initiatePayment() {
                currentPaymentInitiation = initiation

                // Check if UPI intent is available and selected
                if let intentUrl = initiation.intentUrl,
                   viewModel.selectedMethod == .upiIntent,
                   viewModel.selectedUPIApp != .other,
                   let url = URL(string: intentUrl) {
                    // Try to open UPI app directly
                    PayUManager.shared.openUPIIntent(url: url) { success in
                        if success {
                            // App opened - navigate to processing view
                            coordinator.navigate(to: .paymentProcessing(paymentId: initiation.paymentId))
                        } else {
                            // Fallback to WebView
                            showPayUWebView = true
                        }
                    }
                } else {
                    // Use WebView for other payment methods
                    showPayUWebView = true
                }
            }
        }
    }

    private func handlePaymentComplete(success: Bool, errorMessage: String?) {
        showPayUWebView = false

        if let initiation = currentPaymentInitiation {
            // Navigate to processing view which will poll for status
            coordinator.navigate(to: .paymentProcessing(paymentId: initiation.paymentId))
        }
    }
}

// MARK: - Payment Method Radio Row

struct PaymentMethodRadioRow: View {
    let icon: String
    let title: String
    let fee: String
    let isSelected: Bool
    var isLocked: Bool = false
    var lockMessage: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: {
            if !isLocked {
                action()
            }
        }) {
            HStack(spacing: Spacing.md) {
                // Radio button
                ZStack {
                    Circle()
                        .stroke(isLocked ? AppColors.black400 : (isSelected ? AppColors.brand500 : AppColors.neutral500), lineWidth: 2)
                        .frame(width: 24, height: 24)

                    if isSelected && !isLocked {
                        Circle()
                            .fill(AppColors.brand500)
                            .frame(width: 14, height: 14)
                    }

                    if isLocked {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 10))
                            .foregroundColor(AppColors.black400)
                    }
                }

                // Icon
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(isLocked ? AppColors.black400 : .white)
                    .frame(width: 24)

                // Title
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(isLocked ? AppColors.black400 : .white)

                    if let message = lockMessage, isLocked {
                        Text(message)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.black400)
                    }
                }

                Spacer()

                // Fee
                Text(fee)
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(isLocked ? AppColors.black400 : AppColors.neutral500)
            }
            .padding(Spacing.md)
            .background(isSelected && !isLocked ? AppColors.brand500.opacity(0.1) : Color.clear)
            .cornerRadius(Radius.sm)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .stroke(isSelected && !isLocked ? AppColors.brand500 : AppColors.black400, lineWidth: 1)
            )
        }
        .disabled(isLocked)
    }
}

#Preview {
    PaymentMethodsView()
        .environment(AppCoordinator())
        .environment(AppState())
}
