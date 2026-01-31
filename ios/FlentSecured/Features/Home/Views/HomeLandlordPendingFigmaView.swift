/// HomeLandlordPendingFigmaView.swift
/// Pixel-perfect implementation of Figma landlord invitation pending states:
/// - 41:5175 "Home --Empty State / Landlord Pending >24hrs"
/// - 41:5381 "Home --Empty State / Invite Pending (Failed)"
///
/// These screens show:
/// - Standard header and headline
/// - Payment setup card (no payment method yet)
/// - "FINISH SETUP" section with landlord status
/// - Progress checklist waiting for landlord approval
///
/// Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
/// Design Width: 393pt (iPhone 14 Pro)

import SwiftUI

// MARK: - Landlord Pending State Type

enum LandlordPendingStateType {
    /// Pending >24hrs - can send reminder
    /// Shows: "Still pending with your landlord"
    case pendingOver24hrs

    /// Invite failed/pending
    /// Shows: "Invite pending"
    case invitePending

    var title: String {
        switch self {
        case .pendingOver24hrs:
            return "Still pending with your landlord"
        case .invitePending:
            return "Invite pending"
        }
    }

    var subtitle: String {
        switch self {
        case .pendingOver24hrs:
            return "If they haven't seen the invite yet, a personal message often helps."
        case .invitePending:
            return "You can still pay rent. Rewards unlock when your landlord joins."
        }
    }

    var buttonTitle: String {
        switch self {
        case .pendingOver24hrs:
            return "Send Reminder"
        case .invitePending:
            return "Contact support"
        }
    }
}

// MARK: - Main Landlord Pending View

struct HomeLandlordPendingFigmaView: View {
    /// Visual testing mode with mock data
    var isVisualTestMode: Bool = true

    /// The pending state type
    var pendingState: LandlordPendingStateType = .pendingOver24hrs

    // MARK: - State
    @State private var viewModel = HomeViewModel()

    // MARK: - Mock Data
    private struct FigmaMockData {
        static let userName = "Rishabh"
        static let daysUntilDue = 10
        static let rentAmount = "32,500"
        static let daysInFooter = 28
    }

    private var userName: String {
        guard !isVisualTestMode else { return FigmaMockData.userName }
        let name = viewModel.firstName
        return (name.isEmpty || name == "there") ? FigmaMockData.userName : name
    }

    private var daysUntilDue: Int {
        guard !isVisualTestMode else { return FigmaMockData.daysUntilDue }
        return viewModel.daysUntilDue == 0 ? FigmaMockData.daysUntilDue : viewModel.daysUntilDue
    }

    var body: some View {
        ZStack {
            // Background
            AppColors.black700
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Scrollable content
                ScrollView(showsIndicators: false) {
                    VStack(spacing: Spacing.lg) { // 24pt
                        // Header
                        HomeHeaderFigma(userName: userName)

                        // Headline
                        LandlordPendingHeadline(daysUntilDue: daysUntilDue)

                        // Payment Setup Card
                        PaymentSetupCardLandlord()

                        // Finish Setup Section
                        FinishSetupSection(pendingState: pendingState)

                        // Waiting for Landlord Progress
                        WaitingForLandlordProgress()
                    }
                    .padding(.bottom, 120) // Footer space
                }

                // Sticky Footer
                LandlordPendingFooter(
                    rentAmount: FigmaMockData.rentAmount,
                    daysUntilDue: FigmaMockData.daysInFooter
                )
            }
        }
        .task {
            await viewModel.loadDashboard()
        }
    }
}

// MARK: - Headline

struct LandlordPendingHeadline: View {
    let daysUntilDue: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Your rent is due")
                .font(Typography.h4)
                .foregroundColor(Color(hex: "BABABA"))

            Text("in \(daysUntilDue) days")
                .font(Typography.h4)
                .foregroundColor(AppColors.brand500)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.xl)
    }
}

// MARK: - Payment Setup Card (Landlord variant)
/// Shows "Setup your payment method to start"

struct PaymentSetupCardLandlord: View {
    var body: some View {
        VStack(spacing: 0) {
            // Top content area
            VStack(alignment: .leading, spacing: Spacing.lg) { // 24pt
                // Title text
                VStack(alignment: .leading, spacing: Spacing.xs) { // 8pt
                    (Text("Setup")
                        .foregroundColor(AppColors.brand500) +
                     Text(" your payment\nmethod to start")
                        .foregroundColor(AppColors.neutral300))
                        .font(Typography.bodyLg)

                    Text("Add UPI, card, or bank to start\nearning rewards")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.neutral600)
                }

                // Add Payment button
                GradientBorderButton(title: "+ Add Payment") {}
            }
            .padding(Spacing.lg) // 24pt
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                ZStack {
                    AppColors.black500

                    Image("card_pattern")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .opacity(0.16)

                    Color.black.opacity(0.64)
                }
            )
            .clipShape(
                UnevenRoundedRectangle(
                    topLeadingRadius: Radius.md,
                    bottomLeadingRadius: 0,
                    bottomTrailingRadius: 0,
                    topTrailingRadius: Radius.md
                )
            )

            // Footer
            HStack {
                HStack(spacing: Spacing.xxs) {
                    Text("NEW PAYMENT")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.neutral300)

                    Image(systemName: "info.circle")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.neutral300)
                }

                Spacer()

                Image("flent-logo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 20, height: 24)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, Spacing.lg)
            .background(AppColors.black600)
            .clipShape(
                UnevenRoundedRectangle(
                    topLeadingRadius: 0,
                    bottomLeadingRadius: Radius.md,
                    bottomTrailingRadius: Radius.md,
                    topTrailingRadius: 0
                )
            )
        }
        .frame(width: 270)
        .padding(.leading, Spacing.xl * 2) // 64pt left
        .padding(.trailing, Spacing.xl) // 32pt right
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Finish Setup Section

struct FinishSetupSection: View {
    let pendingState: LandlordPendingStateType

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) { // 16pt
            // Section label
            Text("FINISH SETUP")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(1)

            // Status card
            VStack(alignment: .leading, spacing: Spacing.sm) { // 12pt
                Text(pendingState.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)

                Text(pendingState.subtitle)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                    .fixedSize(horizontal: false, vertical: true)

                // Action button
                Button {
                    // Action
                } label: {
                    Text(pendingState.buttonTitle)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.xs)
                        .background(AppColors.brand500)
                        .clipShape(Capsule())
                }
                .padding(.top, Spacing.xxs)
            }
            .padding(Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppColors.black500)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        }
        .padding(.horizontal, Spacing.xl)
    }
}

// MARK: - Waiting for Landlord Progress

struct WaitingForLandlordProgress: View {
    private let setupItems = [
        ("Add landlord's bank details", "enables secure payouts", true),
        ("Upload address proof", "for verification", false),
        ("Invite your landlord", "needed for cashback eligibility", false)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) { // 24pt
            // Title
            Text("Waiting for Landlord's approval")
                .font(Typography.bodyMd2)
                .foregroundColor(AppColors.neutral300)

            // Progress items
            VStack(spacing: Spacing.lg) {
                ForEach(Array(setupItems.enumerated()), id: \.offset) { index, item in
                    WaitingProgressItem(
                        title: item.0,
                        subtitle: item.1,
                        isActive: item.2,
                        isLast: index == setupItems.count - 1
                    )
                }
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.lg)
        .background(AppColors.black500)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .padding(.horizontal, Spacing.xl)
    }
}

struct WaitingProgressItem: View {
    let title: String
    let subtitle: String
    let isActive: Bool
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.xs) {
            // Indicator
            VStack(spacing: 0) {
                Circle()
                    .fill(isActive ? AppColors.brand500 : AppColors.black400)
                    .frame(width: 16, height: 16)

                if !isLast {
                    Rectangle()
                        .fill(AppColors.black400)
                        .frame(width: 2, height: 36)
                }
            }

            // Text
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(Typography.bodyMd2)
                    .foregroundColor(isActive ? AppColors.brand500 : AppColors.neutral300)

                Text(subtitle)
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.neutral600)
            }

            Spacer()
        }
    }
}

// MARK: - Footer

struct LandlordPendingFooter: View {
    let rentAmount: String
    let daysUntilDue: Int

    var body: some View {
        HStack {
            // Left: Due info
            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("Due in \(daysUntilDue) Days")
                    .font(Typography.bodySmBold)
                    .foregroundColor(AppColors.neutral500)

                HStack(spacing: 2) {
                    Text("\u{20B9}")
                        .font(Typography.bodySmSemiBold)
                        .foregroundColor(AppColors.neutral100)

                    Text(rentAmount)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.neutral100)
                        .tracking(-0.48)
                }
            }

            Spacer()

            // Right: Review button
            Button {
                // Navigate to review
            } label: {
                Text("Review")
                    .font(Typography.bodyMdMedium)
                    .foregroundColor(.white)
                    .padding(.horizontal, Spacing.xl)
                    .padding(.vertical, Spacing.sm)
                    .background(AppColors.brand500)
                    .clipShape(Capsule())
            }
        }
        .padding(.horizontal, Spacing.xl)
        .padding(.top, Spacing.md)
        .padding(.bottom, Spacing.xxl)
        .background(AppColors.black500)
    }
}

// MARK: - Previews

#Preview("41-5175: Pending >24hrs") {
    HomeLandlordPendingFigmaView(
        isVisualTestMode: true,
        pendingState: .pendingOver24hrs
    )
}

#Preview("41-5381: Invite Pending") {
    HomeLandlordPendingFigmaView(
        isVisualTestMode: true,
        pendingState: .invitePending
    )
}
