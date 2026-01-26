/// Card.swift
/// Flent Secured v2 - Card Component
///
/// Reusable card container with consistent styling
/// Figma: Components / Cards

import SwiftUI

// MARK: - Base Card

struct Card<Content: View>: View {
    var padding: CGFloat = Spacing.md
    var cornerRadius: CGFloat = Radius.card
    var backgroundColor: Color = AppColors.backgroundSecondary
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .background(backgroundColor)
            .cornerRadius(cornerRadius)
    }
}

// MARK: - Tappable Card

struct TappableCard<Content: View>: View {
    var padding: CGFloat = Spacing.md
    var cornerRadius: CGFloat = Radius.card
    var backgroundColor: Color = AppColors.backgroundSecondary
    let action: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        Button(action: {
            HapticManager.shared.lightImpact()
            action()
        }) {
            content()
                .padding(padding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(backgroundColor)
                .cornerRadius(cornerRadius)
        }
        .buttonStyle(CardButtonStyle())
    }
}

// MARK: - Card Button Style

struct CardButtonStyle: ButtonStyle {
    func makeBody(configuration: ButtonStyle.Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .opacity(configuration.isPressed ? 0.9 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Info Card

struct InfoCard: View {
    let icon: String
    let title: String
    let subtitle: String?
    var iconColor: Color = AppColors.accentPrimary

    var body: some View {
        Card {
            HStack(spacing: Spacing.md) {
                ZStack {
                    Circle()
                        .fill(iconColor.opacity(0.2))
                        .frame(width: 44, height: 44)

                    Image(systemName: icon)
                        .font(.system(size: 20))
                        .foregroundColor(iconColor)
                }

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
            }
        }
    }
}

// MARK: - Status Card

struct StatusCard: View {
    let status: StatusType
    let title: String
    let message: String

    enum StatusType {
        case success
        case warning
        case error
        case info

        var color: Color {
            switch self {
            case .success: return AppColors.success
            case .warning: return AppColors.warning
            case .error: return AppColors.error
            case .info: return AppColors.accentPrimary
            }
        }

        var icon: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .error: return "xmark.circle.fill"
            case .info: return "info.circle.fill"
            }
        }
    }

    var body: some View {
        Card {
            HStack(alignment: .top, spacing: Spacing.md) {
                Image(systemName: status.icon)
                    .font(.system(size: 24))
                    .foregroundColor(status.color)

                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text(title)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text(message)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textSecondary)
                }

                Spacer()
            }
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        Card {
            Text("Basic Card Content")
                .foregroundColor(AppColors.textPrimary)
        }

        TappableCard {
            print("Tapped")
        } content: {
            Text("Tappable Card")
                .foregroundColor(AppColors.textPrimary)
        }

        InfoCard(
            icon: "creditcard",
            title: "Payment Method",
            subtitle: "HDFC Bank •••• 4242"
        )

        StatusCard(
            status: .success,
            title: "Payment Successful",
            message: "Your rent has been paid successfully"
        )

        StatusCard(
            status: .warning,
            title: "Payment Due Soon",
            message: "Pay by 7th to earn cashback"
        )
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}
