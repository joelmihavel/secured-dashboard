/// SplashView.swift
/// Flent Secured v2 - Splash/Get Started Screen
///
/// Figma File: HZaVuwWn6B6jOjrmxZ7Kzv - Flent Secured v1.2 - Dev
/// Node IDs:
/// - 1:28071 - Splash / get-started --animation (Video intro)
/// - 1:28055 - Splash / get-started (Base state with button)
/// - 1:28985 - Splash / get-started --carousel 4 (Good Habits)
/// - 1:29025 - Splash / get-started --carousel 5 (Earn Everytime)
/// - 1:29065 - Splash / get-started --carousel 6 (It Gets Better)
///
/// This is the entry point wrapper that uses SplashCarouselView for the
/// full animated carousel experience. A static version is also available
/// for quick loading scenarios.

import SwiftUI

/// SplashView - Main entry point for splash screen
/// Uses SplashCarouselView with animated carousel
struct SplashView: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        SplashCarouselView()
            .environment(coordinator)
    }
}

/// StaticSplashView - Non-animated version for quick loading
/// Use this if you need a simpler splash without carousel animations
///
/// Figma: 1:28055 - Splash / get-started (static version)
/// Pixel-perfect specifications:
/// - Background: #131313 with dotted grid pattern
/// - Headline: H1/Regular 400 (48px, line-height 64px, tracking -2px)
/// - First lines: #A9A9A9 (neutral500), Last line: #FF9A6D (brand500)
/// - Subtitle: 14px Regular, #A6A6A6 (black200), line-height 20px
/// - Horizontal padding: 48px (sp-48)
struct StaticSplashView: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        ZStack {
            // Background: #131313 with dotted pattern
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            DottedGridPattern()
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Logo - Flent keyhole, top-left (33.375x40pt)
                FlentLogo()
                    .padding(.top, Spacing.xxl) // 40pt from safe area

                Spacer()
                    .frame(height: Spacing.xxl) // 40pt gap (sp-40)

                // Headline - Figma H1/Regular 400
                // Plus Jakarta Sans 48px, line-height 64px, tracking -2px
                VStack(alignment: .leading, spacing: 0) {
                    Text("Make\nyour rent")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.neutral500) // #A9A9A9
                        .tracking(-2)
                        .lineSpacing(16) // 64 - 48 = 16

                    Text("work for you→")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.brand500) // #FF9A6D
                        .tracking(-2)
                        .lineSpacing(16)
                }

                // Subtitle - Figma md-1/Regular 400
                // 14px Regular, #A6A6A6 (black200), line-height 20px
                Text("Rewards for trustworthy tenants\n& Free  protection for homeowners")
                    .font(Typography.bodyMd2) // 14px Regular
                    .foregroundColor(AppColors.black200) // #A6A6A6
                    .lineSpacing(6) // 20 - 14 = 6
                    .padding(.top, Spacing.md) // 16pt gap

                Spacer()

                // Get Started Button - Figma: gradient brand500→brand600
                PrimaryButton(title: "Get Started") {
                    coordinator.navigate(to: .phoneEntry(authIntent: .signup))
                }

                // Log in link - Figma: 14px white, "Log in" underlined
                Button(action: {
                    coordinator.navigate(to: .phoneEntry(authIntent: .login))
                }) {
                    HStack(spacing: 4) {
                        Text("Already a user?")
                            .foregroundColor(.white)
                        Text("Log in")
                            .foregroundColor(.white)
                            .underline()
                    }
                    .font(Typography.bodyMd2) // 14px Regular
                }
                .frame(maxWidth: .infinity)
                .padding(.top, Spacing.lg) // 24pt gap (sp-24)

                Spacer()
                    .frame(height: Spacing.huge) // 64pt bottom padding (scale/64)
            }
            .padding(.horizontal, Spacing.xxxl) // 48pt horizontal (sp-48)
        }
        .navigationBarHidden(true)
    }
}

// Note: FlentLogo, KeyholeShape, and DottedGridPattern are defined in
// Core/DesignSystem/Components/BackgroundPatterns.swift for shared access across screens

#Preview("Carousel Version") {
    SplashView()
        .environment(AppCoordinator())
}

#Preview("Static Version") {
    StaticSplashView()
        .environment(AppCoordinator())
}
