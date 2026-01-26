/// PaymentMethodsView.swift
/// Flent Secured v2 - Payment Methods Selection Screen
///
/// Allows user to select payment method
/// Available methods depend on user status (QUALIFIED vs COMPLETE)
///
/// Figma: Pay Rent / Payment Page screens

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
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Back Button
                Button {
                    coordinator.pop()
                } label: {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(AppColors.textPrimary)
                        .frame(width: 44, height: 44) // Minimum tap target for accessibility
                }
                .accessibilityIdentifier("back_button")
                .accessibilityLabel("Go back")

                // Header
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Choose a Payment Method")
                        .font(Typography.h4)
                        .foregroundColor(AppColors.textPrimary)

                    // Amount Summary
                    HStack {
                        Text("Total:")
                            .font(Typography.bodyMd2)
                            .foregroundColor(AppColors.textSecondary)

                        Text(viewModel.formattedTotalAmount)
                            .font(Typography.amountMedium)
                            .foregroundColor(AppColors.textPrimary)
                    }
                }

                // Payment Methods
                VStack(spacing: Spacing.md) {
                    // UPI Section
                    PaymentMethodSection(title: "UPI") {
                        PaymentMethodCard(
                            method: .upiIntent,
                            title: "Google Pay",
                            icon: "g.circle.fill",
                            isSelected: viewModel.selectedMethod == .upiIntent && viewModel.selectedUPIApp == .gpay
                        ) {
                            viewModel.selectUPIApp(.gpay)
                        }

                        PaymentMethodCard(
                            method: .upiIntent,
                            title: "PhonePe",
                            icon: "p.circle.fill",
                            isSelected: viewModel.selectedMethod == .upiIntent && viewModel.selectedUPIApp == .phonePe
                        ) {
                            viewModel.selectUPIApp(.phonePe)
                        }

                        PaymentMethodCard(
                            method: .upiIntent,
                            title: "Other UPI",
                            icon: "link.circle.fill",
                            isSelected: viewModel.selectedMethod == .upiIntent && viewModel.selectedUPIApp == .other
                        ) {
                            viewModel.selectUPIApp(.other)
                        }
                    }

                    // Bank Section
                    PaymentMethodSection(title: "Bank Account") {
                        PaymentMethodCard(
                            method: .netBanking,
                            title: "Net Banking",
                            icon: "building.columns.fill",
                            isSelected: viewModel.selectedMethod == .netBanking
                        ) {
                            viewModel.selectMethod(.netBanking)
                        }
                    }

                    // Card Section (only for COMPLETE users)
                    if viewModel.canUseCreditCard {
                        PaymentMethodSection(title: "Cards") {
                            PaymentMethodCard(
                                method: .creditCard,
                                title: "Credit/Debit Card",
                                icon: "creditcard.fill",
                                isSelected: viewModel.selectedMethod == .creditCard
                            ) {
                                viewModel.selectMethod(.creditCard)
                            }
                        }
                    } else {
                        // Locked section for QUALIFIED users
                        VStack(alignment: .leading, spacing: Spacing.xs) {
                            HStack {
                                Text("Cards")
                                    .font(Typography.label)
                                    .foregroundColor(AppColors.textMuted)

                                Image(systemName: "lock.fill")
                                    .font(.system(size: 12))
                                    .foregroundColor(AppColors.textMuted)
                            }

                            Text("Complete 3 on-time payments to unlock")
                                .font(Typography.caption)
                                .foregroundColor(AppColors.textMuted)
                        }
                    }
                }

                // Error Message
                if let error = viewModel.errorMessage {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(AppColors.error)
                        Text(error)
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.error)
                    }
                    .padding(Spacing.sm)
                    .background(AppColors.error.opacity(0.1))
                    .cornerRadius(Radius.sm)
                }

                Spacer()

                // Pay Button
                PrimaryButton(
                    title: "Pay \(viewModel.formattedTotalAmount)",
                    isLoading: viewModel.isInitiating,
                    isEnabled: viewModel.canInitiate
                ) {
                    initiatePayment()
                }
            }
            .screenPadding()
            .padding(.top, Spacing.xl)
        }
        .navigationBarHidden(true)
        .task {
            // Fetch user profile to get correct userStatus
            do {
                let userProfile = try await AppEnvironment.shared.userService.getCurrentUser()
                let status = UserStatus(rawValue: userProfile.userStatus) ?? .qualified

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

// MARK: - PaymentMethod moved to PaymentServiceProtocol.swift

// MARK: - Payment Method Section

struct PaymentMethodSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title)
                .font(Typography.label)
                .foregroundColor(AppColors.textSecondary)

            content()
        }
    }
}

// MARK: - Payment Method Card

struct PaymentMethodCard: View {
    let method: PaymentMethod
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundColor(isSelected ? AppColors.accentPrimary : AppColors.textSecondary)

                Text(title)
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(AppColors.accentPrimary)
                }
            }
            .padding(Spacing.md)
            .background(isSelected ? AppColors.accentPrimary.opacity(0.1) : AppColors.backgroundSecondary)
            .cornerRadius(Radius.sm)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .stroke(
                        isSelected ? AppColors.accentPrimary : AppColors.border,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .accessibilityIdentifier("payment_method_\(title.lowercased().replacingOccurrences(of: " ", with: "_"))")
    }
}

#Preview {
    PaymentMethodsView()
        .environment(AppCoordinator())
        .environment(AppState())
}
