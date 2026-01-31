/// ProfileView.swift
/// Flent Secured v2 - Profile Screen
///
/// Figma Node IDs:
/// - 41:8760 - My Profile / Main Screen
/// - 41:8450 - My Profile / Payment --UPI
/// - 41:8880 - My Profile / Secured Account Section
///
/// PIXEL PERFECT from Figma (41:8760):
/// - Background: #131313 (no dotted grid on profile)
/// - Header: 48px light weight
///   - "My" - White (#FFFFFF)
///   - "Profile" - Brand (#FF9A6D)
/// - Horizontal padding: 24pt (sp-24) for main app screens
/// - Section: YOUR PAYMENT HISTORY with bar chart
/// - Section: SECURED ACCOUNT with avatar row
/// - Section: PAYMENT INFORMATION
/// - Section: SUPPORT
/// - Section: APP with Sign Out and Delete Account
/// - Section headers: 10px semibold, neutral500, letter-spacing 0.5
/// - Cards: black600 background (#1A1A1A), no border
/// - Menu items: Icon (brand500) + Title (white) + Chevron (brand500)

import SwiftUI

struct ProfileView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = ProfileViewModel()
    @State private var showDeleteConfirmation = false
    @State private var showLogoutConfirmation = false

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            if viewModel.isLoading {
                LoadingContent()
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        // Header with back button
                        headerSection

                        // Payment History Chart (Figma: 41:8760 - YOUR PAYMENT HISTORY)
                        PaymentHistoryGraphView(
                            monthsData: viewModel.paymentHistory,
                            onTimeCount: viewModel.onTimePayments,
                            lateCount: viewModel.latePayments
                        )

                        // SECURED ACCOUNT Section (Figma: 41:8880)
                        securedAccountSection

                        // PAYMENT INFORMATION Section
                        paymentInformationSection

                        // SUPPORT Section
                        supportSection

                        // APP Section
                        appSection

                        // Version Footer
                        versionFooter

                        Spacer()
                            .frame(height: Spacing.xl)
                    }
                    .padding(.horizontal, Spacing.lg) // 24pt horizontal (sp-24) per Figma
                }
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadProfile()
        }
        .alert("Log Out", isPresented: $showLogoutConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Log Out", role: .destructive) {
                performLogout()
            }
        } message: {
            Text("Are you sure you want to log out?")
        }
        .alert("Delete Account", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                // TODO: Implement account deletion
            }
        } message: {
            Text("This action cannot be undone. All your data will be permanently deleted.")
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Back Button - Figma: 24x24 arrow
            Button {
                coordinator.pop()
            } label: {
                Image(systemName: "arrow.left")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 24, height: 24)
            }
            .padding(.top, Spacing.md)

            // Title - Figma: 48px light weight, two-color format
            VStack(alignment: .leading, spacing: 0) {
                Text("My")
                    .font(.system(size: 48, weight: .light))
                    .foregroundColor(.white)
                Text("Profile")
                    .font(.system(size: 48, weight: .light))
                    .foregroundColor(AppColors.brand500) // #FF9A6D
            }
        }
    }

    // MARK: - Secured Account Section
    // Figma 41:8760: Shows avatar row with name + timestamp, then View Agreement

    private var securedAccountSection: some View {
        ProfileMenuSection(title: "SECURED ACCOUNT") {
            // Avatar Row - Figma: Shows user avatar, name, and timestamp
            ProfileAvatarRow(
                name: viewModel.userName,
                timestamp: viewModel.lastLoginTime
            ) {
                coordinator.navigate(to: .personalDetails)
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "doc.text.fill",
                title: "View Agreement"
            ) {
                coordinator.navigate(to: .agreementDetails)
            }
        }
    }

    // MARK: - Payment Information Section
    // Figma 41:8760: Edit UPI Method, Edit Credit Card, Edit Bank Account

    private var paymentInformationSection: some View {
        ProfileMenuSection(title: "PAYMENT INFORMATION") {
            ProfileMenuItem(
                icon: "indianrupeesign.circle.fill",
                title: "Edit UPI Method"
            ) {
                coordinator.navigate(to: .editUPI)
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "creditcard.fill",
                title: "Edit Credit Card"
            ) {
                coordinator.navigate(to: .editCreditCard)
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "building.columns.fill",
                title: "Edit Bank Account"
            ) {
                coordinator.navigate(to: .landlordBankAccount)
            }
        }
    }

    // MARK: - Support Section
    // Figma 41:8760: Contact Support, Rate the App

    private var supportSection: some View {
        ProfileMenuSection(title: "SUPPORT") {
            ProfileMenuItem(
                icon: "envelope.fill",
                title: "Contact Support"
            ) {
                openSupportEmail()
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "star.fill",
                title: "Rate the App"
            ) {
                openAppStoreReview()
            }
        }
    }

    // MARK: - App Section
    // Figma 41:8760: Sign Out and Delete Account are in APP section

    private var appSection: some View {
        ProfileMenuSection(title: "APP") {
            // Sign Out - Figma: icon + "Sign Out" + arrow, neutral text
            ProfileMenuItem(
                icon: "rectangle.portrait.and.arrow.right",
                title: "Sign Out",
                iconColor: AppColors.brand500,
                textColor: .white
            ) {
                showLogoutConfirmation = true
            }

            ProfileMenuDivider()

            // Delete Account - Figma: icon + "Delete Account" + arrow, brand colored
            ProfileMenuItem(
                icon: "trash.fill",
                title: "Delete Account",
                iconColor: AppColors.brand500,
                textColor: .white
            ) {
                showDeleteConfirmation = true
            }
        }
    }

    // MARK: - Version Footer
    // Figma: Centered version text at bottom

    private var versionFooter: some View {
        Text(viewModel.appVersion)
            .font(.system(size: 12, weight: .regular))
            .foregroundColor(AppColors.neutral500)
            .frame(maxWidth: .infinity)
            .padding(.top, Spacing.lg)
    }

    // MARK: - Loading Content

    private struct LoadingContent: View {
        var body: some View {
            VStack(spacing: Spacing.md) {
                ProgressView()
                    .tint(AppColors.brand500)
                Text("Loading profile...")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textMuted)
            }
        }
    }

    // MARK: - Actions

    private func performLogout() {
        Task {
            let success = await viewModel.logout()
            if success {
                appState.clearSession()
                coordinator.popToRoot()
            }
        }
    }

    private func openSupportEmail() {
        guard let url = URL(string: "mailto:support@flent.in?subject=Support%20Request") else { return }
        UIApplication.shared.open(url)
    }

    private func openTerms() {
        guard let url = URL(string: "https://flent.in/terms") else { return }
        UIApplication.shared.open(url)
    }

    private func openPrivacyPolicy() {
        guard let url = URL(string: "https://flent.in/privacy") else { return }
        UIApplication.shared.open(url)
    }

    private func openAppStoreReview() {
        // App Store ID placeholder
        guard let url = URL(string: "itms-apps://itunes.apple.com/app/id1234567890?action=write-review") else { return }
        UIApplication.shared.open(url)
    }
}

// MARK: - Profile Menu Section
// Figma: Section header is 10px semibold, neutral500, letter-spacing 0.5

struct ProfileMenuSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            // Section Header - Figma: 10px semibold, uppercase, neutral500
            Text(title)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(0.5)

            // Section Card - Figma: black600 (#1A1A1A) background, no border
            VStack(spacing: 0) {
                content()
            }
            .background(AppColors.black600)
            .cornerRadius(Radius.md)
        }
    }
}

// MARK: - Profile Avatar Row
// Figma 41:8760: Avatar (40x40), Name, Timestamp, Chevron

struct ProfileAvatarRow: View {
    let name: String
    let timestamp: String
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.shared.lightImpact()
            action()
        }) {
            HStack(spacing: Spacing.sm) {
                // Avatar - Figma: 40x40 circular avatar
                ZStack {
                    Circle()
                        .fill(AppColors.brand500.opacity(0.2))
                        .frame(width: 40, height: 40)

                    Image(systemName: "person.fill")
                        .font(.system(size: 18))
                        .foregroundColor(AppColors.brand500)
                }

                // Name and timestamp
                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)

                    Text(timestamp)
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500)
                }

                Spacer()

                // Chevron - Figma: brand500 color
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.brand500)
            }
            .padding(Spacing.md)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Profile Menu Item
// Figma: Icon (brand500) + Title (white, 14px regular) + Chevron (brand500)

struct ProfileMenuItem: View {
    let icon: String
    let title: String
    var subtitle: String? = nil
    var iconColor: Color = AppColors.brand500
    var textColor: Color = .white
    var showBadge: Bool = false
    var badgeText: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.shared.lightImpact()
            action()
        }) {
            HStack(spacing: Spacing.sm) {
                // Icon - Figma: 20pt, brand500
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(iconColor)
                    .frame(width: 24, height: 24)

                // Title and subtitle
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(textColor)

                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.neutral500)
                    }
                }

                Spacer()

                // Optional badge
                if showBadge, let badgeText = badgeText {
                    Text(badgeText)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, Spacing.xs)
                        .padding(.vertical, 2)
                        .background(AppColors.brand500)
                        .cornerRadius(Radius.pill)
                }

                // Chevron - Figma: 14pt, brand500
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.brand500)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 14) // Figma: ~14pt vertical padding
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Profile Menu Divider
// Figma: Thin divider line, full width within card

struct ProfileMenuDivider: View {
    var body: some View {
        Rectangle()
            .fill(AppColors.black400.opacity(0.5))
            .frame(height: 1)
            .padding(.leading, 52) // Aligns with text after icon (24 icon + 12 spacing + 16 padding)
    }
}

// MARK: - Previews

#Preview("Profile") {
    ProfileView()
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Profile Loading") {
    ProfileView()
        .environment(AppCoordinator())
        .environment(AppState())
}
