import SwiftUI

struct PrimaryButton: View {
    let title: String
    let icon: String?
    let isLoading: Bool
    let isEnabled: Bool
    let style: ButtonStyle
    let showBarIndicator: Bool
    let action: () -> Void

    enum ButtonStyle {
        case primary   // Orange gradient (for CTAs like "Pay Now")
        case secondary // Dark gradient with orange border (Figma default for most buttons)
    }

    init(
        title: String,
        icon: String? = nil,
        isLoading: Bool = false,
        isEnabled: Bool = true,
        style: ButtonStyle = .secondary, // Default to secondary (dark) per Figma
        showBarIndicator: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isLoading = isLoading
        self.isEnabled = isEnabled
        self.style = style
        self.showBarIndicator = showBarIndicator
        self.action = action
    }

    var body: some View {
        Button(action: {
            HapticManager.shared.mediumImpact()
            action()
        }) {
            VStack(spacing: 12) { // 12pt gap per Figma visual analysis
                // Optional bar indicator (for splash screen style)
                // Figma: Very subtle gray capsule indicator above button
                if showBarIndicator {
                    Capsule()
                        .fill(AppColors.black400.opacity(0.6)) // Subtle per Figma
                        .frame(width: 32, height: 3) // Slightly wider/thicker for visibility per Figma
                }

                // Main button body
                ZStack {
                    // Background
                    if style == .primary {
                        // Orange gradient for primary
                        if isEnabled {
                            AppColors.buttonGradient
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        } else {
                            AppColors.buttonGradientDisabled
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    } else {
                        // Secondary: Dark gradient per Figma (#202020 → #0D0D0D @ 90%)
                        RoundedRectangle(cornerRadius: 8)
                            .fill(
                                LinearGradient(
                                    stops: [
                                        .init(color: Color(hex: "202020"), location: 0),
                                        .init(color: Color(hex: "0D0D0D"), location: 0.90179)
                                    ],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )

                        // Inner shadow layer 1: dark edge effect
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.black, lineWidth: 1)
                            .blur(radius: 0.5)
                            .offset(x: -2, y: -4)
                            .mask(RoundedRectangle(cornerRadius: 8))

                        // Inner shadow layer 2: white glow for 3D depth
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.12), lineWidth: 2)
                            .blur(radius: 4)
                            .offset(x: 0, y: -3)
                            .mask(RoundedRectangle(cornerRadius: 8))
                    }

                    // Content
                    HStack(spacing: Spacing.xs) {
                        if isLoading {
                            ProgressView()
                                .tint(style == .primary ? AppColors.white : AppColors.white)
                        } else {
                            if let icon = icon {
                                Image(systemName: icon)
                                    .foregroundColor(.white)
                            }
                            Text(title)
                                .font(Typography.bodyMdMedium)
                                .foregroundColor(.white)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    // Border - subtle orange for secondary
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(
                            style == .secondary ? AppColors.brand500 : Color.clear,
                            lineWidth: 0.5
                        )
                )
                .shadow(
                    // Warm shadow for secondary style
                    color: style == .secondary
                        ? Color(red: 0.60, green: 0.36, blue: 0.25).opacity(0.24)
                        : Color.clear,
                    radius: 6,
                    y: 6
                )
            }
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!isEnabled || isLoading)
        .opacity(isEnabled ? 1 : AppColors.Opacity.disabled)
    }
}

// MARK: - Text Button

/// Simple text button with brand color - no background
struct TextButton: View {
    let title: String
    let action: () -> Void

    init(title: String, action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Typography.bodyMd)
                .foregroundColor(AppColors.brand500)
        }
    }
}

// MARK: - Secondary Button Alias

/// Secondary button with dark background and orange border
struct SecondaryButton: View {
    let title: String
    let icon: String?
    let isLoading: Bool
    let isEnabled: Bool
    let action: () -> Void

    init(
        title: String,
        icon: String? = nil,
        isLoading: Bool = false,
        isEnabled: Bool = true,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isLoading = isLoading
        self.isEnabled = isEnabled
        self.action = action
    }

    var body: some View {
        PrimaryButton(
            title: title,
            icon: icon,
            isLoading: isLoading,
            isEnabled: isEnabled,
            style: .secondary,
            action: action
        )
    }
}

// MARK: - Pressable Button Style

/// A button style that scales down slightly when pressed for tactile feedback
struct PressableButtonStyle: SwiftUI.ButtonStyle {
    func makeBody(configuration: SwiftUI.ButtonStyleConfiguration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.8), value: configuration.isPressed)
    }
}

#Preview {
    VStack(spacing: 20) {
        PrimaryButton(title: "Get Started", showBarIndicator: true, action: {})
        PrimaryButton(title: "Proceed", action: {})
        PrimaryButton(title: "Pay Now", style: .primary, action: {})
        PrimaryButton(title: "Disabled", isEnabled: false, action: {})
    }
    .padding()
    .background(AppColors.black700)
}
