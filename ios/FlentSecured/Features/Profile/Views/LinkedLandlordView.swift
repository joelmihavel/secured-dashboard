/// LinkedLandlordView.swift
/// Flent Secured v2 - Linked Landlord Details
///
/// Figma: Part of Profile flow
/// Shows landlord connection status and details

import SwiftUI

struct LinkedLandlordView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @State private var viewModel = LinkedLandlordViewModel()

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

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

                        // Title
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Linked")
                                .font(.system(size: 32, weight: .light))
                                .foregroundColor(.white)
                            Text("Landlord")
                                .font(.system(size: 32, weight: .light))
                                .foregroundColor(AppColors.brand500)
                        }

                        // Landlord Status Card
                        landlordStatusCard

                        // Landlord Details (if linked)
                        if viewModel.isLinked {
                            landlordDetailsSection
                        } else {
                            notLinkedSection
                        }

                        Spacer()
                    }
                    .padding(.horizontal, Spacing.screenHorizontalCompact)
                }
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadLandlordDetails()
        }
    }

    // MARK: - Landlord Status Card

    private var landlordStatusCard: some View {
        HStack(spacing: Spacing.md) {
            // Status icon
            ZStack {
                Circle()
                    .fill(viewModel.statusColor.opacity(0.15))
                    .frame(width: 48, height: 48)

                Image(systemName: viewModel.statusIcon)
                    .font(.system(size: 20))
                    .foregroundColor(viewModel.statusColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(viewModel.statusTitle)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Text(viewModel.statusSubtitle)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Spacer()
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(viewModel.statusColor.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Landlord Details Section

    private var landlordDetailsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("LANDLORD INFORMATION")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(1.5)

            VStack(spacing: 0) {
                LandlordDetailRow(label: "Name", value: viewModel.landlordName)
                Divider().background(AppColors.black400.opacity(0.5))
                LandlordDetailRow(label: "Phone", value: viewModel.landlordPhone, isMasked: true)
                Divider().background(AppColors.black400.opacity(0.5))
                LandlordDetailRow(label: "Email", value: viewModel.landlordEmail, isMasked: true)
                Divider().background(AppColors.black400.opacity(0.5))
                LandlordDetailRow(label: "Linked Since", value: viewModel.linkedSince)
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

    // MARK: - Not Linked Section

    private var notLinkedSection: some View {
        VStack(spacing: Spacing.lg) {
            // Empty state
            VStack(spacing: Spacing.md) {
                ZStack {
                    Circle()
                        .fill(AppColors.black400.opacity(0.2))
                        .frame(width: 80, height: 80)

                    Image(systemName: "person.badge.plus")
                        .font(.system(size: 32))
                        .foregroundColor(AppColors.neutral500)
                }

                Text("No landlord linked yet")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Text("Invite your landlord to enable cashback rewards and faster settlements.")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.xxl)

            // Invite CTA
            PrimaryButton(title: "Invite Landlord") {
                coordinator.navigate(to: .inviteLandlord)
            }
        }
    }
}

// MARK: - Landlord Detail Row

private struct LandlordDetailRow: View {
    let label: String
    let value: String
    var isMasked: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(AppColors.neutral500)

            Spacer()

            Text(isMasked ? maskValue(value) : value)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.white)
        }
        .padding(.vertical, Spacing.sm)
    }

    private func maskValue(_ value: String) -> String {
        if value.contains("@") {
            // Email - show first 2 chars and domain
            let parts = value.split(separator: "@")
            if let first = parts.first, parts.count == 2 {
                let masked = String(first.prefix(2)) + "***@" + parts[1]
                return masked
            }
        } else if value.count >= 10 {
            // Phone - show last 4 digits
            return "******" + value.suffix(4)
        }
        return value
    }
}

// MARK: - Linked Landlord ViewModel

@Observable
final class LinkedLandlordViewModel {
    private(set) var isLoading = false
    private(set) var isLinked = false
    private(set) var landlordName = ""
    private(set) var landlordPhone = ""
    private(set) var landlordEmail = ""
    private(set) var linkedSince = ""
    private(set) var status: LandlordLinkStatus = .notLinked

    enum LandlordLinkStatus {
        case notLinked
        case pending
        case declined
        case linked
    }

    var statusColor: Color {
        switch status {
        case .notLinked: return AppColors.neutral500
        case .pending: return AppColors.brand500
        case .declined: return AppColors.warning
        case .linked: return AppColors.success
        }
    }

    var statusIcon: String {
        switch status {
        case .notLinked: return "person.badge.plus"
        case .pending: return "clock.fill"
        case .declined: return "exclamationmark.triangle.fill"
        case .linked: return "checkmark.circle.fill"
        }
    }

    var statusTitle: String {
        switch status {
        case .notLinked: return "No landlord linked"
        case .pending: return "Invitation pending"
        case .declined: return "Invitation declined"
        case .linked: return "Landlord verified"
        }
    }

    var statusSubtitle: String {
        switch status {
        case .notLinked: return "Invite your landlord to unlock cashback"
        case .pending: return "Waiting for your landlord to accept"
        case .declined: return "Contact support for assistance"
        case .linked: return "You're eligible for cashback rewards"
        }
    }

    private let userService: UserServiceProtocol

    init(userService: UserServiceProtocol = AppEnvironment.shared.userService) {
        self.userService = userService
    }

    @MainActor
    func loadLandlordDetails() async {
        isLoading = true

        do {
            guard let tenancy = try await userService.getCurrentTenancy() else {
                isLoading = false
                status = .notLinked
                return
            }

            if tenancy.landlordApproved {
                status = .linked
                isLinked = true
            } else if tenancy.landlordDeclined {
                status = .declined
                isLinked = false
            } else if tenancy.landlordPhone != nil || tenancy.landlordEmail != nil {
                status = .pending
                isLinked = false
            } else {
                status = .notLinked
                isLinked = false
            }

            landlordName = tenancy.landlordName ?? "Not provided"
            landlordPhone = tenancy.landlordPhone ?? "Not provided"
            landlordEmail = tenancy.landlordEmail ?? "Not provided"

            // Format linked date
            if let sentAt = tenancy.landlordInvitationSentAt {
                let isoFormatter = ISO8601DateFormatter()
                isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let date = isoFormatter.date(from: sentAt) {
                    let displayFormatter = DateFormatter()
                    displayFormatter.dateFormat = "MMMM yyyy"
                    linkedSince = displayFormatter.string(from: date)
                }
            }

            isLoading = false
        } catch {
            isLoading = false
            status = .notLinked
        }
    }
}

#Preview {
    LinkedLandlordView()
        .environment(AppCoordinator())
}
