/// OnboardingSplashView.swift
/// Flent Secured v2 - Main Splash Screen with Get Started
///
/// Figma Node: 1-28055
/// First screen user sees with "Make your rent work for you" headline
/// Contains: Get Started button + "Already a user? Log in" link
///
/// Design Specs from Figma:
/// - Background: #131313 with dotted grid pattern
/// - Logo: FlentLogo 33.375x40pt
/// - Headline: H1 (48px Regular, -2 tracking, 64px line-height)
///   - "Make\nyour rent" - neutral500 (#A9A9A9)
///   - "work for you->" - brand500 (#FF9A6D)
/// - Subtitle: 14px Regular, neutral500, line-height 20px
/// - Horizontal padding: 48pt
/// - Top padding: 205pt from screen top
/// - Bottom padding: 64pt

import SwiftUI

// MARK: - Onboarding Splash View

struct OnboardingSplashView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @State private var viewModel = SplashViewModel()

    // Animation states
    @State private var showContent = false
    @State private var showButtons = false

    var body: some View {
        ZStack {
            // Background
            backgroundLayer

            // Content
            VStack(alignment: .leading, spacing: 0) {
                // Top content area
                VStack(alignment: .leading, spacing: Spacing.xxl) { // 40pt gap
                    // Logo (33.375x40pt)
                    FlentLogo(size: 33.375)
                        .opacity(showContent ? 1 : 0)
                        .offset(y: showContent ? 0 : -10)

                    // Text content
                    VStack(alignment: .leading, spacing: Spacing.md) { // 16pt gap
                        // Headline - H1 style
                        headlineText
                            .opacity(showContent ? 1 : 0)
                            .offset(y: showContent ? 0 : 20)

                        // Subtitle
                        Text("Secured is India's first rent payment app built to reward reliable tenants.")
                            .font(Typography.bodyMd2) // 14px Regular
                            .foregroundColor(AppColors.neutral500)
                            .lineSpacing(6) // 20 - 14 = 6
                            .fixedSize(horizontal: false, vertical: true)
                            .opacity(showContent ? 1 : 0)
                            .offset(y: showContent ? 0 : 20)
                    }
                }
                .padding(.top, 205) // Figma: 205pt from top

                Spacer()

                // Bottom section with buttons
                bottomButtons
                    .opacity(showButtons ? 1 : 0)
                    .offset(y: showButtons ? 0 : 30)
            }
            .padding(.horizontal, Spacing.xxxl) // 48pt horizontal padding
            .padding(.bottom, Spacing.huge) // 64pt bottom padding
        }
        .ignoresSafeArea()
        .navigationBarHidden(true)
        .onAppear {
            // Animate content in
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.1)) {
                showContent = true
            }
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.3)) {
                showButtons = true
            }
            viewModel.trackAnalyticsEvent(.splashViewed)
        }
    }

    // MARK: - Background Layer

    @ViewBuilder
    private var backgroundLayer: some View {
        ZStack {
            // Base background color (#131313)
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Background vector image (positioned bottom-right)
            GeometryReader { geometry in
                AsyncImage(url: URL(string: SplashAssets.getStartedVector)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                } placeholder: {
                    Color.clear
                }
                .frame(width: 333.75, height: 400)
                .position(
                    x: geometry.size.width - (333.75/2) + 120.56,
                    y: geometry.size.height - (400/2)
                )
            }
            .ignoresSafeArea()

            // Dotted grid pattern with gradient mask
            // Note: DottedGridPattern has internal 0.4 opacity - do NOT add external .opacity()
            DottedGridPattern()
                .mask(
                    LinearGradient(
                        colors: [.black, .black.opacity(0.5), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .ignoresSafeArea()
        }
    }

    // MARK: - Headline Text

    @ViewBuilder
    private var headlineText: some View {
        // H1: 48px, Regular 400, line-height 64px, tracking -2px
        (
            Text("Make\nyour rent")
                .foregroundColor(AppColors.neutral500)
            + Text("\nwork for you\u{2192}")
                .foregroundColor(AppColors.brand500)
        )
        .font(Typography.h1)
        .tracking(-2)
        .lineSpacing(16) // 64 - 48 = 16
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Bottom Buttons

    @ViewBuilder
    private var bottomButtons: some View {
        VStack(spacing: Spacing.lg) { // 24pt gap
            // Get Started button with bar indicator
            PrimaryButton(
                title: "Get Started",
                showBarIndicator: true
            ) {
                viewModel.trackAnalyticsEvent(.getStartedTapped)
                coordinator.navigate(to: .phoneEntry(authIntent: .signup))
            }
            .frame(width: 297) // Figma: w-297px
            .accessibilityIdentifier("get_started_button")

            // Login link
            Button(action: {
                viewModel.trackAnalyticsEvent(.loginTapped)
                coordinator.navigate(to: .phoneEntry(authIntent: .login))
            }) {
                HStack(spacing: 0) {
                    Text("Already a user? ")
                        .foregroundColor(.white)
                    Text("Log in")
                        .foregroundColor(.white)
                        .underline()
                }
                .font(Typography.bodyMd2) // 14px
            }
            .accessibilityIdentifier("login_link")
        }
        .frame(maxWidth: .infinity) // Center the buttons
    }
}

// MARK: - Previews

#Preview("Onboarding Splash") {
    OnboardingSplashView()
        .environment(AppCoordinator())
}
