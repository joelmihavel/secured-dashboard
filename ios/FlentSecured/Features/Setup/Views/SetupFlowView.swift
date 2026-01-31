/// SetupFlowView.swift
/// Flent Secured v2 - Post-Agreement Setup Flow Screen
///
/// Figma Screens:
/// - 41-10712: Add landlord's bank details - "Let's get you set up" + bank details card
/// - 41-10859: Upload address proof - "Let's get you set up" + address proof card
/// - 41-11006: Invite landlord - "Let's get you set up" + invite landlord card
/// - 41-4969: Waiting for landlord response - "Send Reminder" button
/// - 41-5587: Landlord declined - "Contact support" button
///
/// Design Specifications:
/// - Background: #131313 (black700) with dotted grid pattern
/// - F Logo background: Top right, opacity 0.4
/// - Title: "Let's get" (neutral500) + "you set up" (brand500) - H1 style
/// - Card: Notebook-style with perforated edge and paperclip decoration
/// - Card background: #202020 (black500)
/// - Page dots: Orange (active), gray (inactive)
/// - Button: "Start Flenting" with arrow

import SwiftUI

struct SetupFlowView: View {
    // MARK: - Environment
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    // MARK: - State
    @State private var viewModel = SetupFlowViewModel()
    @State private var showReminderSentToast = false
    @State private var showContactSupport = false

    // MARK: - Preview Mode
    var isPreviewMode: Bool = false
    var previewViewModel: SetupFlowViewModel?

    private var activeViewModel: SetupFlowViewModel {
        previewViewModel ?? viewModel
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background
            backgroundLayer

            // Content
            VStack(spacing: 0) {
                // Top spacing
                Spacer()
                    .frame(height: Spacing.xxl)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Spacing.xxl) {
                        // Logo
                        FlentLogo(size: 32)

                        // Title Section
                        titleSection

                        // Setup Card - changes based on landlord status
                        setupCard

                        // Page Dots (only show for setup steps, not landlord status)
                        if !activeViewModel.showLandlordStatusCard {
                            pageDots
                        }
                    }
                    .padding(.horizontal, Spacing.screenHorizontal)
                }

                Spacer()

                // Bottom Button - changes based on landlord status
                bottomButton
                    .padding(.horizontal, Spacing.screenHorizontal)
                    .padding(.bottom, Spacing.lg)
            }

            // Toast for reminder sent
            if showReminderSentToast {
                VStack {
                    Spacer()
                    reminderSentToast
                        .padding(.bottom, 120)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .navigationBarHidden(true)
        .task {
            if !isPreviewMode {
                await viewModel.loadStatus()
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .animation(.easeInOut(duration: 0.3), value: activeViewModel.landlordStatus)
        .animation(.easeInOut(duration: 0.2), value: showReminderSentToast)
        .sheet(isPresented: $showContactSupport) {
            ContactSupportSheet()
        }
    }

    // MARK: - Background Layer

    private var backgroundLayer: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            // F Logo background (top right, partially visible)
            GeometryReader { proxy in
                FlentLogo(size: 300)
                    .opacity(0.03)
                    .position(x: proxy.size.width - 50, y: 180)
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)
        }
    }

    // MARK: - Title Section

    private var titleSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(titleFirstLine)
                .foregroundColor(AppColors.neutral500)
            Text(titleSecondLine)
                .foregroundColor(AppColors.brand500)
        }
        .font(Typography.h1)
        .tracking(-2)
    }

    /// Dynamic title based on state
    private var titleFirstLine: String {
        switch activeViewModel.landlordStatus {
        case .pending:
            return "Waiting for"
        case .declined:
            return "Landlord"
        default:
            return "Let's get"
        }
    }

    private var titleSecondLine: String {
        switch activeViewModel.landlordStatus {
        case .pending:
            return "landlord"
        case .declined:
            return "declined"
        default:
            return "you set up"
        }
    }

    // MARK: - Setup Card

    private var setupCard: some View {
        ZStack(alignment: .topLeading) {
            // Card content based on current step or landlord status
            cardContent
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(notebookCardBackground)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))

            // Paperclip decoration (top left, offset outside card)
            paperclipDecoration
                .offset(x: -14, y: -8)
        }
    }

    // MARK: - Card Content

    @ViewBuilder
    private var cardContent: some View {
        switch activeViewModel.landlordStatus {
        case .pending(let canResend, let daysSinceSent):
            // Figma 41-4969: Waiting for landlord response
            waitingForLandlordCard(canResend: canResend, daysSinceSent: daysSinceSent)

        case .declined:
            // Figma 41-5587: Landlord declined
            landlordDeclinedCard

        default:
            // Standard setup step card
            standardSetupCard
        }
    }

    // MARK: - Standard Setup Card (Steps 1-3)

    /// Figma: Card shows multi-color text layout:
    /// - Title (orange/brand500): "Add your landlord's\nbank details" or "Upload\naddress proof"
    /// - Connector (white): "to"
    /// - Subtitle (gray/neutral500): "enable payouts" or "verify your tenancy"
    private var standardSetupCard: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Flent Logo inside card - Figma: 28pt
            FlentLogo(size: 28)

            // Step content with multi-color text per Figma
            VStack(alignment: .leading, spacing: 0) {
                // Title in orange (brand500)
                Text(activeViewModel.currentStep.title)
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.brand500)

                // Connector "to" in white + subtitle in gray
                // Figma shows: "to" (white) + space + subtitle (gray)
                HStack(spacing: 4) {
                    Text(activeViewModel.currentStep.connector)
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.textPrimary)

                    Text(activeViewModel.currentStep.subtitle)
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.neutral500)
                }
            }
        }
        .padding(Spacing.lg)
        .padding(.vertical, Spacing.md)
    }


    // MARK: - Waiting for Landlord Card (41-4969)

    private func waitingForLandlordCard(canResend: Bool, daysSinceSent: Int) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Flent Logo inside card
            FlentLogo(size: 28)

            // Status icon with animation
            HStack(spacing: Spacing.md) {
                ZStack {
                    Circle()
                        .fill(AppColors.warning.opacity(0.15))
                        .frame(width: 48, height: 48)

                    Image(systemName: "clock.fill")
                        .font(.system(size: 22))
                        .foregroundColor(AppColors.warning)
                }

                VStack(alignment: .leading, spacing: Spacing.xxxs) {
                    Text("Invite sent")
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text(waitingDescription(daysSinceSent: daysSinceSent))
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                }
            }

            // Info message
            HStack(alignment: .top, spacing: Spacing.xs) {
                Image(systemName: "info.circle")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textMuted)

                Text("Your landlord needs to approve your tenancy to activate cashback rewards.")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textMuted)
            }
            .padding(.top, Spacing.xs)

            // Resend availability indicator
            if !canResend {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "hourglass")
                        .font(.system(size: 12))
                        .foregroundColor(AppColors.neutral500)

                    Text("You can resend in 24 hours")
                        .font(Typography.caption)
                        .foregroundColor(AppColors.neutral500)
                }
                .padding(.top, Spacing.xxs)
            }
        }
        .padding(Spacing.lg)
        .padding(.vertical, Spacing.sm)
    }

    private func waitingDescription(daysSinceSent: Int) -> String {
        if daysSinceSent == 0 {
            return "Sent today"
        } else if daysSinceSent == 1 {
            return "Sent yesterday"
        } else {
            return "Sent \(daysSinceSent) days ago"
        }
    }

    // MARK: - Landlord Declined Card (41-5587)

    private var landlordDeclinedCard: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Flent Logo inside card
            FlentLogo(size: 28)

            // Status icon
            HStack(spacing: Spacing.md) {
                ZStack {
                    Circle()
                        .fill(AppColors.error.opacity(0.15))
                        .frame(width: 48, height: 48)

                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(AppColors.error)
                }

                VStack(alignment: .leading, spacing: Spacing.xxxs) {
                    Text("Landlord declined")
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text("Your tenancy was not approved")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                }
            }

            // Info message
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("This may happen if:")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textMuted)

                VStack(alignment: .leading, spacing: Spacing.xs) {
                    declinedReasonRow("The tenancy details don't match")
                    declinedReasonRow("The landlord doesn't recognize you")
                    declinedReasonRow("The phone number is incorrect")
                }
            }
            .padding(.top, Spacing.xs)
        }
        .padding(Spacing.lg)
        .padding(.vertical, Spacing.sm)
    }

    private func declinedReasonRow(_ text: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.xs) {
            Circle()
                .fill(AppColors.textMuted)
                .frame(width: 4, height: 4)
                .padding(.top, 6)

            Text(text)
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textMuted)
        }
    }

    // MARK: - Notebook Card Background

    private var notebookCardBackground: some View {
        ZStack(alignment: .top) {
            // Main background
            AppColors.black500

            // Perforated edge decoration (top)
            HStack(spacing: 8) {
                ForEach(0..<20, id: \.self) { _ in
                    Circle()
                        .fill(AppColors.backgroundPrimary)
                        .frame(width: 6, height: 6)
                }
            }
            .padding(.top, 8)
            .opacity(0.5)
        }
    }

    // MARK: - Paperclip Decoration

    private var paperclipDecoration: some View {
        Image(systemName: "paperclip")
            .font(.system(size: 32, weight: .thin))
            .foregroundColor(AppColors.black300.opacity(0.5))
            .rotationEffect(.degrees(-45))
    }

    // MARK: - Page Dots

    /// Figma: 3 dots, 6x6pt, spacing ~6pt, centered below card
    /// Active dot: brand500 (orange), Inactive: black400 (dark gray)
    private var pageDots: some View {
        HStack(spacing: 6) {
            ForEach(SetupFlowViewModel.SetupStep.allCases) { step in
                Circle()
                    .fill(dotColor(for: step))
                    .frame(width: 6, height: 6)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.sm)
    }

    private func dotColor(for step: SetupFlowViewModel.SetupStep) -> Color {
        if activeViewModel.completedSteps.contains(step) {
            // Completed: could show success or brand500
            return AppColors.brand500
        } else if step == activeViewModel.currentStep {
            // Current: orange (brand500)
            return AppColors.brand500
        } else {
            // Future: dark gray
            return AppColors.black400
        }
    }

    // MARK: - Bottom Button

    @ViewBuilder
    private var bottomButton: some View {
        switch activeViewModel.landlordStatus {
        case .pending(let canResend, _):
            // Figma 41-4969: "Send Reminder" button
            VStack(spacing: Spacing.md) {
                PrimaryButton(
                    title: "Send Reminder",
                    icon: "bell.fill",
                    isLoading: activeViewModel.isSendingReminder,
                    isEnabled: canResend
                ) {
                    sendReminder()
                }

                // Secondary action - Continue to Home
                Button {
                    coordinator.navigate(to: .home(state: .zeroState))
                } label: {
                    Text("Continue to Home")
                        .font(Typography.bodyMd2Medium)
                        .foregroundColor(AppColors.textSecondary)
                }
            }

        case .declined:
            // Figma 41-5587: "Contact Support" button
            VStack(spacing: Spacing.md) {
                PrimaryButton(
                    title: "Contact Support",
                    icon: "headphones"
                ) {
                    showContactSupport = true
                }

                // Secondary action - Try Again
                Button {
                    coordinator.navigate(to: .inviteLandlord)
                } label: {
                    Text("Try with different details")
                        .font(Typography.bodyMd2Medium)
                        .foregroundColor(AppColors.brand500)
                }
            }

        default:
            // Standard setup button
            PrimaryButton(
                title: activeViewModel.currentStep.buttonTitle,
                icon: "arrow.right",
                isLoading: activeViewModel.isLoading
            ) {
                handleButtonTap()
            }
        }
    }

    // MARK: - Reminder Sent Toast

    private var reminderSentToast: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 16))
                .foregroundColor(AppColors.success)

            Text("Reminder sent successfully")
                .font(Typography.bodySmMedium)
                .foregroundColor(AppColors.textPrimary)
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, Spacing.md)
        .background(AppColors.backgroundSecondary)
        .clipShape(Capsule())
        .shadow(color: Color.black.opacity(0.2), radius: 10, x: 0, y: 5)
    }

    // MARK: - Actions

    private func handleButtonTap() {
        coordinator.navigate(to: activeViewModel.currentStep.route)
    }

    private func sendReminder() {
        Task {
            let success = await viewModel.sendReminder()
            if success {
                showReminderSentToast = true
                // Hide toast after 2 seconds
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    showReminderSentToast = false
                }
            }
        }
    }
}

// MARK: - Contact Support Sheet

private struct ContactSupportSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: Spacing.xl) {
                // Icon
                ZStack {
                    Circle()
                        .fill(AppColors.brand500.opacity(0.1))
                        .frame(width: 80, height: 80)

                    Image(systemName: "headphones")
                        .font(.system(size: 36))
                        .foregroundColor(AppColors.brand500)
                }

                // Title
                Text("Get Help")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                // Description
                Text("Our support team is here to help resolve your tenancy verification issue.")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.lg)

                Spacer()

                // Contact Options
                VStack(spacing: Spacing.md) {
                    // Email Support
                    supportOptionButton(
                        icon: "envelope.fill",
                        title: "Email Support",
                        subtitle: "support@flent.in"
                    ) {
                        if let url = URL(string: "mailto:support@flent.in?subject=Landlord%20Verification%20Issue") {
                            UIApplication.shared.open(url)
                        }
                    }

                    // WhatsApp Support
                    supportOptionButton(
                        icon: "bubble.left.fill",
                        title: "WhatsApp",
                        subtitle: "+91 98765 43210"
                    ) {
                        if let url = URL(string: "https://wa.me/919876543210?text=Hi,%20I%20need%20help%20with%20landlord%20verification") {
                            UIApplication.shared.open(url)
                        }
                    }
                }
                .padding(.horizontal, Spacing.lg)

                Spacer()
            }
            .padding(.top, Spacing.xl)
            .background(AppColors.backgroundPrimary)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(AppColors.brand500)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    private func supportOptionButton(
        icon: String,
        title: String,
        subtitle: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.md) {
                ZStack {
                    Circle()
                        .fill(AppColors.backgroundSecondary)
                        .frame(width: 48, height: 48)

                    Image(systemName: icon)
                        .font(.system(size: 20))
                        .foregroundColor(AppColors.brand500)
                }

                VStack(alignment: .leading, spacing: Spacing.xxxs) {
                    Text(title)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text(subtitle)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textMuted)
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        }
    }
}

// MARK: - Previews

#Preview("Step 1 - Bank Details") {
    SetupFlowView(isPreviewMode: true, previewViewModel: .preview)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Step 2 - Address Proof") {
    SetupFlowView(isPreviewMode: true, previewViewModel: .previewStep2)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Step 3 - Invite Landlord") {
    SetupFlowView(isPreviewMode: true, previewViewModel: .previewStep3)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Waiting for Landlord (41-4969)") {
    SetupFlowView(isPreviewMode: true, previewViewModel: .previewWaitingLandlord)
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Landlord Declined (41-5587)") {
    SetupFlowView(isPreviewMode: true, previewViewModel: .previewLandlordDeclined)
        .environment(AppCoordinator())
        .environment(AppState())
}

// MARK: - Setup Flow State View

/// Wrapper view for launching SetupFlowView with a specific initial state
/// Used by ScreenLauncher for testing specific states
struct SetupFlowStateView: View {
    let initialState: SetupFlowState

    var body: some View {
        SetupFlowView(
            isPreviewMode: true,
            previewViewModel: .previewFromState(initialState)
        )
    }
}
