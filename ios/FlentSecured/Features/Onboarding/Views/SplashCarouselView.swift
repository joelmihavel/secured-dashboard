/// SplashCarouselView.swift
/// Flent Secured v2 - Splash Screen with Animated Carousel
///
/// Figma Node IDs:
/// - 1:28055 - Splash / get-started (First screen with Get Started button)
/// - 1:28071 - Splash / animation (Video intro - first launch only)
/// - 1:28985 - Splash / carousel 1 (Good Habits)
/// - 1:29025 - Splash / carousel 2 (Earn Everytime)
/// - 1:29065 - Splash / carousel 3 (It Gets Better)
///
/// Flow:
/// 1. Video Intro (first cold launch only) → 2. Get Started screen → 3. Three carousel slides → 4. Phone Entry

import SwiftUI
import AVKit

// MARK: - Splash Assets
// Figma File: HZaVuwWn6B6jOjrmxZ7Kzv - Flent Secured v1.2 - Dev

struct SplashAssets {
    // Get Started (1:28055)
    static let getStartedVector = "https://www.figma.com/api/mcp/asset/69a05ddf-32e3-4249-a3b6-8f607489c98f"

    // Carousel Backgrounds (1:28985, 1:29025, 1:29065)
    static let carousel1Bg = "https://www.figma.com/api/mcp/asset/bf441049-b9c8-456d-866e-38ea99d6d644"
    static let carousel2Bg = "https://www.figma.com/api/mcp/asset/b46c2604-a813-4aaa-9d7a-453eabff67ad"
    static let carousel3Bg = "https://www.figma.com/api/mcp/asset/142bbd39-30de-46f0-a1c1-e32535f2236f"

    // Logo - Get Started (33.375×40pt)
    static let logoLarge = "https://www.figma.com/api/mcp/asset/ff96cd49-5ad9-4817-a79c-9ee2cb83f62e"

    // Logo - Carousel (26.7×32pt)
    static let logoSmall = "https://www.figma.com/api/mcp/asset/a12947cb-dfad-4af5-8dc6-8beb0910909b"
}

// MARK: - Splash Screen Mode

enum SplashScreenMode: Equatable {
    case getStarted    // First screen with button (Figma 1:28055)
    case carousel(Int) // Carousel screens 1-3 (Figma 1:28985, 1:29025, 1:29065)
}

// MARK: - Carousel Content

struct CarouselSlideContent: Equatable {
    let grayLines: String
    let brandLines: String
    let subtitle: String
    let backgroundImageUrl: String?
}

// MARK: - Splash Carousel View

struct SplashCarouselView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(\.scenePhase) private var scenePhase
    
    @State private var viewModel = SplashViewModel()
    @StateObject private var videoPlayer = SplashVideoPlayer()
    @State private var currentMode: SplashScreenMode = .getStarted
    @State private var autoScrollTimer: Timer?
    
    /// Get Started screen content (Figma 1:28055)
    private let getStartedContent = CarouselSlideContent(
        grayLines: "Make\nyour rent",
        brandLines: "work for you→",
        subtitle: "Rewards for trustworthy tenants\n& Free protection for homeowners",
        backgroundImageUrl: nil // Uses vector image separately
    )
    
    /// Carousel slides content (Figma 1:28985, 1:29025, 1:29065)
    private let carouselSlides: [CarouselSlideContent] = [
        // Carousel 1 - Figma 1:28985
        CarouselSlideContent(
            grayLines: "Good\nHabits",
            brandLines: "Deserve\nRecognition",
            subtitle: "we make it worth it for you\nto pay your rent on time",
            backgroundImageUrl: SplashAssets.carousel1Bg
        ),
        // Carousel 2 - Figma 1:29025
        CarouselSlideContent(
            grayLines: "Earn\nEverytime",
            brandLines: "You Pay\nOn Time",
            subtitle: "Get 1% back on your rent when you pay\nthrough UPI, netbanking, or cards.",
            backgroundImageUrl: SplashAssets.carousel2Bg
        ),
        // Carousel 3 - Figma 1:29065
        CarouselSlideContent(
            grayLines: "It Gets\nBetter",
            brandLines: "With\nTime",
            subtitle: "Pay via Secured to unlock\nsmarter renting benefits.",
            backgroundImageUrl: SplashAssets.carousel3Bg
        )
    ]
    
    var body: some View {
        ZStack {
            // Background layer
            backgroundLayer

            // Content layer
            VStack(alignment: .leading, spacing: 0) {
                // Top content: Logo + Text + Indicators
                VStack(alignment: .leading, spacing: Spacing.xxl) { // 40pt
                    logoView
                    textContent

                    if case .carousel(let index) = currentMode {
                        carouselDotIndicators(activeIndex: index)
                    }
                }

                Spacer()

                // Bottom section
                bottomSection
            }
            .padding(.horizontal, Spacing.xxxl) // 48pt
            .padding(.bottom, Spacing.huge) // 64pt
            .padding(.top, Spacing.huge) // 64pt from safe area
        }
        .ignoresSafeArea()
        .navigationBarHidden(true)
        .onAppear {
            setupOnAppear()
        }
        .onDisappear {
            cleanup()
        }
        .onChange(of: scenePhase) { _, newPhase in
            handleScenePhaseChange(newPhase)
        }
        .onChange(of: videoPlayer.isReady) { _, isReady in
            if isReady {
                viewModel.videoDidBecomeReady()
                videoPlayer.play()
            }
        }
        .onChange(of: videoPlayer.didFail) { _, didFail in
            if didFail {
                viewModel.videoDidFail()
            }
        }
        .gesture(
            DragGesture(minimumDistance: 50)
                .onEnded { value in
                    handleSwipe(value.translation.width)
                }
        )
    }
    
    // MARK: - Background Layer
    
    @ViewBuilder
    private var backgroundLayer: some View {
        ZStack {
            // Base background color (#131313)
            AppColors.backgroundPrimary
                .ignoresSafeArea()
            
            // Video background (if available and should show)
            if viewModel.shouldShowVideo && videoPlayer.isReady {
                VideoPlayerView(player: videoPlayer.player)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }
            
            // Background Shapes/Images
            Group {
                if case .getStarted = currentMode {
                    // Get Started Vector (Bottom Right)
                    GeometryReader { geometry in
                        AsyncImage(url: URL(string: SplashAssets.getStartedVector)) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                        } placeholder: {
                            Color.clear
                        }
                        .frame(width: 333.75, height: 400)
                        .position(x: geometry.size.width - (333.75/2) + 120.56, y: geometry.size.height - (400/2))
                    }
                    .ignoresSafeArea()
                } else if case .carousel(let index) = currentMode, let bgUrl = carouselSlides[index].backgroundImageUrl {
                    // Carousel Background Shapes (Bottom Center)
                    GeometryReader { geometry in
                        ZStack {
                            AsyncImage(url: URL(string: bgUrl)) { image in
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                            } placeholder: {
                                Color.clear
                            }
                            .frame(width: 393, height: 331)
                            .opacity(0.4)
                            
                            // Gradient Overlay (from Figma)
                            // bg-gradient-to-b from-[#131313] to-[rgba(0,0,0,0)]
                            LinearGradient(
                                stops: [
                                    .init(color: AppColors.backgroundPrimary, location: 0.0),
                                    .init(color: .clear, location: 0.397)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        }
                        .frame(width: 393, height: 331)
                        .position(x: geometry.size.width / 2, y: geometry.size.height - (331/2) + 27)
                    }
                    .ignoresSafeArea()
                }
            }
            
            // Dotted grid pattern
            DottedGridPattern()
                .opacity(viewModel.shouldShowVideo && videoPlayer.isReady ? 0.6 : 0.4)
                .mask(
                    LinearGradient(
                        colors: [.black, .black.opacity(0.2), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .ignoresSafeArea()
        }
    }
    
    // MARK: - Mode Helpers

    /// Helper to check if current mode is any carousel slide
    private var isCarouselMode: Bool {
        if case .carousel = currentMode { return true }
        return false
    }

    // MARK: - Top Bar

    /// Returns the appropriate logo size based on current mode
    /// - Get Started: 33.375×40pt (Figma 1:28055)
    /// - Carousel: 26.7×32pt (Figma 1:28985, 1:29025, 1:29065)
    private var logoSize: (width: CGFloat, height: CGFloat) {
        switch currentMode {
        case .getStarted:
            return (33.375, 40)
        case .carousel:
            return (26.7, 32)
        }
    }

    /// Returns the appropriate logo asset URL based on current mode
    private var logoUrl: String {
        switch currentMode {
        case .getStarted:
            return SplashAssets.logoLarge
        case .carousel:
            return SplashAssets.logoSmall
        }
    }

    // MARK: - Logo View

    /// Flent logo from bundled asset
    /// Get Started: 33.375×40pt, Carousel: 26.7×32pt
    @ViewBuilder
    private var logoView: some View {
        Image("flent-logo")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: logoSize.width, height: logoSize.height)
            .accessibilityHidden(true)
    }

    // MARK: - Text Content

    /// Text container with headline and subtitle
    /// Figma: 16pt gap between headline and subtitle
    @ViewBuilder
    private var textContent: some View {
        let content: CarouselSlideContent = {
            switch currentMode {
            case .getStarted:
                return getStartedContent
            case .carousel(let index):
                return carouselSlides[index]
            }
        }()

        VStack(alignment: .leading, spacing: Spacing.md) { // 16pt
            // Headline - H1: 48px, Regular, line-height 64px, tracking -2px
            (
                Text(content.grayLines)
                    .foregroundColor(AppColors.neutral500)
                + Text(content.brandLines.isEmpty ? "" : "\n" + content.brandLines)
                    .foregroundColor(AppColors.brand500)
            )
            .font(Typography.h1)
            .tracking(-2)
            .lineSpacing(16)
            .fixedSize(horizontal: false, vertical: true)

            // Subtitle - 14px, Regular, line-height 20px
            Text(content.subtitle)
                .font(Typography.bodyMd2)
                .lineSpacing(6)
                .foregroundColor(subtitleColor(for: currentMode))
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabelForContent(content))
    }

    /// Subtitle color varies between screens
    /// - Get Started (1:28055): #A6A6A6 (black/200)
    /// - Carousel 1 (1:28985): #A6A6A6 (black/200)
    /// - Carousel 2-3 (1:29025, 1:29065): #A9A9A9 (neutral/500)
    private func subtitleColor(for mode: SplashScreenMode) -> Color {
        switch mode {
        case .getStarted, .carousel(0):
            return AppColors.black200 // #A6A6A6
        case .carousel:
            return AppColors.neutral500 // #A9A9A9
        }
    }    
    // MARK: - Bottom Section

    @ViewBuilder
    private var bottomSection: some View {
        switch currentMode {
        case .getStarted:
            // Get Started screen: bar indicator + button + login link (Figma 1:28055)
            getStartedBottomSection
        case .carousel:
            // Carousel screens have no bottom buttons, indicators are in content area
            EmptyView()
        }
    }

    // MARK: - Carousel Content with Indicators

    /// Carousel screens show the page indicators below the subtitle text
    /// Figma: Gap between subtitle and indicators is sp-40 (40pt)
    @ViewBuilder
    private var carouselContentWithIndicators: some View {
        if case .carousel(let index) = currentMode {
            carouselDotIndicators(activeIndex: index)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
    
    // MARK: - Get Started Bottom Section
    // Figma node 1:28068: items-center (CENTER aligned), gap-24px, px-48px

    @ViewBuilder
    private var getStartedBottomSection: some View {
        VStack(spacing: Spacing.lg) { // 24pt gap
            // Button (centered)
            SplashGetStartedButton(title: "Get Started") {
                viewModel.trackAnalyticsEvent(.getStartedTapped)
                stopAutoScroll()
                coordinator.navigate(to: .phoneEntry(authIntent: .signup))
            }
            .accessibilityIdentifier("get_started_button")

            // Login link (centered)
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
        .frame(maxWidth: .infinity) // Figma: items-center requires full width container
    }
    
    // MARK: - Carousel Dot Indicators

    /// 3 dot page indicators for carousel screens
    /// Active: brand500, Inactive: black400, Size: 8×8pt, Gap: 8pt
    @ViewBuilder
    private func carouselDotIndicators(activeIndex: Int) -> some View {
        HStack(spacing: Spacing.xs) { // 8pt
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(index == activeIndex ? AppColors.brand500 : AppColors.black400)
                    .frame(width: 8, height: 8)
                    .animation(.easeInOut(duration: 0.2), value: activeIndex)
                    .onTapGesture {
                        goToCarouselSlide(index)
                    }
            }
        }
        .accessibilityLabel("Page \(activeIndex + 1) of 3")
        .accessibilityHint("Swipe left or right to change slides")
    }
    
    // MARK: - Navigation
    
    private func handleSwipe(_ translation: CGFloat) {
        let threshold: CGFloat = 50
        
        if translation < -threshold {
            // Swipe left → go forward
            goToNextScreen()
        } else if translation > threshold {
            // Swipe right → go back
            goToPreviousScreen()
        }
        
        resetAutoScrollTimer()
    }
    
    private func goToNextScreen() {
        withAnimation(.easeInOut(duration: 0.3)) {
            switch currentMode {
            case .getStarted:
                currentMode = .carousel(0)
            case .carousel(let index):
                if index < 2 {
                    currentMode = .carousel(index + 1)
                }
                // At last carousel, user must tap to proceed
            }
        }
    }
    
    private func goToPreviousScreen() {
        withAnimation(.easeInOut(duration: 0.3)) {
            switch currentMode {
            case .getStarted:
                break // Can't go back from first screen
            case .carousel(let index):
                if index > 0 {
                    currentMode = .carousel(index - 1)
                } else {
                    currentMode = .getStarted
                }
            }
        }
    }
    
    private func goToCarouselSlide(_ index: Int) {
        guard index >= 0 && index < 3 else { return }
        withAnimation(.easeInOut(duration: 0.3)) {
            currentMode = .carousel(index)
        }
    }
    
    // MARK: - Accessibility
    
    private func accessibilityLabelForContent(_ content: CarouselSlideContent) -> String {
        let headline = content.grayLines.replacingOccurrences(of: "\n", with: " ") +
                       " " +
                       content.brandLines.replacingOccurrences(of: "\n", with: " ")
        let subtitle = content.subtitle.replacingOccurrences(of: "\n", with: " ")
        return "\(headline). \(subtitle)"
    }
    
    // MARK: - Lifecycle
    
    private func setupOnAppear() {
        viewModel.trackAnalyticsEvent(.splashViewed)
        
        // Setup video player if we should show video
        if viewModel.shouldShowVideo {
            videoPlayer.setup(timeoutMs: viewModel.videoLoadTimeout)
        }
        
        // Handle intro mode (first launch)
        if viewModel.mode == .introAnimation {
            DispatchQueue.main.asyncAfter(deadline: .now() + viewModel.introAnimationDuration) {
                viewModel.completeIntro()
                startAutoScroll()
            }
        } else {
            startAutoScroll()
        }
    }
    
    private func cleanup() {
        stopAutoScroll()
        videoPlayer.cleanup()
    }
    
    private func handleScenePhaseChange(_ phase: ScenePhase) {
        switch phase {
        case .active:
            if viewModel.shouldShowVideo && videoPlayer.isReady {
                videoPlayer.play()
            }
            startAutoScroll()
        case .background, .inactive:
            videoPlayer.pause()
            stopAutoScroll()
        @unknown default:
            break
        }
    }
    
    // MARK: - Auto-scroll
    
    private func startAutoScroll() {
        stopAutoScroll()
        autoScrollTimer = Timer.scheduledTimer(withTimeInterval: viewModel.autoScrollInterval, repeats: true) { _ in
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

// MARK: - Splash Get Started Button

/// Get Started button with bar indicator - Figma node 1:28069
/// Figma specs (exact from design context):
/// - Outer wrapper: w-297px, rounded-12px, gap-8px, items-center, p-0
/// - Bar: 24×2px, #4D4D4D (black/400), rounded-200px
/// - Button body: gradient #202020→#0D0D0D@90.179%, p-16px, rounded-8px
/// - Border: 0.1px solid #FF9A6D (brand/500)
/// - Shadow: 0px 6px 12px -2px rgba(153,92,65,0.24)
/// - Inner shadows: inset -2px -4px 0px 1px black, inset 0px -3px 4px 1px rgba(255,255,255,0.12)
struct SplashGetStartedButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.shared.mediumImpact()
            action()
        }) {
            VStack(spacing: 8) { // Figma: gap-8px
                // Bar indicator - Figma: 24×2px, #4D4D4D, rounded-200px
                Capsule()
                    .fill(AppColors.black400)
                    .frame(width: 24, height: 2)

                // Main button body - Figma node I1:28069;100:1564
                ZStack {
                    // Background gradient - Figma: from #202020 to #0D0D0D at 90.179%
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

                    // Inner shadow layer 1: inset -2px -4px 0px 1px black
                    // Creates dark edge effect at bottom-right corner
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.black, lineWidth: 1)
                        .blur(radius: 0.5)
                        .offset(x: -2, y: -4)
                        .mask(RoundedRectangle(cornerRadius: 8))

                    // Inner shadow layer 2: inset 0px -3px 4px 1px rgba(255,255,255,0.12)
                    // White glow at bottom for 3D depth
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.white.opacity(0.12), lineWidth: 2)
                        .blur(radius: 4)
                        .offset(x: 0, y: -3)
                        .mask(RoundedRectangle(cornerRadius: 8))

                    // Text - Figma: 16px Medium, white, centered
                    Text(title)
                        .font(Typography.bodyMdMedium)
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 56) // Figma: p-16 = 16 + 24 (line-height) + 16 = 56px
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    // Border - Figma: 0.1px solid #FF9A6D
                    // Note: 0.1px is extremely subtle, using 0.5px for visibility on Retina
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(AppColors.brand500, lineWidth: 0.5)
                )
                .shadow(
                    // Figma: 0px 6px 12px -2px rgba(153,92,65,0.24)
                    // Note: SwiftUI shadow radius = blur/2, no spread support
                    color: Color(red: 0.60, green: 0.36, blue: 0.25).opacity(0.24),
                    radius: 6,
                    y: 6
                )
            }
            .frame(width: 297) // Figma: w-297px
        }
        .buttonStyle(PressableButtonStyle())
    }
}

// MARK: - Video Player View

/// UIViewRepresentable wrapper for AVPlayerLayer
struct VideoPlayerView: UIViewRepresentable {
    let player: AVPlayer?
    
    func makeUIView(context: Context) -> VideoPlayerUIView {
        let view = VideoPlayerUIView()
        view.player = player
        return view
    }
    
    func updateUIView(_ uiView: VideoPlayerUIView, context: Context) {
        uiView.player = player
    }
}

/// UIView subclass that hosts an AVPlayerLayer
final class VideoPlayerUIView: UIView {
    var player: AVPlayer? {
        get { playerLayer.player }
        set { playerLayer.player = newValue }
    }
    
    override class var layerClass: AnyClass {
        AVPlayerLayer.self
    }
    
    private var playerLayer: AVPlayerLayer {
        layer as! AVPlayerLayer
    }
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupPlayerLayer()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupPlayerLayer()
    }
    
    private func setupPlayerLayer() {
        playerLayer.videoGravity = .resizeAspectFill
        backgroundColor = .clear
    }
}

// MARK: - Previews

#Preview("Splash - Get Started Screen") {
    SplashCarouselView()
        .environment(AppCoordinator())
}
