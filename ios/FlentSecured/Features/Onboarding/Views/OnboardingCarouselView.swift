/// OnboardingCarouselView.swift
/// Flent Secured v2 - Onboarding Carousel Container
///
/// Figma Nodes: 1-28055, 1-28985, 1-29025, 1-29065
/// Container view that manages:
/// - Get Started splash screen
/// - Swipeable carousel of onboarding slides
/// - Auto-scroll behavior
/// - Navigation to phone entry
///
/// Flow:
/// 1. Get Started screen (1-28055) -> swipe or tap to carousel
/// 2. Carousel slides (1-28985, 1-29025, 1-29065) -> swipe through or skip
/// 3. Phone Entry (1-29108)

import SwiftUI

// MARK: - Carousel Mode

enum OnboardingCarouselMode: Equatable, Hashable {
    case splash          // Initial "Get Started" screen
    case carousel(Int)   // Carousel slides 0-2
}

// MARK: - Onboarding Carousel View

struct OnboardingCarouselView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(\.scenePhase) private var scenePhase

    @State private var viewModel = SplashViewModel()
    @State private var currentMode: OnboardingCarouselMode = .splash
    @State private var autoScrollTimer: Timer?

    // Carousel slides data
    private let slides = OnboardingSlideData.previewSlides

    var body: some View {
        ZStack {
            // Background layer (changes based on mode)
            backgroundForCurrentMode
                .animation(.easeInOut(duration: 0.3), value: currentMode)

            // Content layer
            contentForCurrentMode
                .animation(.easeInOut(duration: 0.3), value: currentMode)
        }
        .ignoresSafeArea()
        .navigationBarHidden(true)
        .gesture(swipeGesture)
        .onAppear {
            setupOnAppear()
        }
        .onDisappear {
            cleanup()
        }
        .onChange(of: scenePhase) { _, newPhase in
            handleScenePhaseChange(newPhase)
        }
    }

    // MARK: - Background for Mode

    @ViewBuilder
    private var backgroundForCurrentMode: some View {
        switch currentMode {
        case .splash:
            splashBackground

        case .carousel(let index):
            OnboardingSlideBackground(slide: slides[index])
        }
    }

    // MARK: - Splash Background
    // Figma Node 1:28055 - Get Started background

    @ViewBuilder
    private var splashBackground: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Background vector image - very subtle watermark
            // Figma: Warm brown tones blending into #131313
            GeometryReader { geometry in
                Image("splash_background")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 333.75, height: 400)
                    .position(
                        x: geometry.size.width - (333.75/2) + 120.56,
                        y: geometry.size.height - (400/2)
                    )
                    .opacity(0.15) // Very subtle per Figma
            }
            .ignoresSafeArea()

            // Dotted grid pattern with gradient mask
            // Figma: Dots visible in top ~60%, fading gradually
            DottedGridPattern()
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: .black, location: 0.0),
                            .init(color: .black.opacity(0.8), location: 0.3),
                            .init(color: .black.opacity(0.4), location: 0.5),
                            .init(color: .black.opacity(0.1), location: 0.65),
                            .init(color: .clear, location: 0.75)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .ignoresSafeArea()
        }
    }

    // MARK: - Content for Mode

    @ViewBuilder
    private var contentForCurrentMode: some View {
        switch currentMode {
        case .splash:
            splashContent
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
                .id("splash") // Force distinct identity for animation

        case .carousel(let index):
            OnboardingSlideView(
                slide: slides[index],
                totalSlides: slides.count,
                currentIndex: index,
                onSkip: { navigateToPhoneEntry() },
                onDotTap: { goToSlide($0) }
            )
            .transition(.opacity.combined(with: .scale(scale: 0.98)))
            .id("carousel-\(index)") // Force distinct identity for animation
        }
    }

    // MARK: - Splash Content
    // Figma Node 1:28055 - Get Started screen

    @ViewBuilder
    private var splashContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Top content area
            VStack(alignment: .leading, spacing: Spacing.xxl) { // 40pt gap
                // Logo (33.375x40pt per Figma)
                FlentLogo(size: 33.375)

                // Text content
                VStack(alignment: .leading, spacing: Spacing.md) { // 16pt gap
                    // Headline - gray first, then orange per Figma
                    // Uses black200 (#A6A6A6) for gray text
                    (
                        Text("Make\nyour rent")
                            .foregroundColor(AppColors.black200)
                        + Text("\nwork for you\u{2192}")
                            .foregroundColor(AppColors.brand500)
                    )
                    .font(Typography.h1)
                    .tracking(-2)
                    .lineSpacing(16) // 64 - 48 = 16
                    .fixedSize(horizontal: false, vertical: true)

                    // Subtitle - black200 per Figma
                    Text("Secured is India's first rent payment app built to reward reliable tenants.")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.black200)
                        .lineSpacing(6) // 20 - 14 = 6
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.top, 205) // Figma: 205pt from top

            Spacer()

            // Bottom buttons - center aligned per Figma
            VStack(spacing: Spacing.lg) { // 24pt gap
                // Get Started button (297pt width per Figma)
                PrimaryButton(
                    title: "Get Started",
                    showBarIndicator: true
                ) {
                    viewModel.trackAnalyticsEvent(.getStartedTapped)
                    stopAutoScroll()
                    navigateToPhoneEntry()
                }
                .frame(width: 297)
                .accessibilityIdentifier("get_started_button")

                // Login link - white text with underlined "Log in"
                Button(action: {
                    viewModel.trackAnalyticsEvent(.loginTapped)
                    stopAutoScroll()
                    coordinator.navigate(to: .phoneEntry(authIntent: .login))
                }) {
                    HStack(spacing: 0) {
                        Text("Already a user? ")
                            .foregroundColor(.white)
                        Text("Log in")
                            .foregroundColor(.white)
                            .underline()
                    }
                    .font(Typography.bodyMd2)
                }
                .accessibilityIdentifier("login_link")
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, Spacing.xxxl) // 48pt
        .padding(.bottom, Spacing.huge) // 64pt
    }

    // MARK: - Swipe Gesture

    private var swipeGesture: some Gesture {
        DragGesture(minimumDistance: 50)
            .onEnded { value in
                handleSwipe(value.translation.width)
            }
    }

    // MARK: - Navigation Helpers

    private func handleSwipe(_ translation: CGFloat) {
        let threshold: CGFloat = 50

        if translation < -threshold {
            // Swipe left -> go forward
            goToNextScreen()
        } else if translation > threshold {
            // Swipe right -> go back
            goToPreviousScreen()
        }

        resetAutoScrollTimer()
    }

    private func goToNextScreen() {
        withAnimation(.easeInOut(duration: 0.3)) {
            switch currentMode {
            case .splash:
                currentMode = .carousel(0)

            case .carousel(let index):
                if index < slides.count - 1 {
                    currentMode = .carousel(index + 1)
                }
                // At last carousel slide, user must tap to proceed
            }
        }
    }

    private func goToPreviousScreen() {
        withAnimation(.easeInOut(duration: 0.3)) {
            switch currentMode {
            case .splash:
                break // Can't go back from first screen

            case .carousel(let index):
                if index > 0 {
                    currentMode = .carousel(index - 1)
                } else {
                    currentMode = .splash
                }
            }
        }
    }

    private func goToSlide(_ index: Int) {
        guard index >= 0 && index < slides.count else { return }
        withAnimation(.easeInOut(duration: 0.3)) {
            currentMode = .carousel(index)
        }
        resetAutoScrollTimer()
    }

    private func navigateToPhoneEntry() {
        stopAutoScroll()
        coordinator.navigate(to: .phoneEntry(authIntent: .signup))
    }

    // MARK: - Lifecycle

    private func setupOnAppear() {
        viewModel.trackAnalyticsEvent(.splashViewed)
        startAutoScroll()
    }

    private func cleanup() {
        stopAutoScroll()
    }

    private func handleScenePhaseChange(_ phase: ScenePhase) {
        switch phase {
        case .active:
            startAutoScroll()
        case .background, .inactive:
            stopAutoScroll()
        @unknown default:
            break
        }
    }

    // MARK: - Auto-scroll

    private func startAutoScroll() {
        stopAutoScroll()
        autoScrollTimer = Timer.scheduledTimer(
            withTimeInterval: viewModel.autoScrollInterval,
            repeats: true
        ) { _ in
            goToNextScreen()
        }
    }

    private func stopAutoScroll() {
        autoScrollTimer?.invalidate()
        autoScrollTimer = nil
    }

    private func resetAutoScrollTimer() {
        stopAutoScroll()
        startAutoScroll()
    }
}

// MARK: - Previews

#Preview("Onboarding Carousel - Splash") {
    OnboardingCarouselView()
        .environment(AppCoordinator())
}

#Preview("Onboarding Carousel - Full Flow") {
    struct PreviewWrapper: View {
        @State private var coordinator = AppCoordinator()

        var body: some View {
            NavigationStack(path: $coordinator.path) {
                OnboardingCarouselView()
                    .navigationDestination(for: Route.self) { route in
                        switch route {
                        case .phoneEntry:
                            Text("Phone Entry Screen")
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                                .background(AppColors.backgroundPrimary)
                        default:
                            EmptyView()
                        }
                    }
            }
            .environment(coordinator)
        }
    }
    return PreviewWrapper()
}
