/// ProfileView.swift
/// Flent Secured v2 - Profile Screen
///
/// Figma: node-id=1:34492
/// - "My" white + "Profile" orange header
/// - Payment history bar chart
/// - Sections: SECURED ACCOUNT, PAYMENT INFORMATION, SUPPORT, APP
/// - Menu items with orange chevrons
/// - Delete Account (red text)

import SwiftUI

struct ProfileView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = ProfileViewModel()

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            if viewModel.isLoading {
                ProgressView()
                    .tint(AppColors.brand500)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        // Header with back button
                        HStack {
                            Button {
                                coordinator.pop()
                            } label: {
                                Image(systemName: "arrow.left")
                                    .font(.system(size: 20, weight: .medium))
                                    .foregroundColor(.white)
                            }

                            Spacer()
                        }
                        .padding(.top, Spacing.md)

                        // Title - Split color
                        VStack(alignment: .leading, spacing: 0) {
                            Text("My")
                                .font(.system(size: 32, weight: .light))
                                .foregroundColor(.white)
                            Text("Profile")
                                .font(.system(size: 32, weight: .light))
                                .foregroundColor(AppColors.brand500)
                        }

                        // Payment History Chart
                        PaymentHistoryCard(
                            onTimeCount: viewModel.onTimePayments,
                            lateCount: viewModel.latePayments,
                            monthsData: viewModel.paymentHistory
                        )

                        // SECURED ACCOUNT Section
                        ProfileMenuSection(title: "SECURED ACCOUNT") {
                            ProfileMenuItem(
                                icon: "person.fill",
                                title: "Personal Details"
                            ) {
                                // Navigate to personal details
                            }

                            ProfileMenuItem(
                                icon: "house.fill",
                                title: "Tenancy Details"
                            ) {
                                // Navigate to tenancy details
                            }

                            ProfileMenuItem(
                                icon: "person.2.fill",
                                title: "Linked Landlord"
                            ) {
                                // Navigate to linked landlord
                            }
                        }

                        // PAYMENT INFORMATION Section
                        ProfileMenuSection(title: "PAYMENT INFORMATION") {
                            ProfileMenuItem(
                                icon: "building.columns.fill",
                                title: "Landlord Bank Account"
                            ) {
                                // Navigate to bank account
                            }

                            ProfileMenuItem(
                                icon: "creditcard.fill",
                                title: "Payment History"
                            ) {
                                // Navigate to payment history
                            }
                        }

                        // SUPPORT Section
                        ProfileMenuSection(title: "SUPPORT") {
                            ProfileMenuItem(
                                icon: "questionmark.circle.fill",
                                title: "Help & FAQ"
                            ) {
                                // Open help
                            }

                            ProfileMenuItem(
                                icon: "bubble.left.fill",
                                title: "Contact Support"
                            ) {
                                // Open support chat
                            }
                        }

                        // APP Section
                        ProfileMenuSection(title: "APP") {
                            ProfileMenuItem(
                                icon: "doc.text.fill",
                                title: "Terms & Conditions"
                            ) {
                                // Open terms
                            }

                            ProfileMenuItem(
                                icon: "lock.shield.fill",
                                title: "Privacy Policy"
                            ) {
                                // Open privacy policy
                            }

                            ProfileMenuItem(
                                icon: "star.fill",
                                title: "Rate the App"
                            ) {
                                // Open App Store rating
                            }
                        }

                        // Logout Button
                        Button(action: {
                            Task {
                                let success = await viewModel.logout()
                                if success {
                                    appState.clearSession()
                                    coordinator.popToRoot()
                                }
                            }
                        }) {
                            HStack {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .font(.system(size: 20))
                                    .foregroundColor(AppColors.neutral500)

                                Text(viewModel.isLoggingOut ? "Logging out..." : "Log Out")
                                    .font(.system(size: 16, weight: .medium))
                                    .foregroundColor(AppColors.neutral500)

                                Spacer()
                            }
                            .padding(Spacing.md)
                        }

                        // Delete Account
                        Button(action: {
                            // Show delete confirmation
                        }) {
                            HStack {
                                Image(systemName: "trash.fill")
                                    .font(.system(size: 20))
                                    .foregroundColor(AppColors.error)

                                Text("Delete Account")
                                    .font(.system(size: 16, weight: .medium))
                                    .foregroundColor(AppColors.error)

                                Spacer()
                            }
                            .padding(Spacing.md)
                        }

                        // Version
                        Text(viewModel.appVersion)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.neutral500)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.md)

                        Spacer()
                            .frame(height: Spacing.xl)
                    }
                    .padding(.horizontal, Spacing.screenHorizontalCompact)
                }
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadProfile()
        }
    }
}

// MARK: - Payment History Card

struct PaymentHistoryCard: View {
    let onTimeCount: Int
    let lateCount: Int
    let monthsData: [PaymentMonthData]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header
            Text("Payment History")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white)

            // Bar Chart
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(monthsData) { month in
                    VStack(spacing: 4) {
                        // Bar
                        RoundedRectangle(cornerRadius: 4)
                            .fill(month.isOnTime ? AppColors.successApproved : AppColors.error)
                            .frame(width: 24, height: CGFloat(month.percentage) * 0.8)

                        // Month label
                        Text(month.monthLabel)
                            .font(.system(size: 10, weight: .regular))
                            .foregroundColor(AppColors.neutral500)
                    }
                }
            }
            .frame(height: 100)
            .frame(maxWidth: .infinity)

            // Legend
            HStack(spacing: Spacing.lg) {
                HStack(spacing: Spacing.xs) {
                    Circle()
                        .fill(AppColors.successApproved)
                        .frame(width: 8, height: 8)
                    Text("On Time (\(onTimeCount))")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500)
                }

                HStack(spacing: Spacing.xs) {
                    Circle()
                        .fill(AppColors.error)
                        .frame(width: 8, height: 8)
                    Text("Late (\(lateCount))")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500)
                }
            }
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.black400, lineWidth: 1)
        )
    }
}

// MARK: - Payment Month Data

struct PaymentMonthData: Identifiable {
    let id = UUID()
    let monthLabel: String
    let percentage: Int // 0-100
    let isOnTime: Bool
}

// MARK: - Profile Menu Section

struct ProfileMenuSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppColors.neutral500)
                .padding(.leading, Spacing.xs)

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
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.brand500)
                    .frame(width: 24)

                Text(title)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundColor(.white)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.brand500)
            }
            .padding(Spacing.md)
        }
    }
}

#Preview {
    ProfileView()
        .environment(AppCoordinator())
        .environment(AppState())
}
