/// ApplicationStatusView.swift
/// Flent Secured v2 - Application Status Screen
///
/// Figma Node IDs:
/// - 41-11206: Welcome - application in review
/// - 41-11825: We're still setting things up
///
/// Design Specifications:
/// - Background: #131313 (black700) with dotted grid pattern
/// - Logo: 32x38pt Flent logo
/// - Header: Multi-line text with gray + orange colors
/// - Status timeline card: 3 steps (Application Sent, In Review, Account Status)
/// - Release gauge: Semi-circle showing members onboarded
/// - Referral input: 4-box inline code entry
/// - Benefits section: 3 benefits at bottom
///
/// Typography:
/// - Header large: 48pt Regular (h1)
/// - Subtitle: 14pt Regular (bodyMd2)
/// - Timeline labels: 12pt Medium (bodySmMedium)
/// - Button: 16pt Medium (bodyMdMedium)

import SwiftUI

// MARK: - Application Status View

struct ApplicationStatusView: View {

    // MARK: - Visual Test Mode

    /// Enable visual testing mode to use mock data matching Figma exactly
    var isVisualTestMode: Bool = true

    /// Force specific variant for visual testing
    var forceSettingUpState: Bool = false

    // MARK: - Figma Mock Data

    private struct FigmaMockData {
        static let firstName = "Rishabh"
        static let lastName = "Agnihotri"
        static let submissionDate = "27 Jan 2026"
        static let reviewTime = "Approximately 24 hrs"
        static let reviewTimeLong = "Approximately 24-48 hrs"
        static let membersOnboarded = 18
        static let membersTarget = 150
    }

    // MARK: - Properties

    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = ApplicationStatusViewModel()
    @State private var referralCode: [String] = ["", "", "", ""]
    @State private var referralError: String?
    @State private var isApplyingReferral = false
    @State private var referralApplied = false
    @FocusState private var focusedReferralIndex: Int?

    // MARK: - Computed Properties

    private var displayFirstName: String {
        guard !isVisualTestMode else { return FigmaMockData.firstName }
        let name = viewModel.firstName
        return (name.isEmpty || name == "there") ? FigmaMockData.firstName : name
    }

    private var displayLastName: String {
        guard !isVisualTestMode else { return FigmaMockData.lastName }
        let name = viewModel.lastName
        return name.isEmpty ? FigmaMockData.lastName : name
    }

    private var displaySubmissionDate: String {
        guard !isVisualTestMode else { return FigmaMockData.submissionDate }
        return viewModel.formattedSubmissionDate
    }

    private var displayReviewTime: String {
        guard !isVisualTestMode else {
            return isSettingUp ? FigmaMockData.reviewTimeLong : FigmaMockData.reviewTime
        }
        return viewModel.estimatedReviewTime
    }

    private var displayMembersOnboarded: Int {
        guard !isVisualTestMode else { return FigmaMockData.membersOnboarded }
        return viewModel.membersOnboarded
    }

    private var displayMembersTarget: Int {
        guard !isVisualTestMode else { return FigmaMockData.membersTarget }
        return viewModel.membersTarget
    }

    private var isSettingUp: Bool {
        if isVisualTestMode && forceSettingUpState { return true }
        return viewModel.isSettingUp
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            DottedGridPattern()
                .ignoresSafeArea()

            // Content
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    // Logo - 32x38pt
                    logoSection

                    // Header
                    headerSection
                        .padding(.top, Spacing.xl)

                    // Status Timeline Card
                    statusTimelineCard
                        .padding(.top, Spacing.xl)

                    // Release Gauge Card with Referral
                    releaseGaugeCard
                        .padding(.top, Spacing.lg)

                    // Benefits Section
                    benefitsSection
                        .padding(.top, Spacing.lg)

                    // Bottom padding for scroll
                    Spacer()
                        .frame(height: Spacing.xxxl)
                }
                .padding(.horizontal, Spacing.xxxl)
            }
        }
        .navigationBarHidden(true)
        .task {
            if !isVisualTestMode {
                await viewModel.loadStatus()
            }
        }
    }

    // MARK: - Logo Section

    private var logoSection: some View {
        HStack {
            FlentLogo(size: 32)
            Spacer()
        }
        .padding(.top, Spacing.xl)
    }

    // MARK: - Header Section

    @ViewBuilder
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            if isSettingUp {
                // "We're still / setting / things up" header
                VStack(alignment: .leading, spacing: 0) {
                    Text("We're still")
                        .font(Typography.h1)
                        .foregroundColor(AppColors.neutral500)
                        .tracking(-2)

                    Text("setting")
                        .font(Typography.h1)
                        .foregroundColor(AppColors.brand500)
                        .tracking(-2)

                    Text("things up")
                        .font(Typography.h1)
                        .foregroundColor(AppColors.brand500)
                        .tracking(-2)
                }
            } else {
                // "Welcome, / Rishabh / Agnihotri" header
                VStack(alignment: .leading, spacing: 0) {
                    Text("Welcome,")
                        .font(Typography.h1)
                        .foregroundColor(AppColors.neutral500)
                        .tracking(-2)

                    Text(displayFirstName)
                        .font(Typography.h1)
                        .foregroundColor(AppColors.brand500)
                        .tracking(-2)

                    Text(displayLastName)
                        .font(Typography.h1)
                        .foregroundColor(AppColors.brand500)
                        .tracking(-2)
                }
            }

            // Subtitle
            Text("Your application is in review")
                .font(Typography.bodyMd2)
                .foregroundColor(AppColors.black200)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Status Timeline Card

    private var statusTimelineCard: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Step 1: Application Sent
            statusTimelineRow(
                label: "Application Sent",
                value: "Submitted on \(displaySubmissionDate)",
                dotColor: AppColors.brand500,
                isFilled: true,
                showLine: true
            )

            // Step 2: In Review
            statusTimelineRow(
                label: "In Review",
                value: displayReviewTime,
                dotColor: AppColors.brand500,
                isFilled: false,
                showLine: true
            )

            // Step 3: Account Status
            statusTimelineRow(
                label: "Account Status",
                value: "Pending",
                dotColor: AppColors.black400,
                isFilled: false,
                showLine: false
            )
        }
        .padding(Spacing.lg)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.lg)
    }

    private func statusTimelineRow(
        label: String,
        value: String,
        dotColor: Color,
        isFilled: Bool,
        showLine: Bool
    ) -> some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            // Dot and line column
            VStack(spacing: 0) {
                // Dot - 8x8pt
                if isFilled {
                    Circle()
                        .fill(dotColor)
                        .frame(width: 8, height: 8)
                } else {
                    Circle()
                        .stroke(dotColor, lineWidth: 1.5)
                        .frame(width: 8, height: 8)
                }

                // Connecting line (subtle orange tint for completed steps per Figma)
                if showLine {
                    Rectangle()
                        .fill(isFilled ? AppColors.brand500.opacity(0.3) : AppColors.black400)
                        .frame(width: 1, height: 32)
                }
            }

            // Labels column
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(Typography.bodySmSemiBold)
                    .foregroundColor(dotColor == AppColors.brand500 ? AppColors.brand500 : AppColors.textMuted)

                Text(value)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
            }

            Spacer()
        }
    }

    // MARK: - Release Gauge Card

    private var releaseGaugeCard: some View {
        VStack(spacing: Spacing.md) {
            // "This release" label
            HStack {
                VStack(alignment: .leading, spacing: 0) {
                    Text("This")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                    Text("release")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                }
                Spacer()
            }

            // Gauge visualization
            ReleaseGaugeView(
                current: displayMembersOnboarded,
                total: displayMembersTarget
            )
            .frame(height: 80)

            // Member count - centered
            VStack(spacing: 2) {
                Text("\(displayMembersOnboarded) / \(displayMembersTarget)")
                    .font(Typography.bodyMdMedium)
                    .foregroundColor(AppColors.textPrimary)

                Text("members onboarded")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.brand500)
            }

            // Referral section
            if !referralApplied {
                referralInputSection
            } else {
                referralAppliedSection
            }
        }
        .padding(Spacing.lg)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.lg)
    }

    // MARK: - Referral Input Section

    private var referralInputSection: some View {
        VStack(spacing: Spacing.md) {
            // Label
            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("Have an Invite Code?")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textMuted)

                Text("Get priority access to the platform if you use a referral code")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // 4-box input row
            HStack(spacing: Spacing.sm) {
                ForEach(0..<4, id: \.self) { index in
                    referralDigitBox(at: index)
                }
            }

            // Error message
            if let error = referralError {
                Text(error)
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.error)
            }

            // Divider line before button
            Rectangle()
                .fill(AppColors.black400)
                .frame(height: 1)
                .padding(.top, Spacing.xs)

            // Enter button
            SecondaryButton(
                title: "Enter Invite Code",
                isLoading: isApplyingReferral,
                isEnabled: referralCode.allSatisfy { !$0.isEmpty }
            ) {
                applyReferralCode()
            }
        }
    }

    private func referralDigitBox(at index: Int) -> some View {
        TextField("", text: Binding(
            get: { referralCode[index] },
            set: { newValue in
                let filtered = String(newValue.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(1))
                referralCode[index] = filtered

                // Auto-advance to next field
                if !filtered.isEmpty && index < 3 {
                    focusedReferralIndex = index + 1
                }
            }
        ))
        .font(.system(size: 24, weight: .semibold, design: .monospaced))
        .foregroundColor(AppColors.textPrimary)
        .multilineTextAlignment(.center)
        .textInputAutocapitalization(.characters)
        .autocorrectionDisabled()
        .keyboardType(.asciiCapable)
        .focused($focusedReferralIndex, equals: index)
        .frame(width: 52, height: 60)
        .background(AppColors.backgroundPrimary)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(
                    referralError != nil
                        ? AppColors.error
                        : (focusedReferralIndex == index ? AppColors.brand500 : AppColors.black400),
                    lineWidth: focusedReferralIndex == index || referralError != nil ? 2 : 1
                )
        )
    }

    private var referralAppliedSection: some View {
        VStack(spacing: Spacing.sm) {
            SecondaryButton(title: "Be notified") {
                // Enable notifications
            }

            Text("Kudos. You're among Secured's first members")
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textMuted)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Benefits Section

    private var benefitsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header
            VStack(alignment: .leading, spacing: 0) {
                Text("What do you get")
                    .font(Typography.h5)
                    .foregroundColor(AppColors.neutral500)

                Text("with Flent Secured?")
                    .font(Typography.h5)
                    .foregroundColor(AppColors.brand500)
            }

            // Benefits list
            VStack(spacing: Spacing.sm) {
                benefitRow(
                    iconName: "percent",
                    text: "Earn 1% back for paying rent on time"
                )

                benefitRow(
                    iconName: "chart.line.uptrend.xyaxis",
                    text: "Build a stronger rent history"
                )

                benefitRow(
                    iconName: "creditcard.fill",
                    text: "Unlock exclusive renting benefits over time"
                )
            }
        }
        .padding(Spacing.lg)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.lg)
    }

    private func benefitRow(iconName: String, text: String) -> some View {
        HStack(spacing: Spacing.sm) {
            // Icon box - orange gradient background (square aspect per Figma)
            ZStack {
                RoundedRectangle(cornerRadius: Radius.xs)
                    .fill(
                        LinearGradient(
                            colors: [AppColors.brand400, AppColors.brand500],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 28, height: 28)

                Image(systemName: iconName)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppColors.black700)
            }

            Text(text)
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textSecondary)

            Spacer()
        }
    }

    // MARK: - Actions

    private func applyReferralCode() {
        let code = referralCode.joined()
        guard code.count == 4 else {
            referralError = "Invalid Code"
            return
        }

        isApplyingReferral = true
        referralError = nil

        Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000) // 1.5 seconds

            await MainActor.run {
                isApplyingReferral = false

                // Test: "FAIL" triggers error, anything else succeeds
                if code.uppercased() == "FAIL" {
                    referralError = "Invalid Code"
                    HapticManager.shared.error()
                } else {
                    referralApplied = true
                    HapticManager.shared.success()
                }
            }
        }
    }
}

// MARK: - Release Gauge View (Local)

/// Semi-circular gauge showing onboarding progress
/// Figma: Orange gradient arc on dark background
private struct ReleaseGaugeView: View {
    let current: Int
    let total: Int

    private var progress: Double {
        guard total > 0 else { return 0 }
        return min(Double(current) / Double(total), 1.0)
    }

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let height = geometry.size.height

            ZStack {
                // Background arc - gray
                Path { path in
                    path.addArc(
                        center: CGPoint(x: width / 2, y: height),
                        radius: height * 0.9,
                        startAngle: .degrees(180),
                        endAngle: .degrees(0),
                        clockwise: false
                    )
                }
                .stroke(AppColors.black400, style: StrokeStyle(lineWidth: 12, lineCap: .round))

                // Progress arc - orange gradient
                Path { path in
                    path.addArc(
                        center: CGPoint(x: width / 2, y: height),
                        radius: height * 0.9,
                        startAngle: .degrees(180),
                        endAngle: .degrees(180 - (180 * progress)),
                        clockwise: true
                    )
                }
                .stroke(
                    LinearGradient(
                        colors: [AppColors.brand400, AppColors.brand500],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: 12, lineCap: .round)
                )
            }
        }
    }
}

// MARK: - Previews

#Preview("Welcome - In Review (41-11206)") {
    ApplicationStatusView(isVisualTestMode: true, forceSettingUpState: false)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Still Setting Up (41-11825)") {
    ApplicationStatusView(isVisualTestMode: true, forceSettingUpState: true)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Live Mode") {
    ApplicationStatusView(isVisualTestMode: false)
        .environment(AppCoordinator())
        .environment(AppState())
}
