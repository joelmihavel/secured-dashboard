/// PaymentTransactionView.swift
/// Flent Secured v2 - Transaction Page Screen
///
/// Figma Nodes:
/// - 41:7676 - First Visit / No Cashback (new user promo)
/// - 41:8695 - With Cashback (user has cashback balance)
/// - 41:9681 - Without Cashback (no balance but eligible)
/// - 41:9746 - Late Payment (after 7th, no cashback earning)
///
/// Features:
/// - Payment summary card with rent breakdown
/// - Cashback eligibility and amount display
/// - Due date indicator with urgency states
/// - Late payment warning when after 7th
/// - CTA to proceed to payment method selection

import SwiftUI

// MARK: - Transaction View State

enum TransactionViewState {
    case firstVisit       // New user, no prior cashback
    case withCashback     // Has cashback balance to apply
    case withoutCashback  // No balance but eligible to earn
    case latePayment      // After 7th, no cashback earning
}

// MARK: - Payment Transaction View

/// Main transaction summary screen
/// Figma: node-id=41:7676, 41:8695, 41:9681, 41:9746
struct PaymentTransactionView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel: PaymentTransactionViewModel

    init(
        tenancyId: String = "",
        rentAmountPaise: Int = 0,
        cashbackAvailablePaise: Int = 0,
        dueDate: Date = Date(),
        isCashbackEligible: Bool = true
    ) {
        self._viewModel = State(initialValue: PaymentTransactionViewModel(
            tenancyId: tenancyId,
            rentAmountPaise: rentAmountPaise,
            cashbackAvailablePaise: cashbackAvailablePaise,
            dueDate: dueDate,
            isCashbackEligible: isCashbackEligible
        ))
    }

    /// Determine the view state based on data
    private var viewState: TransactionViewState {
        if !viewModel.isCashbackEligible {
            return .latePayment
        } else if viewModel.cashbackAvailablePaise > 0 {
            return .withCashback
        } else if viewModel.isFirstPayment {
            return .firstVisit
        } else {
            return .withoutCashback
        }
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
                // Navigation header
                navigationHeader

                if viewModel.isLoading {
                    Spacer()
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: AppColors.brand500))
                        .scaleEffect(1.5)
                    Spacer()
                } else {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: Spacing.lg) {
                            // Status Card (when eligible but no balance)
                            if viewState == .firstVisit || viewState == .withoutCashback {
                                UnlockCashbackCard(
                                    daysDue: viewModel.daysUntilDue,
                                    potentialCashback: viewModel.formattedEstimatedCashback
                                )
                                .transition(.opacity.combined(with: .move(edge: .top)))
                            }

                            // Payment Summary Card - Figma: Receipt-style card
                            paymentSummaryCard

                            // Cashback Applied Card (when balance available and applied)
                            if viewState == .withCashback && viewModel.cashbackAppliedPaise > 0 {
                                cashbackAppliedCard
                                    .transition(.opacity.combined(with: .move(edge: .top)))
                            }

                            // Earn More Cashback (when has balance and earning more)
                            if viewState == .withCashback && viewModel.isCashbackEligible {
                                earnMoreCashbackCard
                                    .transition(.opacity.combined(with: .move(edge: .top)))
                            }

                            // Late Payment Warning
                            if viewState == .latePayment {
                                latePaymentWarning
                                    .transition(.opacity.combined(with: .move(edge: .top)))
                            }

                            Spacer()
                                .frame(height: Spacing.xxl)
                        }
                        .padding(.horizontal, Spacing.screenHorizontalCompact)
                        .padding(.top, Spacing.lg)
                    }

                    // Bottom CTA
                    bottomCTA
                }
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadData()
        }
    }

    // MARK: - Navigation Header

    private var navigationHeader: some View {
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

            Text("Pay Rent")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(.white)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, Spacing.xs)
        .background(AppColors.backgroundPrimary)
    }

    // MARK: - Payment Summary Card

    private var paymentSummaryCard: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("Rent Payment")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.neutral500)

                Text(viewModel.rentMonthFormatted)
                    .font(.system(size: 24, weight: .regular))
                    .foregroundColor(.white)
            }

            DashedDivider()

            VStack(spacing: Spacing.sm) {
                BreakdownRow(
                    label: "Monthly Rent",
                    value: viewModel.formattedRentAmount
                )

                if viewModel.platformFeePaise > 0 {
                    BreakdownRow(
                        label: "Platform Fee",
                        value: viewModel.formattedPlatformFee,
                        valueColor: AppColors.neutral500
                    )
                }

                if viewModel.cashbackAppliedPaise > 0 {
                    BreakdownRow(
                        label: "Cashback Applied",
                        value: "-\(viewModel.formattedCashbackApplied)",
                        valueColor: AppColors.success
                    )
                }
                
                if viewState == .withoutCashback {
                     BreakdownRow(
                        label: "Cashback 🔒",
                        value: "- \(viewModel.formattedEstimatedCashback)",
                        valueColor: Color(hex: "EF9194")
                    )
                }
            }

            DashedDivider()

            HStack {
                Text("Total Amount")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)

                Spacer()

                Text(viewModel.formattedTotalAmount)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundColor(.white)
            }

            dueDateIndicator
        }
        .padding(Spacing.lg)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.card)
    }

    // MARK: - Due Date Indicator

    private var dueDateIndicator: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "calendar")
                .font(.system(size: 14))
                .foregroundColor(dueDateColor)

            Text(viewModel.dueDateMessage)
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(dueDateColor)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(dueDateColor.opacity(0.1))
        .cornerRadius(Radius.sm)
    }

    private var dueDateColor: Color {
        if viewModel.isOverdue {
            return AppColors.error
        } else if viewModel.isDueToday {
            return AppColors.warning
        } else {
            return AppColors.neutral500
        }
    }

    // MARK: - Cashback Applied Card

    private var cashbackAppliedCard: some View {
        HStack(spacing: Spacing.md) {
            ZStack {
                Circle()
                    .fill(AppColors.success.opacity(0.2))
                    .frame(width: 44, height: 44)

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundColor(AppColors.success)
            }

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("Cashback Applied")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Text("\(viewModel.formattedCashbackApplied) savings on this payment")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Spacer()

            Button {
                HapticManager.shared.lightImpact()
                withAnimation(.easeInOut(duration: 0.2)) {
                    viewModel.toggleCashbackApplication()
                }
            } label: {
                Text("Remove")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppColors.brand500)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .background(AppColors.brand500.opacity(0.1))
                    .cornerRadius(Radius.xs)
            }
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radius.card)
                .fill(AppColors.success.opacity(0.05))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.card)
                .stroke(AppColors.success.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Earn More Cashback Card

    private var earnMoreCashbackCard: some View {
        HStack(spacing: Spacing.md) {
            ZStack {
                Circle()
                    .fill(AppColors.brand500.opacity(0.2))
                    .frame(width: 44, height: 44)

                Image(systemName: "gift.fill")
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.brand500)
            }

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("Earn More Cashback")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Text("You'll earn \(viewModel.formattedEstimatedCashback) on this payment")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Spacer()
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radius.card)
                .fill(AppColors.brand500.opacity(0.05))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.card)
                .stroke(AppColors.brand500.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Late Payment Warning

    private var latePaymentWarning: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 20))
                .foregroundColor(AppColors.warning)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("Late Payment")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Text("Cashback is not available for payments after the 7th. Pay on time next month to earn rewards.")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Spacing.md)
        .background(AppColors.warning.opacity(0.1))
        .cornerRadius(Radius.card)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.card)
                .stroke(AppColors.warning.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Bottom CTA

    private var bottomCTA: some View {
        VStack(spacing: Spacing.sm) {
            PrimaryButton(
                title: "Choose Payment Method",
                isLoading: viewModel.isLoading
            ) {
                HapticManager.shared.mediumImpact()
                coordinator.navigate(to: .paymentMethods)
            }

            Text("By proceeding, you agree to the payment terms")
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(AppColors.neutral500)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
        .padding(.vertical, Spacing.md)
        .background(AppColors.backgroundSecondary)
    }
    
    // MARK: - Unlock Cashback Card
    
    struct UnlockCashbackCard: View {
        let daysDue: Int
        let potentialCashback: String
        
        var body: some View {
            VStack(spacing: Spacing.lg) {
                VStack(spacing: Spacing.xs) {
                    Text("Rent due in \(daysDue) days")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.neutral600)
                    
                    Text("Complete setup to unlock 1% cashback")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.neutral300)
                    
                    Text("\(potentialCashback) available to unlock")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.brand500)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(AppColors.black600)
                        .cornerRadius(200)
                }
                
                // Vector graphic placeholder
                Rectangle()
                    .fill(LinearGradient(colors: [AppColors.black600, AppColors.black500], startPoint: .leading, endPoint: .trailing))
                    .frame(height: 120)
                    .mask(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        Path { path in
                            path.move(to: CGPoint(x: 0, y: 120))
                            path.addCurve(to: CGPoint(x: 300, y: 0), control1: CGPoint(x: 100, y: 100), control2: CGPoint(x: 200, y: 50))
                        }
                        .stroke(AppColors.brand500.opacity(0.2), lineWidth: 2)
                    )
            }
            .padding(Spacing.lg)
            .background(AppColors.backgroundElevated)
            .cornerRadius(Radius.card)
        }
    }
}

// MARK: - Breakdown Row

struct BreakdownRow: View {
    let label: String
    let value: String
    var valueColor: Color = .white

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral500)

            Spacer()

            Text(value)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(valueColor)
        }
    }
}

// MARK: - Dashed Divider

struct DashedDivider: View {
    var color: Color = AppColors.black400

    var body: some View {
        GeometryReader { geometry in
            Path { path in
                path.move(to: CGPoint(x: 0, y: 0))
                path.addLine(to: CGPoint(x: geometry.size.width, y: 0))
            }
            .stroke(style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
            .foregroundColor(color)
        }
        .frame(height: 1)
    }
}