/// InviteLandlordView.swift
/// Flent Secured v2 - Invite Landlord Screen
///
/// Sends invite to landlord for approval
///
/// Figma: Setup / Invite Landlord screens

import SwiftUI

struct InviteLandlordView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel: InviteLandlordViewModel
    @State private var showShareSheet = false

    init() {
        self._viewModel = State(initialValue: InviteLandlordViewModel(tenancyId: ""))
    }

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            ScrollView {
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
        }
        .navigationBarHidden(true)
        .onAppear {
            if let tenancyId = appState.currentTenancy?.id {
                viewModel = InviteLandlordViewModel(tenancyId: tenancyId)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.isSent)
        .sheet(isPresented: $showShareSheet) {
            if let url = viewModel.shareInviteLink() {
                ShareSheet(items: [url])
            }
        }
    }

    // MARK: - Form Content

    private var inviteFormContent: some View {
        VStack(alignment: .leading, spacing: Spacing.xl) {
            // Header
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Invite your landlord")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text("Choose how to send the approval request")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
            }

            // Channel Selection
            VStack(alignment: .leading, spacing: Spacing.md) {
                Text("Send via")
                    .font(Typography.label)
                    .foregroundColor(AppColors.textSecondary)

                VStack(spacing: Spacing.sm) {
                    channelOption(
                        channel: .sms,
                        title: "SMS",
                        subtitle: "Send via text message",
                        icon: "message.fill"
                    )

                    channelOption(
                        channel: .whatsapp,
                        title: "WhatsApp",
                        subtitle: "Send via WhatsApp",
                        icon: "bubble.left.fill"
                    )
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
                .frame(height: Spacing.xl)

            // Send Invite Button
            PrimaryButton(
                title: "Send Invite",
                isLoading: viewModel.isSending,
                isEnabled: viewModel.canSend
            ) {
                sendInvite()
            }

            // Info
            HStack(alignment: .top, spacing: Spacing.xs) {
                Image(systemName: "info.circle")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textMuted)

                Text("We'll send them a link to approve your tenancy. You can also share the link manually after sending.")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
            }
        }
    }

    private func channelOption(channel: InviteChannel, title: String, subtitle: String, icon: String) -> some View {
        Button {
            viewModel.selectedChannel = channel
        } label: {
            HStack(spacing: Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(viewModel.selectedChannel == channel ? AppColors.accentPrimary : AppColors.textMuted)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text(title)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text(subtitle)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textSecondary)
                }

                Spacer()

                Image(systemName: viewModel.selectedChannel == channel ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundColor(viewModel.selectedChannel == channel ? AppColors.accentPrimary : AppColors.border)
            }
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(viewModel.selectedChannel == channel ? AppColors.accentPrimary : AppColors.border, lineWidth: viewModel.selectedChannel == channel ? 2 : 1)
            )
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.md)
        }
        .buttonStyle(PlainButtonStyle())
    }

    // MARK: - Sent Content

    private var inviteSentContent: some View {
        VStack(spacing: Spacing.xl) {
            Spacer()
                .frame(height: Spacing.xxl)

            VStack(spacing: Spacing.lg) {
                Image(systemName: "paperplane.circle.fill")
                    .font(.system(size: 80))
                    .foregroundColor(AppColors.success)

                VStack(spacing: Spacing.sm) {
                    Text("Invite sent!")
                        .font(Typography.h4)
                        .foregroundColor(AppColors.textPrimary)

                    Text("We'll notify you when your landlord approves")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }

            // Invite Details
            if let result = viewModel.inviteResult {
                VStack(spacing: Spacing.md) {
                    // Sent via
                    if !result.sentVia.isEmpty {
                        HStack {
                            Text("Sent via")
                                .font(Typography.bodySm)
                                .foregroundColor(AppColors.textMuted)
                            Spacer()
                            Text(result.sentVia.capitalized)
                                .font(Typography.bodySmMedium)
                                .foregroundColor(AppColors.textPrimary)
                        }
                    }

                    // Expires
                    if let expiresIn = viewModel.inviteExpiresIn {
                        HStack {
                            Text("Expires")
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

            Spacer()

            // Actions
            VStack(spacing: Spacing.md) {
                PrimaryButton(title: "Continue") {
                    coordinator.pop()
                }

                HStack(spacing: Spacing.md) {
                    SecondaryButton(title: "Share Link") {
                        showShareSheet = true
                    }

                    SecondaryButton(title: "Copy Link") {
                        viewModel.copyInviteLink()
                        // TODO: Show toast "Link copied"
                    }
                }

                TextButton(title: "Resend invite") {
                    Task {
                        await viewModel.resendInvite()
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func sendInvite() {
        Task {
            _ = await viewModel.sendInvite()
        }
    }
}

// MARK: - Share Sheet

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    InviteLandlordView()
        .environment(AppCoordinator())
        .environment(AppState())
}
