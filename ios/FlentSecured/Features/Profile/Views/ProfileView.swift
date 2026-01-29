/// ProfileView.swift
/// Flent Secured v2 - Profile Screen
///
/// Figma Node IDs:
/// - 41:8450 - My Profile / Payment --UPI
/// - 1:34492 - Base profile structure
///
/// PIXEL PERFECT from Figma:
/// - Background: #131313 with dotted grid pattern
/// - Header: H1/Regular 400 (48px, tracking -2px)
///   - "My" - Gray (#A9A9A9)
///   - "Profile" - Brand (#FF9A6D)
/// - Horizontal padding: 48pt (sp-48)
/// - Payment history bar chart section
/// - Sections: SECURED ACCOUNT, PAYMENT INFORMATION, SUPPORT, APP
/// - Menu items: Icon (brand500) + Title + Chevron (brand500)
/// - Section headers: 12px medium, neutral500
/// - Cards: black500 background, black400 border, rd-12
/// - Delete Account: error color text
/// - Log Out: neutral500 color text

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

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            if viewModel.isLoading {
                LoadingContent()
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        // Header with back button
                        headerSection

                        // Payment History Chart (Figma: 41:8760)
                        PaymentHistoryGraphView(
                            monthsData: viewModel.paymentHistory,
                            onTimeCount: viewModel.onTimePayments,
                            lateCount: viewModel.latePayments
                        )

                        // SECURED ACCOUNT Section (Figma: 41:8880)
                        securedAccountSection

                        // PAYMENT INFORMATION Section (Figma: 41:8450, 41:8612, 41:9307)
                        paymentInformationSection

                        // SUPPORT Section
                        supportSection

                        // APP Section
                        appSection

                        // Log Out Button
                        logoutButton

                        // Delete Account Button
                        deleteAccountButton

                        // Version Footer
                        versionFooter

                        Spacer()
                            .frame(height: Spacing.xl)
                    }
                    .padding(.horizontal, Spacing.xxxl) // 48pt horizontal (sp-48)
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
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Back Button
            Button {
                coordinator.pop()
            } label: {
                Image(systemName: "arrow.left")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white)
            }
            .padding(.top, Spacing.md)

            // Title - Figma: H1/Regular 400 with two-color format
            VStack(alignment: .leading, spacing: 0) {
                Text("My")
                    .font(Typography.h1) // 48px Regular
                    .foregroundColor(AppColors.neutral500) // #A9A9A9
                    .tracking(-2)
                    .lineSpacing(16)
                Text("Profile")
                    .font(Typography.h1) // 48px Regular
                    .foregroundColor(AppColors.brand500) // #FF9A6D
                    .tracking(-2)
                    .lineSpacing(16)
            }
        }
    }

    // MARK: - Secured Account Section

    private var securedAccountSection: some View {
        ProfileMenuSection(title: "SECURED ACCOUNT") {
            ProfileMenuItem(
                icon: "person.fill",
                title: "Personal Details"
            ) {
                coordinator.navigate(to: .personalDetails)
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "house.fill",
                title: "Tenancy Details"
            ) {
                coordinator.navigate(to: .tenancyDetails)
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "person.2.fill",
                title: "Linked Landlord"
            ) {
                coordinator.navigate(to: .linkedLandlord)
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "doc.text.fill",
                title: "Rental Agreement"
            ) {
                coordinator.navigate(to: .agreementDetails)
            }
        }
    }

    // MARK: - Payment Information Section

    private var paymentInformationSection: some View {
        ProfileMenuSection(title: "PAYMENT INFORMATION") {
            ProfileMenuItem(
                icon: "building.columns.fill",
                title: "Landlord Bank Account"
            ) {
                coordinator.navigate(to: .landlordBankAccount)
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "creditcard.fill",
                title: "Payment History"
            ) {
                coordinator.navigate(to: .paymentHistory)
            }
        }
    }

    // MARK: - Support Section

    private var supportSection: some View {
        ProfileMenuSection(title: "SUPPORT") {
            ProfileMenuItem(
                icon: "questionmark.circle.fill",
                title: "Help & FAQ"
            ) {
                coordinator.navigate(to: .helpFAQ)
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "bubble.left.fill",
                title: "Contact Support"
            ) {
                openSupportEmail()
            }
        }
    }

    // MARK: - App Section

    private var appSection: some View {
        ProfileMenuSection(title: "APP") {
            ProfileMenuItem(
                icon: "doc.text.fill",
                title: "Terms & Conditions"
            ) {
                openTerms()
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "lock.shield.fill",
                title: "Privacy Policy"
            ) {
                openPrivacyPolicy()
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "star.fill",
                title: "Rate the App"
            ) {
                openAppStoreReview()
            }

            ProfileMenuDivider()

            ProfileMenuItem(
                icon: "gift.fill",
                title: "Refer a Friend"
            ) {
                coordinator.navigate(to: .referral)
            }
        }
    }

    // MARK: - Logout Button

    private var logoutButton: some View {
        Button(action: {
            showLogoutConfirmation = true
        }) {
            HStack(spacing: Spacing.md) {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.neutral500)
                    .frame(width: 24)

                Text(viewModel.isLoggingOut ? "Logging out..." : "Log Out")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(AppColors.neutral500)

                Spacer()
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
        .disabled(viewModel.isLoggingOut)
    }

    // MARK: - Delete Account Button

    private var deleteAccountButton: some View {
        Button(action: {
            showDeleteConfirmation = true
        }) {
            HStack(spacing: Spacing.md) {
                Image(systemName: "trash.fill")
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.error)
                    .frame(width: 24)

                Text("Delete Account")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(AppColors.error)

                Spacer()
            }
            .padding(Spacing.md)
            .background(AppColors.error.opacity(0.05))
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.error.opacity(0.3), lineWidth: 1)
            )
        }
    }

    // MARK: - Version Footer

    private var versionFooter: some View {
        Text(viewModel.appVersion)
            .font(.system(size: 12, weight: .regular))
            .foregroundColor(AppColors.neutral500)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
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

struct ProfileMenuSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Section Header
            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppColors.neutral500)
                .tracking(0.5)
                .padding(.leading, Spacing.xs)

            // Section Card
            VStack(spacing: 0) {
                content()
            }
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
    }
}

// MARK: - Profile Menu Item

struct ProfileMenuItem: View {
    let icon: String
    let title: String
    var subtitle: String? = nil
    var showBadge: Bool = false
    var badgeText: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: {
            // Haptic feedback
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            action()
        }) {
            HStack(spacing: Spacing.md) {
                // Icon
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.brand500)
                    .frame(width: 24)

                // Title and subtitle
                VStack(alignment: .leading, spacing: Spacing.xxxs) {
                    Text(title)
                        .font(.system(size: 16, weight: .regular))
                        .foregroundColor(.white)

                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.textSecondary)
                    }
                }

                Spacer()

                // Optional badge
                if showBadge, let badgeText = badgeText {
                    Text(badgeText)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, Spacing.xs)
                        .padding(.vertical, Spacing.xxxs)
                        .background(AppColors.brand500)
                        .cornerRadius(Radius.pill)
                }

                // Chevron
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

// MARK: - Profile Menu Divider

struct ProfileMenuDivider: View {
    var body: some View {
        Rectangle()
            .fill(AppColors.black400)
            .frame(height: 1)
            .padding(.leading, 56) // Aligns with text after icon
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
