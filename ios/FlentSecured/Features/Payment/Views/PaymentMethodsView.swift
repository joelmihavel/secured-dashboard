/// PaymentMethodsView.swift
/// Flent Secured v2 - Payment Methods Selection Screen
///
/// Figma Nodes:
/// - 41:8901 - Without Setup (cards locked for QUALIFIED users)
/// - 41:9004 - Before 7th (cashback eligible, all methods for COMPLETE)
/// - 41:9114 - After 7th (no cashback earning)
///
/// Features:
/// - Payment method selection with radio buttons
/// - Locked card option for non-COMPLETE users
/// - Cashback pill showing earnings
/// - Fee transparency per method
/// - PayU WebView integration

import SwiftUI

struct PaymentMethodsView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel: PaymentMethodsViewModel
    @State private var showPayUWebView = false
    @State private var showSummarySheet = false
    @State private var showAddUPI = false
    @State private var showAddCard = false
    @State private var showAddNetBanking = false
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

    /// Check if before 7th (cashback eligible)
    private var isCashbackEligible: Bool {
        let day = Calendar.current.component(.day, from: Date())
        return day <= 7
    }

    var body: some View {
        ZStack {
            // Background
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Navigation Header - Figma: Standard nav bar
                HStack {
                    Button {
                        HapticManager.shared.lightImpact()
                        coordinator.pop()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(.white)
                            .frame(width: 44, height: 44)
                    }

                    Spacer()

                    Text("Payment")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)

                    Spacer()

                    // Spacer for alignment
                    Color.clear.frame(width: 44, height: 44)
                }
                .padding(.horizontal, Spacing.xs)
                .background(AppColors.backgroundPrimary)

                // Dimmed logo section - Figma: Faded Flent logo
                VStack(alignment: .leading) {
                    FlentLogo()
                        .padding(.top, Spacing.lg)
                        .padding(.leading, Spacing.screenHorizontal)
                        .opacity(0.3)

                    Spacer()
                }

                Spacer()
            }

            // Bottom sheet - Figma: BottomSheetContainer style
            VStack {
                Spacer()

                paymentMethodsSheet
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
        .sheet(isPresented: $showSummarySheet) {
            PaymentSummaryView(
                paymentId: currentPaymentInitiation?.paymentId ?? "",
                rentAmountPaise: viewModel.rentAmountPaise,
                pgFeePaise: viewModel.pgFeePaise,
                cashbackAppliedPaise: viewModel.applyCashback ? Int(viewModel.cashbackToApply * 100) : 0,
                paymentMethod: viewModel.selectedMethod ?? .upiIntent,
                onConfirm: {
                    showSummarySheet = false
                    proceedWithPayment()
                }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.hidden)
        }
        .sheet(isPresented: $showAddUPI) {
            AddUPIView { upiId in
                print("Added UPI: \(upiId)")
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.hidden)
        }
        .sheet(isPresented: $showAddCard) {
            AddCreditCardView {
                print("Card added")
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
        }
        .sheet(isPresented: $showAddNetBanking) {
            AddNetBankingView { bank in
                print("Selected bank: \(bank.name)")
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
        }
    }

    // MARK: - Payment Methods Sheet

    /// Figma: Bottom sheet with payment method options
    private var paymentMethodsSheet: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Drag handle
            DragHandle()
                .padding(.top, Spacing.md)
                .padding(.bottom, Spacing.lg)
                .frame(maxWidth: .infinity)

            // Title - Figma: Split color, 28px regular
            VStack(alignment: .leading, spacing: 0) {
                Text("Choose a")
                    .font(.system(size: 28, weight: .regular))
                    .foregroundColor(.white)
                Text("Payment Method")
                    .font(.system(size: 28, weight: .regular))
                    .foregroundColor(AppColors.brand500)
            }
            .padding(.bottom, Spacing.lg)

            // Cashback pill - Only show when eligible (before 7th)
            if isCashbackEligible && viewModel.estimatedCashbackFormatted != "0" {
                cashbackEarningPill
                    .padding(.bottom, Spacing.lg)
            } else if !isCashbackEligible {
                // Late payment notice
                latePaymentNoticePill
                    .padding(.bottom, Spacing.lg)
            }

            // Payment Methods with Radio Buttons
            VStack(spacing: Spacing.sm) {
                // UPI Option - Always available
                PaymentMethodRadioRow(
                    icon: "link",
                    title: "UPI",
                    subtitle: nil,
                    fee: "No fee",
                    isSelected: viewModel.selectedMethod == .upiIntent,
                    isLocked: false,
                    lockMessage: nil
                ) {
                    viewModel.selectMethod(.upiIntent)
                }

                // Cards Option (conditionally available)
                if viewModel.canUseCreditCard {
                    PaymentMethodRadioRow(
                        icon: "creditcard",
                        title: "Credit/Debit Card",
                        subtitle: nil,
                        fee: "1.2% fee",
                        isSelected: viewModel.selectedMethod == .creditCard,
                        isLocked: false,
                        lockMessage: nil
                    ) {
                        viewModel.selectMethod(.creditCard)
                    }
                } else {
                    PaymentMethodRadioRow(
                        icon: "creditcard",
                        title: "Credit/Debit Card",
                        subtitle: "Complete 3 payments to unlock",
                        fee: "1.2% fee",
                        isSelected: false,
                        isLocked: true,
                        lockMessage: "Complete 3 payments to unlock"
                    ) {
                        // No action for locked
                    }
                }

                // Net Banking Option - Always available
                PaymentMethodRadioRow(
                    icon: "building.columns",
                    title: "Net Banking",
                    subtitle: nil,
                    fee: "No fee",
                    isSelected: viewModel.selectedMethod == .netBanking,
                    isLocked: false,
                    lockMessage: nil
                ) {
                    viewModel.selectMethod(.netBanking)
                }
            }
            .padding(.bottom, Spacing.lg)

            // Error Message
            if let error = viewModel.errorMessage {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.error)
                    Text(error)
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(AppColors.error)
                }
                .padding(.bottom, Spacing.md)
            }

            // Pay Button - Figma: Primary CTA with amount
            PrimaryButton(
                title: "Pay \(viewModel.formattedTotalAmount)",
                isLoading: viewModel.isInitiating,
                isEnabled: viewModel.canInitiate
            ) {
                initiatePayment()
            }
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
        .padding(.bottom, Spacing.xl)
        .background(AppColors.backgroundSecondary)
        .clipShape(RoundedCorner(radius: Radius.xl, corners: [.topLeft, .topRight]))
    }

    // MARK: - Cashback Earning Pill

    /// Figma: dark bg (#202020), rounded pill, 14px medium
    /// Shows estimated cashback earnings
    private var cashbackEarningPill: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "gift.fill")
                .font(.system(size: 14))
                .foregroundColor(AppColors.brand500)

            Group {
                Text("You'll earn ")
                    .foregroundColor(AppColors.neutral500)
                + Text("\u{20B9}\(viewModel.estimatedCashbackFormatted) cashback")
                    .foregroundColor(.white)
                + Text(" on this payment")
                    .foregroundColor(AppColors.neutral500)
            }
            .font(.system(size: 14, weight: .medium))
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .frame(maxWidth: .infinity)
        .background(AppColors.black500)
        .cornerRadius(Radius.pill)
    }

    // MARK: - Late Payment Notice Pill

    /// Shown when payment is after 7th (no cashback earning)
    private var latePaymentNoticePill: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 14))
                .foregroundColor(AppColors.warning)

            Text("No cashback on payments after the 7th")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(AppColors.neutral500)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .frame(maxWidth: .infinity)
        .background(AppColors.warning.opacity(0.1))
        .cornerRadius(Radius.pill)
    }

    // MARK: - Payment Flow

    private func initiatePayment() {
        // First show summary for confirmation
        HapticManager.shared.mediumImpact()
        showSummarySheet = true
    }

    private func proceedWithPayment() {
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
                            HapticManager.shared.success()
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
            } else {
                // Payment initiation failed - show error haptic
                HapticManager.shared.error()
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

/// Payment method selection row with radio button
/// Figma: node-id=1:34854
/// - Radio button: 24x24, 2px stroke, inner fill 14px when selected
/// - Icon: 20px SF Symbol
/// - Title: 16px medium white
/// - Fee: 14px regular neutral/500
/// - Selected: brand/500 border, brand/500 10% fill
/// - Locked: gray icons, lock icon in radio, subtitle text
struct PaymentMethodRadioRow: View {
    let icon: String
    let title: String
    let subtitle: String?
    let fee: String
    let isSelected: Bool
    var isLocked: Bool = false
    var lockMessage: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: {
            if !isLocked {
                HapticManager.shared.lightImpact()
                action()
            }
        }) {
            HStack(spacing: Spacing.md) {
                // Radio button - Figma: 24x24, 2px stroke
                ZStack {
                    Circle()
                        .stroke(
                            isLocked ? AppColors.black400 : (isSelected ? AppColors.brand500 : AppColors.black400),
                            lineWidth: 2
                        )
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

                // Icon - Figma: 20px
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(isLocked ? AppColors.black400 : .white)
                    .frame(width: 24)

                // Title and subtitle
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(isLocked ? AppColors.black400 : .white)

                    if let sub = subtitle, isLocked {
                        Text(sub)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.black300)
                    }
                }

                Spacer()

                // Fee label - Figma: 14px regular
                Text(fee)
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(isLocked ? AppColors.black400 : AppColors.neutral500)
            }
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .fill(isSelected && !isLocked ? AppColors.brand500.opacity(0.1) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .stroke(
                        isSelected && !isLocked ? AppColors.brand500 : AppColors.black400,
                        lineWidth: isSelected && !isLocked ? 1.5 : 1
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(isLocked)
    }
}

// MARK: - Previews

#Preview("Payment Methods - Qualified User") {
    PaymentMethodsView(userStatus: .qualified)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Payment Methods - Complete User") {
    PaymentMethodsView(userStatus: .complete)
        .environment(AppCoordinator())
        .environment(AppState())
}
