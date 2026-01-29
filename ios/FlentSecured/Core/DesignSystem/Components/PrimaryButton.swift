/// PrimaryButton.swift
/// Flent Secured v2 - Primary Button Component
///
/// The main CTA button used throughout the app
/// Follows design system specifications from Figma
///
/// Figma: Components / Buttons / Primary
/// - Outer Container: brand/600 (#CC7B57), rd-12
/// - Inner Button: gradient brand/400→brand/500, rd-8
/// - Height: 56pt total
/// - Font: Body/md SemiBold (16px)
/// - Text Color: white (#FFFFFF)

import SwiftUI

struct PrimaryButton: View {
    let title: String
    var isLoading: Bool = false
    var isEnabled: Bool = true
    let action: () -> Void

    /// Gradient from brand/400 to brand/500
    private var buttonGradient: LinearGradient {
        LinearGradient(
            gradient: Gradient(colors: [AppColors.brand400, AppColors.brand500]),
            startPoint: .top,
            endPoint: .bottom
        )
    }

    /// Disabled state gradient (muted)
    private var disabledGradient: LinearGradient {
        LinearGradient(
            gradient: Gradient(colors: [AppColors.black500, AppColors.black500]),
            startPoint: .top,
            endPoint: .bottom
        )
    }

    var body: some View {
        Button(action: {
            print("DEBUG: PrimaryButton tapped, isEnabled=\(isEnabled), isLoading=\(isLoading)")
            if isEnabled && !isLoading {
                // Haptic feedback
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()

                action()
            }
        }) {
            // Inner button with gradient
            HStack(spacing: Spacing.xs) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                }

                Text(title)
                    .font(Typography.button)
                    .foregroundColor(.white)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48) // Inner height
            .background(isEnabled ? buttonGradient : disabledGradient)
            .cornerRadius(Radius.sm) // rd-8 for inner
            .padding(4) // Creates the outer padding effect
            .background(isEnabled ? AppColors.brand600 : AppColors.black400)
            .cornerRadius(Radius.md) // rd-12 for outer
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!isEnabled || isLoading)
        .accessibilityIdentifier("primary_button")
    }
}

// MARK: - Pressable Button Style

struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: ButtonStyle.Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.9 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Secondary Button

struct SecondaryButton: View {
    let title: String
    var isLoading: Bool = false
    var isEnabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: {
            if isEnabled && !isLoading {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()

                action()
            }
        }) {
            HStack(spacing: Spacing.xs) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: AppColors.accentPrimary))
                        .scaleEffect(0.8)
                }

                Text(title)
                    .font(Typography.button)
                    .foregroundColor(AppColors.accentPrimary)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(Color.clear)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.button)
                    .stroke(
                        isEnabled ? AppColors.accentPrimary : AppColors.disabled,
                        lineWidth: 2
                    )
            )
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!isEnabled || isLoading)
        .accessibilityIdentifier("secondary_button")
    }
}

// MARK: - Text Button

struct TextButton: View {
    let title: String
    var isEnabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: {
            if isEnabled {
                action()
            }
        }) {
            Text(title)
                .font(Typography.buttonSmall)
                .foregroundColor(isEnabled ? AppColors.accentPrimary : AppColors.textMuted)
        }
        .disabled(!isEnabled)
    }
}

// MARK: - Previews

#Preview("Primary Button") {
    VStack(spacing: Spacing.md) {
        PrimaryButton(title: "Continue") {
            print("Tapped")
        }

        PrimaryButton(title: "Loading...", isLoading: true) {
            print("Tapped")
        }

        PrimaryButton(title: "Disabled", isEnabled: false) {
            print("Tapped")
        }
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}

#Preview("Secondary Button") {
    VStack(spacing: Spacing.md) {
        SecondaryButton(title: "Cancel") {
            print("Tapped")
        }

        SecondaryButton(title: "Disabled", isEnabled: false) {
            print("Tapped")
        }
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}
