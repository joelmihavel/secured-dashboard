/// PaymentMethodSelectionView.swift
/// Flent Secured v2 - Payment Method Selection Bottom Sheet
///
/// Figma Nodes:
/// - 41:7005 - Choose Payment Method (initial setup - "Set it up" buttons)
/// - 41:9114 - Choose Payment Method (with fees - UPI Free, Card 325 fee, NB 10 fee)
/// - 41:7674 - Payment card: Default state
/// - 41:7675 - Payment card: Selected state
/// - 41:7676 - Payment card: Disabled state
///
/// Features:
/// - Bottom sheet presentation with drag handle
/// - Radio button selection with method icons
/// - "Set it up" buttons for unconfigured methods
/// - Fee display (Free/amount) for configured methods
/// - Cashback notice pill
/// - Primary CTA button

import SwiftUI

// MARK: - Payment Method Selection View

/// Main bottom sheet for choosing payment method
/// Used in two contexts:
/// 1. Initial setup (41:7005) - Shows "Set it up" buttons
/// 2. Payment flow (41:9114) - Shows fees and allows selection
struct PaymentMethodSelectionView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppCoordinator.self) private var coordinator

    @Binding var selectedMethod: SavedPaymentMethod?
    let savedMethods: [SavedPaymentMethod]
    let rentAmountPaise: Int
    let onMethodSelected: (SavedPaymentMethod) -> Void
    let onSetupMethod: (PaymentMethodType) -> Void

    // MARK: - Visual Test Mode

    /// Enable to use Figma mock data for pixel-perfect testing
    var isVisualTestMode: Bool = false

    /// Figma-exact mock data for visual testing
    private struct FigmaMockData {
        static let rentAmount = 3250000  // 32,500 in paise
        static let cardFee = 325         // From Figma 41:9114
        static let netBankingFee = 10    // From Figma 41:9114
        static let upiFee = 0            // Free
        static let cashbackAmount = 325  // From Figma
    }

    /// Whether this is setup mode (shows "Set it up") or selection mode (shows fees)
    var isSetupMode: Bool {
        savedMethods.isEmpty
    }

    private var displayRentAmount: Int {
        isVisualTestMode ? FigmaMockData.rentAmount : rentAmountPaise
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Drag handle - Figma: 40x4, rd-2, #4D4D4D
            DragHandle()
                .padding(.top, Spacing.md)
                .padding(.bottom, Spacing.lg)
                .frame(maxWidth: .infinity)

            // Title - Figma: 28px regular, split color
            titleSection
                .padding(.bottom, Spacing.lg)

            // Cashback notice - Only show in selection mode
            if !isSetupMode {
                cashbackNoticePill
                    .padding(.bottom, Spacing.lg)
            }

            // Payment Method Options
            VStack(spacing: Spacing.sm) {
                if isSetupMode {
                    // Setup mode - Show all method types with "Set it up"
                    setupModeRows
                } else {
                    // Selection mode - Show saved methods with fees
                    selectionModeRows
                }
            }
            .padding(.bottom, Spacing.lg)

            // Flexible space before button
            Spacer()
                .frame(minHeight: Spacing.md)

            // CTA Button
            ctaButton
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
        .padding(.bottom, Spacing.xl)
        .background(AppColors.backgroundSecondary)
        .clipShape(RoundedCorner(radius: Radius.xl, corners: [.topLeft, .topRight]))
    }

    // MARK: - Title Section

    /// Figma: "Choose a" (white) + "Payment Method" (brand500)
    /// 28px regular, line-height 40px, tracking -1px
    private var titleSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Choose a")
                .font(Typography.h4)
                .foregroundColor(.white)
            Text("Payment Method")
                .font(Typography.h4)
                .foregroundColor(AppColors.brand500)
        }
    }

    // MARK: - Setup Mode Rows

    @State private var selectedMethodType: PaymentMethodType? = .upi

    private var setupModeRows: some View {
        VStack(spacing: Spacing.sm) {
            PaymentMethodTypeSetupRow(
                type: .upi,
                isSelected: selectedMethodType == .upi
            ) {
                HapticManager.shared.lightImpact()
                withAnimation(.easeInOut(duration: 0.2)) {
                    selectedMethodType = .upi
                }
            } onSetup: {
                HapticManager.shared.mediumImpact()
                onSetupMethod(.upi)
            }

            PaymentMethodTypeSetupRow(
                type: .netBanking,
                isSelected: selectedMethodType == .netBanking
            ) {
                HapticManager.shared.lightImpact()
                withAnimation(.easeInOut(duration: 0.2)) {
                    selectedMethodType = .netBanking
                }
            } onSetup: {
                HapticManager.shared.mediumImpact()
                onSetupMethod(.netBanking)
            }

            PaymentMethodTypeSetupRow(
                type: .creditCard,
                isSelected: selectedMethodType == .creditCard
            ) {
                HapticManager.shared.lightImpact()
                withAnimation(.easeInOut(duration: 0.2)) {
                    selectedMethodType = .creditCard
                }
            } onSetup: {
                HapticManager.shared.mediumImpact()
                onSetupMethod(.creditCard)
            }
        }
    }

    // MARK: - Selection Mode Rows

    private var selectionModeRows: some View {
        VStack(spacing: Spacing.sm) {
            ForEach(savedMethods) { method in
                PaymentMethodFeeRow(
                    method: method,
                    isSelected: selectedMethod?.id == method.id,
                    rentAmountPaise: displayRentAmount,
                    isVisualTestMode: isVisualTestMode
                ) {
                    HapticManager.shared.lightImpact()
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedMethod = method
                    }
                }
            }
        }
    }

    // MARK: - Cashback Notice Pill

    /// Figma: 14px regular neutral500, centered
    /// Shows cashback applies message
    private var cashbackNoticePill: some View {
        Text("Cashback applies to your next on-time payment")
            .font(Typography.bodyMd2)
            .foregroundColor(AppColors.neutral500)
            .frame(maxWidth: .infinity, alignment: .center)
    }

    // MARK: - CTA Button

    @ViewBuilder
    private var ctaButton: some View {
        if isSetupMode {
            // Setup mode - Button to set up selected method
            PrimaryButton(
                title: "Set up \(selectedMethodType?.displayName ?? "UPI")",
                isEnabled: true
            ) {
                HapticManager.shared.mediumImpact()
                onSetupMethod(selectedMethodType ?? .upi)
            }
        } else {
            // Selection mode - Pay button
            // Figma 41:9114: Secondary style (dark bg with orange border)
            VStack(spacing: Spacing.sm) {
                PrimaryButton(
                    title: "Pay \(formattedTotalAmount)",
                    isEnabled: selectedMethod != nil,
                    style: .secondary
                ) {
                    HapticManager.shared.mediumImpact()
                    if let method = selectedMethod {
                        onMethodSelected(method)
                    }
                }

                // Footer note - Figma: 12px regular neutral500
                Text("You'll see the final amount before payment")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.neutral500)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Computed Properties

    private var formattedTotalAmount: String {
        let amount = Double(displayRentAmount) / 100.0
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 0
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: amount)) ?? "\u{20B9}\(Int(amount))"
    }
}

// MARK: - Payment Method Setup Row

/// Row for setup mode - shows method type with "Set it up" button
/// Figma: node-id=41:7005
/// - Radio button: 24x24, 2px stroke, brand500 fill when selected
/// - Icon: 24x24 method-specific icon
/// - Title: 16px medium white
/// - "Set it up": 14px medium brand500, right aligned
struct PaymentMethodTypeSetupRow: View {
    let type: PaymentMethodType
    let isSelected: Bool
    let onSelect: () -> Void
    let onSetup: () -> Void

    var body: some View {
        HStack(spacing: Spacing.md) {
            // Radio button
            RadioButton(isSelected: isSelected)
                .onTapGesture(perform: onSelect)

            // Method icon
            PaymentMethodIcon(type: type, size: 24)

            // Method name - Figma: 16px medium white
            Text(type.displayName)
                .font(Typography.bodyMdMedium)
                .foregroundColor(.white)

            Spacer()

            // "Set it up" button - Figma: 14px medium brand500
            Button(action: onSetup) {
                Text("Set it up")
                    .font(Typography.bodyMd2Medium)
                    .foregroundColor(AppColors.brand500)
            }
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radius.sm)
                .fill(isSelected ? AppColors.brand500.opacity(0.1) : Color.clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.sm)
                .stroke(
                    isSelected ? AppColors.brand500 : AppColors.black400,
                    lineWidth: isSelected ? 1.5 : 1
                )
        )
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
    }
}

// MARK: - Payment Method Fee Row

/// Row for selection mode - shows saved method with fee
/// Figma: node-id=41:9114
/// - Radio button: 24x24, 2px stroke, brand500 when selected
/// - Icon: 24x24 method-specific icon
/// - Title: 16px medium white
/// - Subtitle: 14px regular neutral500 (masked details)
/// - Fee: 14px regular - "Free" (success) or "X fee" (neutral500) right aligned
struct PaymentMethodFeeRow: View {
    let method: SavedPaymentMethod
    let isSelected: Bool
    let rentAmountPaise: Int
    let isVisualTestMode: Bool
    let action: () -> Void

    /// Figma mock fees for visual testing
    private struct FigmaFees {
        static let card = 325
        static let netBanking = 10
        static let upi = 0
    }

    private var feeText: String {
        let feePaise = isVisualTestMode ? figmaFee : method.calculateFee(forAmountPaise: rentAmountPaise)
        if feePaise == 0 {
            return "Free"
        } else {
            return "\u{20B9}\(feePaise) fee"
        }
    }

    private var figmaFee: Int {
        switch method.type {
        case .creditCard: return FigmaFees.card
        case .netBanking: return FigmaFees.netBanking
        case .upi: return FigmaFees.upi
        }
    }

    private var feeColor: Color {
        let feePaise = isVisualTestMode ? figmaFee : method.calculateFee(forAmountPaise: rentAmountPaise)
        return feePaise == 0 ? AppColors.success : AppColors.neutral500
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.md) {
                // Radio button
                RadioButton(isSelected: isSelected)

                // Method icon
                PaymentMethodIcon(type: method.type, size: 24)

                // Method details
                VStack(alignment: .leading, spacing: Spacing.xxxs) {
                    // Title - Figma: 16px medium white
                    Text(method.type.displayName)
                        .font(Typography.bodyMdMedium)
                        .foregroundColor(.white)

                    // Subtitle - Figma: 14px regular neutral500
                    Text(method.maskedDetails)
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.neutral500)
                }

                Spacer()

                // Fee - Figma: 14px regular, success for Free, neutral500 for fee
                Text(feeText)
                    .font(Typography.bodyMd2)
                    .foregroundColor(feeColor)
            }
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .fill(isSelected ? AppColors.brand500.opacity(0.1) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .stroke(
                        isSelected ? AppColors.brand500 : AppColors.black400,
                        lineWidth: isSelected ? 1.5 : 1
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Radio Button Component

/// Reusable radio button matching Figma design
/// Figma: 24x24, 2px stroke, inner fill 14px when selected
struct RadioButton: View {
    let isSelected: Bool

    var body: some View {
        ZStack {
            Circle()
                .stroke(
                    isSelected ? AppColors.brand500 : AppColors.black400,
                    lineWidth: 2
                )
                .frame(width: 24, height: 24)

            if isSelected {
                Circle()
                    .fill(AppColors.brand500)
                    .frame(width: 14, height: 14)
            }
        }
    }
}

// MARK: - Payment Method Icon

/// Icon for each payment method type
/// Uses SF Symbols styled to match Figma
struct PaymentMethodIcon: View {
    let type: PaymentMethodType
    let size: CGFloat

    var body: some View {
        Image(systemName: type.iconName)
            .font(.system(size: size * 0.67, weight: .medium))
            .foregroundColor(AppColors.neutral300)
            .frame(width: size, height: size)
    }
}

// MARK: - Payment Card States

/// Payment card component with multiple states
/// Figma nodes: 41:7674 (default), 41:7675 (selected), 41:7676 (disabled)
struct PaymentMethodCard: View {
    let method: SavedPaymentMethod
    let state: CardState
    let action: () -> Void

    enum CardState {
        case `default`    // 41:7674
        case selected     // 41:7675
        case disabled     // 41:7676
    }

    private var borderColor: Color {
        switch state {
        case .default: return AppColors.black400
        case .selected: return AppColors.brand500
        case .disabled: return AppColors.black400.opacity(0.5)
        }
    }

    private var backgroundColor: Color {
        switch state {
        case .default: return Color.clear
        case .selected: return AppColors.brand500.opacity(0.1)
        case .disabled: return AppColors.black500.opacity(0.5)
        }
    }

    private var textOpacity: Double {
        state == .disabled ? 0.5 : 1.0
    }

    var body: some View {
        Button(action: {
            guard state != .disabled else { return }
            action()
        }) {
            HStack(spacing: Spacing.md) {
                // Radio button
                RadioButton(isSelected: state == .selected)
                    .opacity(state == .disabled ? 0.5 : 1.0)

                // Method icon
                PaymentMethodIcon(type: method.type, size: 24)
                    .opacity(textOpacity)

                // Method details
                VStack(alignment: .leading, spacing: Spacing.xxxs) {
                    Text(method.type.displayName)
                        .font(Typography.bodyMdMedium)
                        .foregroundColor(.white)

                    Text(method.maskedDetails)
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.neutral500)
                }
                .opacity(textOpacity)

                Spacer()
            }
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .stroke(borderColor, lineWidth: state == .selected ? 1.5 : 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(state == .disabled)
    }
}

// MARK: - Payment Method Type

/// Payment method categories for the UI
enum PaymentMethodType: String, CaseIterable, Identifiable, Sendable {
    case upi
    case netBanking
    case creditCard

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .upi: return "UPI"
        case .netBanking: return "Net Banking"
        case .creditCard: return "Credit Card"
        }
    }

    var iconName: String {
        switch self {
        case .upi: return "link"
        case .netBanking: return "building.columns"
        case .creditCard: return "creditcard"
        }
    }

    /// Icon for HomeView compatibility
    var icon: String {
        switch self {
        case .upi: return "indianrupeesign.circle.fill"
        case .netBanking: return "building.columns.fill"
        case .creditCard: return "creditcard.fill"
        }
    }

    /// Description for HomeView compatibility
    var description: String {
        switch self {
        case .upi: return "Instant payments with 1% cashback"
        case .netBanking: return "Secure bank transfer with 1% cashback"
        case .creditCard: return "Pay with credit card (1.2% fee applies)"
        }
    }

    /// Fee percentage (0 = free)
    /// These are defaults - actual fees come from backend
    var feePercentage: Double {
        switch self {
        case .upi: return 0
        case .netBanking: return 0.003 // ~0.3%
        case .creditCard: return 0.01  // ~1%
        }
    }
}

// MARK: - Saved Payment Method

/// Represents a saved/configured payment method
struct SavedPaymentMethod: Identifiable, Equatable, Sendable {
    let id: String
    let type: PaymentMethodType
    let displayName: String
    let maskedDetails: String  // "****2345" or "el@oksbi"
    let isDefault: Bool

    /// Additional data for specific method types
    var upiId: String?
    var last4Digits: String?
    var expiryDate: String?
    var bankCode: String?
    var cardNetwork: String?  // "VISA", "Mastercard", etc.

    func calculateFee(forAmountPaise amount: Int) -> Int {
        Int(Double(amount) * type.feePercentage)
    }

    // MARK: - Mock Data

    static let mockUPI = SavedPaymentMethod(
        id: "upi-1",
        type: .upi,
        displayName: "UPI",
        maskedDetails: "****el@oksbi",
        isDefault: true,
        upiId: "rishabh.el@oksbi"
    )

    static let mockCard = SavedPaymentMethod(
        id: "card-1",
        type: .creditCard,
        displayName: "Credit Card",
        maskedDetails: "****2345",
        isDefault: false,
        last4Digits: "2345",
        expiryDate: "06/26",
        cardNetwork: "VISA"
    )

    static let mockNetBanking = SavedPaymentMethod(
        id: "nb-1",
        type: .netBanking,
        displayName: "Net Banking",
        maskedDetails: "HDFC Bank",
        isDefault: false,
        bankCode: "HDFC"
    )

    /// Ordered to match Figma 41:9114 (Card first, then UPI, then Net Banking)
    static let allMocks: [SavedPaymentMethod] = [mockCard, mockUPI, mockNetBanking]
}

// MARK: - Previews

#Preview("Setup Mode - 41:7005") {
    ZStack {
        AppColors.backgroundPrimary
            .ignoresSafeArea()

        VStack {
            Spacer()

            PaymentMethodSelectionView(
                selectedMethod: .constant(nil),
                savedMethods: [],
                rentAmountPaise: 3250000,
                onMethodSelected: { _ in },
                onSetupMethod: { _ in },
                isVisualTestMode: true
            )
            .environment(AppCoordinator())
        }
    }
}

#Preview("Selection Mode - 41:9114") {
    ZStack {
        AppColors.backgroundPrimary
            .ignoresSafeArea()

        VStack {
            Spacer()

            PaymentMethodSelectionView(
                selectedMethod: .constant(SavedPaymentMethod.mockCard),
                savedMethods: SavedPaymentMethod.allMocks,
                rentAmountPaise: 3250000,
                onMethodSelected: { _ in },
                onSetupMethod: { _ in },
                isVisualTestMode: true
            )
            .environment(AppCoordinator())
        }
    }
}

#Preview("Card States - 41:7674, 41:7675, 41:7676") {
    ZStack {
        AppColors.backgroundPrimary
            .ignoresSafeArea()

        VStack(spacing: Spacing.md) {
            Text("Card States")
                .font(Typography.h5)
                .foregroundColor(.white)

            PaymentMethodCard(
                method: .mockUPI,
                state: .default,
                action: {}
            )

            PaymentMethodCard(
                method: .mockCard,
                state: .selected,
                action: {}
            )

            PaymentMethodCard(
                method: .mockNetBanking,
                state: .disabled,
                action: {}
            )
        }
        .padding(Spacing.screenHorizontalCompact)
    }
}
