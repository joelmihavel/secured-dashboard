/// SettingsView.swift
/// Flent Secured v2 - Settings Screen
///
/// Manages app settings and preferences with persistent storage

import SwiftUI

struct SettingsView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel = SettingsViewModel()

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
                }

                // Header
                Text("Settings")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                // Settings Sections
                ScrollView {
                    VStack(spacing: Spacing.lg) {
                        // Notifications Section
                        settingsSection(title: "Notifications") {
                            SettingsToggle(
                                title: "Push Notifications",
                                isOn: $viewModel.settings.pushNotificationsEnabled
                            ) {
                                Task {
                                    await viewModel.togglePushNotifications()
                                }
                            }

                            SettingsToggle(
                                title: "Payment Reminders",
                                isOn: $viewModel.settings.paymentReminders
                            ) {
                                viewModel.togglePaymentReminders()
                            }

                            SettingsToggle(
                                title: "Marketing Updates",
                                isOn: $viewModel.settings.marketingEmails
                            ) {
                                viewModel.toggleMarketingEmails()
                            }
                        }

                        // Security Section
                        settingsSection(title: "Security") {
                            SettingsToggle(
                                title: "Biometric Login",
                                subtitle: "Use Face ID or Touch ID to log in",
                                isOn: $viewModel.settings.biometricLoginEnabled
                            ) {
                                Task {
                                    await viewModel.toggleBiometricLogin()
                                }
                            }
                        }

                        // Payments Section
                        settingsSection(title: "Payments") {
                            SettingsToggle(
                                title: "Auto-pay",
                                subtitle: "Automatically pay rent on due date",
                                isOn: $viewModel.settings.autoPayEnabled
                            ) {
                                viewModel.toggleAutoPay()
                            }
                        }

                        // About Section
                        settingsSection(title: "About") {
                            SettingsRow(title: "Privacy Policy") {
                                // Open privacy policy
                            }

                            SettingsRow(title: "Terms of Service") {
                                // Open terms
                            }

                            SettingsRow(title: "Open Source Licenses") {
                                // Open licenses
                            }
                        }
                    }
                }

                Spacer()

                // Version
                Text(viewModel.appVersion)
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
                    .frame(maxWidth: .infinity)
            }
            .screenPadding()
            .padding(.top, Spacing.xl)
        }
        .navigationBarHidden(true)
        .alert("Error", isPresented: .init(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.clearError() } }
        )) {
            Button("OK") {
                viewModel.clearError()
            }
        } message: {
            if let message = viewModel.errorMessage {
                Text(message)
            }
        }
    }

    @ViewBuilder
    private func settingsSection(title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title)
                .font(Typography.label)
                .foregroundColor(AppColors.textMuted)

            VStack(spacing: 1) {
                content()
            }
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.card)
        }
    }
}

// MARK: - Settings Toggle

struct SettingsToggle: View {
    let title: String
    var subtitle: String? = nil
    @Binding var isOn: Bool
    var action: (() -> Void)? = nil

    var body: some View {
        Button {
            action?()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text(title)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textSecondary)
                    }
                }

                Spacer()

                Toggle("", isOn: $isOn)
                    .labelsHidden()
                    .tint(AppColors.accentPrimary)
                    .allowsHitTesting(false)
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Settings Row

struct SettingsRow: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.textPrimary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textMuted)
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    SettingsView()
        .environment(AppCoordinator())
}
