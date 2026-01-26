/// ProfileView.swift
/// Flent Secured v2 - Profile Screen

import SwiftUI

struct ProfileView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = ProfileViewModel()

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            if viewModel.isLoading {
                ProgressView()
                    .tint(AppColors.accentPrimary)
            } else {
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

                        // Profile Header
                        VStack(spacing: Spacing.md) {
                            Circle()
                                .fill(AppColors.backgroundSecondary)
                                .frame(width: 80, height: 80)
                                .overlay(
                                    Image(systemName: "person.fill")
                                        .font(.system(size: 32))
                                        .foregroundColor(AppColors.textMuted)
                                )

                            Text(viewModel.fullName)
                                .font(Typography.h4)
                                .foregroundColor(AppColors.textPrimary)

                            Text(viewModel.phone)
                                .font(Typography.bodyMd2)
                                .foregroundColor(AppColors.textSecondary)

                            if !viewModel.memberSince.isEmpty {
                                Text(viewModel.memberSince)
                                    .font(Typography.caption)
                                    .foregroundColor(AppColors.textMuted)
                            }
                        }
                        .frame(maxWidth: .infinity)

                        // Account Info
                        if let address = viewModel.propertyAddress, !address.isEmpty {
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                Text("Current Tenancy")
                                    .font(Typography.label)
                                    .foregroundColor(AppColors.textMuted)

                                VStack(alignment: .leading, spacing: Spacing.xxs) {
                                    Text(address)
                                        .font(Typography.bodyMd)
                                        .foregroundColor(AppColors.textPrimary)

                                    if let rent = viewModel.monthlyRent {
                                        Text("Monthly Rent: \(rent)")
                                            .font(Typography.bodySm)
                                            .foregroundColor(AppColors.textSecondary)
                                    }
                                }
                                .padding(Spacing.md)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(AppColors.backgroundSecondary)
                                .cornerRadius(Radius.card)
                            }
                        }

                        // Menu Items
                        VStack(spacing: Spacing.sm) {
                            ProfileMenuItem(icon: "gearshape", title: "Settings") {
                                coordinator.navigate(to: .settings)
                            }

                            ProfileMenuItem(icon: "person.2", title: "Referrals") {
                                coordinator.navigate(to: .referral)
                            }

                            ProfileMenuItem(icon: "questionmark.circle", title: "Help & Support") {
                                // Open support
                            }

                            ProfileMenuItem(icon: "doc.text", title: "Terms & Privacy") {
                                // Show terms
                            }
                        }

                        Spacer()
                            .frame(height: Spacing.lg)

                        // Logout Button
                        SecondaryButton(
                            title: viewModel.isLoggingOut ? "Logging out..." : "Log Out"
                        ) {
                            Task {
                                let success = await viewModel.logout()
                                if success {
                                    appState.clearSession()
                                    coordinator.popToRoot()
                                }
                            }
                        }

                        // Version
                        Text(viewModel.appVersion)
                            .font(Typography.caption)
                            .foregroundColor(AppColors.textMuted)
                            .frame(maxWidth: .infinity)
                    }
                    .screenPadding()
                    .padding(.top, Spacing.xl)
                }
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadProfile()
        }
    }
}

// MARK: - Profile Menu Item

struct ProfileMenuItem: View {
    let icon: String
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.textSecondary)
                    .frame(width: 32)

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
            .cornerRadius(Radius.sm)
        }
    }
}

#Preview {
    ProfileView()
        .environment(AppCoordinator())
        .environment(AppState())
}
