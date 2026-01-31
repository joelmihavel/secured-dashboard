/// InviteLandlordView.swift
/// Flent Secured v2 - Invite Landlord Screen
///
/// Figma Node ID: 1:34150 - onboarding / Invite Landlord
///
/// Design Specifications:
/// - Header: "Invite your landlord" (28px light)
/// - Subtitle: "They need to approve your tenancy" (14px regular)
/// - Landlord info card: black500 background, black400 border
/// - Channel selection: SMS/WhatsApp radio buttons
/// - Success state with share options
/// - Info note at bottom
///
/// Sends invite to landlord for approval

import SwiftUI

// Type alias for result
typealias InviteResult = LandlordInviteResult

struct InviteLandlordView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel: InviteLandlordViewModel
    @State private var showShareSheet = false
    @State private var showCopiedToast = false

    init() {
        self._viewModel = State(initialValue: InviteLandlordViewModel(tenancyId: ""))
    }

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            DottedGridPattern()
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.xl) {
                    // Back Button
                    Button {
                        coordinator.pop()
                    } label: {
                        Image(systemName: "arrow.left")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(AppColors.textPrimary)
                    }

                    if viewModel.isSent {
                        inviteSentContent
                    } else {
                        inviteFormContent
                    }
                }
                .screenPadding()
                .padding(.top, Spacing.xl)
            }

            // Copied Toast
            if showCopiedToast {
                VStack {
                    Spacer()
                    CopiedToastView(message: "Link copied to clipboard", icon: "doc.on.doc")
                        .padding(.bottom, 100)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .navigationBarHidden(true)
        .onAppear {
            if let tenancyId = appState.currentTenancy?.id {
                viewModel = InviteLandlordViewModel(tenancyId: tenancyId)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: viewModel.isSent)
        .animation(.easeInOut(duration: 0.2), value: showCopiedToast)
        .sheet(isPresented: $showShareSheet) {
            if let url = viewModel.shareInviteLink() {
                ShareSheet(items: [url])
            }
        }
    }

    // MARK: - Form Content

    private var inviteFormContent: some View {
        VStack(alignment: .leading, spacing: Spacing.xl) {
            // Header - Figma: node_1-34150
            VStack(alignment: .leading, spacing: Spacing.md) {
                // Title - H1 style
                VStack(alignment: .leading, spacing: 0) {
                    Text("One last step")
                        .foregroundColor(AppColors.neutral500)
                    Text("we promise")
                        .foregroundColor(AppColors.brand500)
                }
                .font(Typography.h1)
                .tracking(-2)
                .lineSpacing(16)

                Text("Invite your landlord to Secured to activate your cashback.")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
            }

            // Landlord Info Card (from agreement)
            if let landlordName = appState.currentTenancy?.landlordName {
                landlordInfoCard(name: landlordName, phone: appState.currentTenancy?.landlordPhone ?? "")
            }

            // Channel Selection
            VStack(alignment: .leading, spacing: Spacing.md) {
                Text("Send invite via")
                    .font(Typography.label)
                    .foregroundColor(AppColors.textSecondary)

                VStack(spacing: Spacing.sm) {
                    ChannelOptionCard(
                        channel: .sms,
                        title: "SMS",
                        subtitle: "Text message",
                        icon: "message.fill",
                        isSelected: viewModel.selectedChannel == .sms
                    ) {
                        viewModel.selectedChannel = .sms
                    }

                    ChannelOptionCard(
                        channel: .whatsapp,
                        title: "WhatsApp",
                        subtitle: "WhatsApp message",
                        icon: "bubble.left.fill",
                        isSelected: viewModel.selectedChannel == .whatsapp
                    ) {
                        viewModel.selectedChannel = .whatsapp
                    }
                }
            }

            // Error Message
            if let error = viewModel.errorMessage {
                errorBanner(message: error)
            }

            Spacer()
                .frame(height: Spacing.lg)

            // Send Invite Button
            PrimaryButton(
                title: "Send Invite",
                isLoading: viewModel.isSending,
                isEnabled: viewModel.canSend
            ) {
                sendInvite()
            }

            // Info Note
            HStack(alignment: .top, spacing: Spacing.xs) {
                Image(systemName: "info.circle")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textMuted)

                Text("Your landlord will receive a unique link to verify and approve your tenancy. The link expires in 7 days.")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
            }
        }
    }

    // MARK: - Landlord Info Card

    private func landlordInfoCard(name: String, phone: String) -> some View {
        HStack(spacing: Spacing.md) {
            // Avatar
            ZStack {
                Circle()
                    .fill(AppColors.brand500.opacity(0.1))
                    .frame(width: 48, height: 48)

                Image(systemName: "person.fill")
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.brand500)
            }

            // Info
            VStack(alignment: .leading, spacing: Spacing.xxxs) {
                Text("Landlord")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)

                Text(name)
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.textPrimary)

                if !phone.isEmpty {
                    Text(formatPhone(phone))
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textSecondary)
                }
            }

            Spacer()

            // Verified indicator
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 20))
                .foregroundColor(AppColors.success)
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.black400, lineWidth: 1)
        )
    }

    // MARK: - Error Banner

    private func errorBanner(message: String) -> some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(AppColors.error)
            Text(message)
                .font(Typography.bodySm)
                .foregroundColor(AppColors.error)
        }
        .padding(Spacing.sm)
        .background(AppColors.error.opacity(0.1))
        .cornerRadius(Radius.sm)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.sm)
                .stroke(AppColors.error.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Sent Content

    private var inviteSentContent: some View {
        VStack(spacing: Spacing.xl) {
            Spacer()
                .frame(height: Spacing.xxl)

            // Success Icon with animation
            ZStack {
                // Outer rings
                ForEach(0..<2, id: \.self) { index in
                    Circle()
                        .stroke(AppColors.success.opacity(0.1 - Double(index) * 0.03), lineWidth: 2)
                        .frame(width: 120 + CGFloat(index * 20), height: 120 + CGFloat(index * 20))
                }

                // Main icon
                ZStack {
                    Circle()
                        .fill(AppColors.success.opacity(0.1))
                        .frame(width: 100, height: 100)

                    Image(systemName: "paperplane.circle.fill")
                        .font(.system(size: 60))
                        .foregroundColor(AppColors.success)
                }
            }

            VStack(spacing: Spacing.sm) {
                Text("Invite sent!")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text("We'll notify you when your landlord approves")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            // Invite Details Card
            if let result = viewModel.inviteResult {
                inviteDetailsCard(result: result)
            }

            Spacer()

            // Action Buttons
            VStack(spacing: Spacing.md) {
                PrimaryButton(title: "Continue") {
                    coordinator.pop()
                }

                HStack(spacing: Spacing.sm) {
                    // Share Button
                    Button {
                        showShareSheet = true
                    } label: {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 16))
                            Text("Share Link")
                                .font(Typography.buttonSmall)
                        }
                        .foregroundColor(AppColors.accentPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.sm)
                                .stroke(AppColors.accentPrimary, lineWidth: 1.5)
                        )
                    }

                    // Copy Button
                    Button {
                        viewModel.copyInviteLink()
                        showCopiedToast = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            showCopiedToast = false
                        }
                    } label: {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 16))
                            Text("Copy Link")
                                .font(Typography.buttonSmall)
                        }
                        .foregroundColor(AppColors.accentPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.sm)
                                .stroke(AppColors.accentPrimary, lineWidth: 1.5)
                        )
                    }
                }

                // Resend option
                Button {
                    Task {
                        await viewModel.resendInvite()
                    }
                } label: {
                    Text("Resend invite")
                        .font(Typography.bodySmMedium)
                        .foregroundColor(AppColors.textSecondary)
                }
            }
        }
    }

    // MARK: - Invite Details Card

    private func inviteDetailsCard(result: InviteResult) -> some View {
        VStack(spacing: Spacing.sm) {
            // Sent via
            if !result.sentVia.isEmpty {
                HStack {
                    Text("Sent via")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                    Spacer()
                    HStack(spacing: Spacing.xxs) {
                        Image(systemName: result.sentVia == "sms" ? "message.fill" : "bubble.left.fill")
                            .font(.system(size: 12))
                        Text(result.sentVia.uppercased())
                            .font(Typography.bodySmMedium)
                    }
                    .foregroundColor(AppColors.textPrimary)
                }
            }

            Divider()
                .background(AppColors.black400)

            // Expires
            if let expiresIn = viewModel.inviteExpiresIn {
                HStack {
                    Text("Expires in")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                    Spacer()
                    Text(expiresIn)
                        .font(Typography.bodySmMedium)
                        .foregroundColor(AppColors.textPrimary)
                }
            }
        }
        .padding(Spacing.md)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.md)
    }

    // MARK: - Actions

    private func sendInvite() {
        Task {
            _ = await viewModel.sendInvite()
        }
    }

    // MARK: - Helpers

    private func formatPhone(_ phone: String) -> String {
        if phone.hasPrefix("+91") {
            let digits = String(phone.dropFirst(3))
            if digits.count == 10 {
                return "+91 \(digits.prefix(5)) \(digits.suffix(5))"
            }
        }
        return phone
    }
}

// MARK: - Channel Option Card

private struct ChannelOptionCard: View {
    let channel: InviteChannel
    let title: String
    let subtitle: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            action()
        }) {
            HStack(spacing: Spacing.md) {
                // Icon
                ZStack {
                    Circle()
                        .fill(isSelected ? AppColors.accentPrimary.opacity(0.1) : AppColors.backgroundSecondary)
                        .frame(width: 44, height: 44)

                    Image(systemName: icon)
                        .font(.system(size: 18))
                        .foregroundColor(isSelected ? AppColors.accentPrimary : AppColors.textMuted)
                }

                // Text
                VStack(alignment: .leading, spacing: Spacing.xxxs) {
                    Text(title)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text(subtitle)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textSecondary)
                }

                Spacer()

                // Radio indicator
                ZStack {
                    Circle()
                        .stroke(isSelected ? AppColors.accentPrimary : AppColors.border, lineWidth: 2)
                        .frame(width: 22, height: 22)

                    if isSelected {
                        Circle()
                            .fill(AppColors.accentPrimary)
                            .frame(width: 12, height: 12)
                    }
                }
            }
            .padding(Spacing.md)
            .background(isSelected ? AppColors.accentPrimary.opacity(0.05) : AppColors.backgroundSecondary)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(isSelected ? AppColors.accentPrimary : AppColors.border, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Copied Toast View

private struct CopiedToastView: View {
    let message: String
    let icon: String

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(AppColors.success)

            Text(message)
                .font(Typography.bodySmMedium)
                .foregroundColor(AppColors.textPrimary)
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, Spacing.md)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.pill)
        .shadow(color: Color.black.opacity(0.2), radius: 10, x: 0, y: 5)
    }
}

// MARK: - Previews

#Preview("Form") {
    InviteLandlordView()
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Sent") {
    InviteLandlordView()
        .environment(AppCoordinator())
        .environment(AppState())
}
