/// SetupProgressCard.swift
/// Flent Secured v2 - Setup Progress Card Component
///
/// Card showing onboarding/setup progress with checklist
///
/// Figma: Home / Setup Progress Card
/// - Background: #202020 (black/500)
/// - Border: 1px #4D4D4D
/// - Corner radius: 12px
/// - Checklist with orange/green circles

import SwiftUI

struct SetupProgressCard: View {
    let title: String
    let progress: String // e.g. "1/3"
    let items: [SetupItem]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header
            HStack {
                Text(title)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Spacer()

                Text(progress)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.neutral500)
            }

            // Checklist
            VStack(alignment: .leading, spacing: Spacing.sm) {
                ForEach(items) { item in
                    SetupItemRow(item: item)
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

// MARK: - Setup Item

struct SetupItem: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String?
    let status: Status

    enum Status {
        case pending
        case inProgress
        case completed
    }
}

// MARK: - Setup Item Row

struct SetupItemRow: View {
    let item: SetupItem

    private var circleColor: Color {
        switch item.status {
        case .completed: return AppColors.successApproved
        case .inProgress: return AppColors.brand500
        case .pending: return AppColors.black400
        }
    }

    private var iconName: String {
        switch item.status {
        case .completed: return "checkmark"
        case .inProgress, .pending: return ""
        }
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            // Status circle
            ZStack {
                Circle()
                    .fill(item.status == .pending ? Color.clear : circleColor)
                    .frame(width: 20, height: 20)

                if item.status == .pending {
                    Circle()
                        .stroke(circleColor, lineWidth: 2)
                        .frame(width: 20, height: 20)
                }

                if item.status == .completed {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                }
            }

            // Text
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(item.status == .pending ? AppColors.neutral500 : .white)

                if let subtitle = item.subtitle {
                    Text(subtitle)
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500)
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("Setup Progress Card") {
    VStack(spacing: Spacing.lg) {
        SetupProgressCard(
            title: "Setup incomplete",
            progress: "1/3",
            items: [
                SetupItem(title: "Add landlord's bank details", subtitle: "enables secure payouts", status: .completed),
                SetupItem(title: "Upload address proof", subtitle: "for verification", status: .inProgress),
                SetupItem(title: "Invite your landlord", subtitle: "needed for cashback eligibility", status: .pending)
            ]
        )
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}
