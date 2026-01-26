/// ReferralView.swift
/// Flent Secured v2 - Referral Screen
///
/// Manages referral program - share code, track referrals, earn rewards

import SwiftUI

struct ReferralView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel = ReferralViewModel()
    @State private var showShareSheet = false
    @State private var showCopiedToast = false

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
                Text("Refer & Earn")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                if viewModel.isLoading {
                    loadingState
                } else if viewModel.hasReferralCode {
                    referralContent
                } else {
                    comingSoonState
                }
            }
            .screenPadding()
            .padding(.top, Spacing.xl)

            // Copied Toast
            if showCopiedToast {
                VStack {
                    Spacer()
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(AppColors.success)
                        Text("Copied to clipboard!")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textPrimary)
                    }
                    .padding(Spacing.md)
                    .background(AppColors.backgroundSecondary)
                    .cornerRadius(Radius.pill)
                    .padding(.bottom, Spacing.xl)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadReferralData()
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = viewModel.shareReferralLink() {
                ShareSheet(items: [
                    "Join me on Flent Secured and earn ₹500 cashback on your first rent payment! Use my code: \(viewModel.referralCode ?? "")",
                    url
                ])
            }
        }
    }

    private var loadingState: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
                .tint(AppColors.accentPrimary)
            Text("Loading referral info...")
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.xxl)
    }

    private var comingSoonState: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            // Coming Soon Illustration
            ZStack {
                Circle()
                    .fill(AppColors.accentPrimary.opacity(0.1))
                    .frame(width: 120, height: 120)

                Image(systemName: "gift.fill")
                    .font(.system(size: 48))
                    .foregroundColor(AppColors.accentPrimary)
            }

            VStack(spacing: Spacing.sm) {
                Text("Coming Soon")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text("Our referral program is launching soon. Invite friends and earn rewards when they pay rent with Flent!")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.lg)
    }

    private var referralContent: some View {
        ScrollView {
            VStack(spacing: Spacing.xl) {
                // Referral Code Card
                VStack(spacing: Spacing.md) {
                    Text("Your Referral Code")
                        .font(Typography.label)
                        .foregroundColor(AppColors.textMuted)

                    HStack {
                        Text(viewModel.referralCode ?? "")
                            .font(Typography.amountLarge)
                            .foregroundColor(AppColors.accentPrimary)

                        Spacer()

                        Button {
                            viewModel.copyReferralCode()
                            showCopiedFeedback()
                        } label: {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 20))
                                .foregroundColor(AppColors.textSecondary)
                        }
                    }
                    .padding(Spacing.lg)
                    .background(AppColors.backgroundSecondary)
                    .cornerRadius(Radius.card)

                    SecondaryButton(title: "Share Referral Link") {
                        showShareSheet = true
                    }
                }

                // Stats Cards
                VStack(spacing: Spacing.sm) {
                    HStack(spacing: Spacing.sm) {
                        statCard(
                            title: "Total Referrals",
                            value: "\(viewModel.totalReferrals)",
                            icon: "person.2.fill"
                        )

                        statCard(
                            title: "Successful",
                            value: "\(viewModel.successfulReferrals)",
                            icon: "checkmark.circle.fill"
                        )
                    }

                    HStack(spacing: Spacing.sm) {
                        statCard(
                            title: "Total Earned",
                            value: viewModel.totalEarnings,
                            icon: "indianrupeesign.circle.fill"
                        )

                        statCard(
                            title: "Pending",
                            value: viewModel.pendingEarnings,
                            icon: "clock.fill"
                        )
                    }
                }

                // Recent Referrals
                if !viewModel.referrals.isEmpty {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text("Recent Referrals")
                            .font(Typography.label)
                            .foregroundColor(AppColors.textMuted)

                        VStack(spacing: Spacing.xs) {
                            ForEach(viewModel.referrals) { referral in
                                referralRow(referral)
                            }
                        }
                    }
                }

                // How It Works
                howItWorksSection
            }
        }
    }

    private func statCard(title: String, value: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(AppColors.accentPrimary)
                Spacer()
            }

            Text(value)
                .font(Typography.h4)
                .foregroundColor(AppColors.textPrimary)

            Text(title)
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textSecondary)
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.card)
    }

    private func referralRow(_ referral: Referral) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(referral.maskedPhone)
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.textPrimary)

                Text(referral.statusDisplayName)
                    .font(Typography.bodySm)
                    .foregroundColor(statusColor(for: referral.status))
            }

            Spacer()

            if let earnings = referral.earnings {
                Text("+\(earnings)")
                    .font(Typography.bodySmMedium)
                    .foregroundColor(AppColors.success)
            }
        }
        .padding(Spacing.md)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.sm)
    }

    private func statusColor(for status: String) -> Color {
        switch status {
        case "completed": return AppColors.success
        case "pending": return AppColors.warning
        case "expired": return AppColors.error
        default: return AppColors.textSecondary
        }
    }

    private var howItWorksSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("How It Works")
                .font(Typography.label)
                .foregroundColor(AppColors.textMuted)

            VStack(spacing: Spacing.sm) {
                howItWorksStep(
                    number: 1,
                    title: "Share Your Code",
                    description: "Send your referral code to friends and family"
                )

                howItWorksStep(
                    number: 2,
                    title: "Friend Signs Up",
                    description: "They create an account and verify their tenancy"
                )

                howItWorksStep(
                    number: 3,
                    title: "Earn Rewards",
                    description: "Get ₹500 when they make their first rent payment"
                )
            }
        }
    }

    private func howItWorksStep(number: Int, title: String, description: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            Text("\(number)")
                .font(Typography.bodySmMedium)
                .foregroundColor(AppColors.textOnPrimary)
                .frame(width: 24, height: 24)
                .background(AppColors.accentPrimary)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(title)
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.textPrimary)

                Text(description)
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textSecondary)
            }

            Spacer()
        }
        .padding(Spacing.md)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.sm)
    }

    private func showCopiedFeedback() {
        withAnimation {
            showCopiedToast = true
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation {
                showCopiedToast = false
            }
        }
    }
}

// Note: ShareSheet is defined in Features/Setup/Views/InviteLandlordView.swift

#Preview("Coming Soon") {
    ReferralView()
        .environment(AppCoordinator())
}

#Preview("With Referral Code") {
    let view = ReferralView()
    return view
        .environment(AppCoordinator())
}
