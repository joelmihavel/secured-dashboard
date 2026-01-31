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

// MARK: - Splash Assets
// Figma File: HZaVuwWn6B6jOjrmxZ7Kzv - Flent Secured v1.2 - Dev
// Note: Carousel background images are rendered using gradient shapes
// since Figma MCP URLs return HTTP 404

struct SplashAssets {
    // Get Started (1:28055)
    static let getStartedVector = "https://www.figma.com/api/mcp/asset/56cc29a5-d1b8-40e5-86af-cb8a5f66ca63"

    // Logo - Get Started (33.375×40pt)
    static let logoLarge = "https://www.figma.com/api/mcp/asset/3f279a10-b28d-4c5a-96b0-845b8d3dc49a"

    // Logo - Carousel (26.7×32pt)
    static let logoSmall = "https://www.figma.com/api/mcp/asset/07ad156f-a818-46d1-b124-7753a4b36571"
}

// MARK: - Carousel Background Shape
// Renders gradient-based abstract shapes for carousel backgrounds
// Replaces Figma MCP asset URLs that return HTTP 404
// Figma screens: 1:28985, 1:29025, 1:29065

struct CarouselBackgroundShape: View {
    let index: Int

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Base gradient layer - abstract curved shapes
                abstractShape(for: index, in: geometry.size)
            }
        }
    }

    @ViewBuilder
    private func abstractShape(for index: Int, in size: CGSize) -> some View {
        switch index {
        case 0:
            // Carousel 1: Warm orange gradient with curved wave
            ZStack {
                // Primary wave shape
                WaveShape(amplitude: 40, frequency: 1.5, phase: 0)
                    .fill(
                        LinearGradient(
                            colors: [
                                AppColors.brand500.opacity(0.6),
                                AppColors.brand400.opacity(0.3)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                // Secondary accent shape
                WaveShape(amplitude: 30, frequency: 2.0, phase: .pi / 4)
                    .fill(
                        LinearGradient(
                            colors: [
                                AppColors.brand600.opacity(0.4),
                                AppColors.brand500.opacity(0.2)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .offset(y: 40)
            }

        case 1:
            // Carousel 2: Softer gradient with organic blob
            ZStack {
                // Primary blob shape
                BlobShape(seed: 1)
                    .fill(
                        RadialGradient(
                            colors: [
                                AppColors.brand400.opacity(0.5),
                                AppColors.brand500.opacity(0.2),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 20,
                            endRadius: size.width * 0.6
                        )
                    )

                // Accent blob
                BlobShape(seed: 2)
                    .fill(
                        RadialGradient(
                            colors: [
                                AppColors.brand500.opacity(0.4),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 10,
                            endRadius: size.width * 0.4
                        )
                    )
                    .offset(x: 60, y: 30)
            }

        case 2:
            // Carousel 3: Dynamic gradient with angular shapes
            ZStack {
                // Primary angular shape
                AngularWaveShape(segments: 5, amplitude: 50)
                    .fill(
                        LinearGradient(
                            colors: [
                                AppColors.brand500.opacity(0.5),
                                AppColors.brand400.opacity(0.3),
                                AppColors.brand600.opacity(0.2)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                // Secondary wave overlay
                WaveShape(amplitude: 25, frequency: 1.2, phase: .pi / 2)
                    .fill(
                        LinearGradient(
                            colors: [
                                AppColors.brand400.opacity(0.3),
                                Color.clear
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .offset(y: 60)
            }

        default:
            Color.clear
        }
    }
}

// MARK: - Wave Shape

struct WaveShape: Shape {
    let amplitude: CGFloat
    let frequency: CGFloat
    let phase: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.width
        let height = rect.height
        let midHeight = height * 0.5

        path.move(to: CGPoint(x: 0, y: height))

        // Draw wave from left to right
        for x in stride(from: 0, through: width, by: 1) {
            let relativeX = x / width
            let sine = sin((relativeX * frequency * .pi * 2) + phase)
            let y = midHeight + (amplitude * sine)
            path.addLine(to: CGPoint(x: x, y: y))
        }

        // Close the shape
        path.addLine(to: CGPoint(x: width, y: height))
        path.closeSubpath()

        return path
    }
}

// MARK: - Blob Shape

struct BlobShape: Shape {
    let seed: Int

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let baseRadius = min(rect.width, rect.height) * 0.4
        let points = 8

        // Generate pseudo-random radii based on seed
        let radii: [CGFloat] = (0..<points).map { i in
            let variation = sin(Double(seed * 17 + i * 31)) * 0.3 + 0.85
            return baseRadius * variation
        }

        // Create smooth blob using cubic bezier curves
        for i in 0..<points {
            let angle = (CGFloat(i) / CGFloat(points)) * .pi * 2
            let nextAngle = (CGFloat((i + 1) % points) / CGFloat(points)) * .pi * 2
            let radius = radii[i]
            let nextRadius = radii[(i + 1) % points]

            let point = CGPoint(
                x: center.x + cos(angle) * radius,
                y: center.y + sin(angle) * radius
            )
            let nextPoint = CGPoint(
                x: center.x + cos(nextAngle) * nextRadius,
                y: center.y + sin(nextAngle) * nextRadius
            )

            if i == 0 {
                path.move(to: point)
            }

            // Control points for smooth curves
            let midAngle = (angle + nextAngle) / 2
            let controlRadius = (radius + nextRadius) / 2 * 1.1
            let control = CGPoint(
                x: center.x + cos(midAngle) * controlRadius,
                y: center.y + sin(midAngle) * controlRadius
            )

            path.addQuadCurve(to: nextPoint, control: control)
        }

        path.closeSubpath()
        return path
    }
}

// MARK: - Angular Wave Shape

struct AngularWaveShape: Shape {
    let segments: Int
    let amplitude: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.width
        let height = rect.height
        let segmentWidth = width / CGFloat(segments)

        path.move(to: CGPoint(x: 0, y: height))

        for i in 0..<segments {
            let startX = CGFloat(i) * segmentWidth
            let midX = startX + segmentWidth / 2
            let endX = startX + segmentWidth
            let peakY = height * 0.3 + (i % 2 == 0 ? amplitude : -amplitude * 0.5)

            path.addLine(to: CGPoint(x: midX, y: peakY))
            path.addLine(to: CGPoint(x: endX, y: height * 0.5))
        }

        path.addLine(to: CGPoint(x: width, y: height))
        path.closeSubpath()

        return path
    }
}

// MARK: - Beta Launch Badge
// Figma Node: 1-28071 (176:2752)
// Specs: bg=#FF9A6D, text=black, 12px Medium, px=8, py=4, radius=4

struct BetaLaunchBadge: View {
    var body: some View {
        Text("BETA LAUNCH")
            .font(Typography.bodySmMedium) // 12px Medium
            .tracking(-0.2) // Figma: letterSpacing -0.2px
            .foregroundColor(.black) // Figma: --colours/neutral/black
            .padding(.horizontal, Spacing.xs) // 8pt
            .padding(.vertical, Spacing.xxs) // 4pt
            .background(AppColors.brand500) // #FF9A6D
            .cornerRadius(Radius.xs) // 4px
    }
}

// MARK: - Splash Screen Mode

enum SplashScreenMode: Equatable, Hashable {
    case animation     // Logo + BETA badge centered (Figma 1:28071) - first launch only
    case getStarted    // First screen with button (Figma 1:28055)
    case carousel(Int) // Carousel screens 1-3 (Figma 1:28985, 1:29025, 1:29065)
}

// MARK: - Carousel Content

struct CarouselSlideContent: Equatable {
    let grayLines: String
    let brandLines: String
    let subtitle: String
    let backgroundIndex: Int? // Index for gradient background (0, 1, 2 for carousel slides)
    let brandFirst: Bool // If true, show orange text before gray text

    init(grayLines: String, brandLines: String, subtitle: String, backgroundIndex: Int? = nil, brandFirst: Bool = false) {
        self.grayLines = grayLines
        self.brandLines = brandLines
        self.subtitle = subtitle
        self.backgroundIndex = backgroundIndex
        self.brandFirst = brandFirst
    }
}

// MARK: - Splash Carousel View

struct SplashCarouselView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(\.scenePhase) private var scenePhase
    
    @State private var viewModel = SplashViewModel()
    @State private var currentMode: SplashScreenMode = .getStarted
    @State private var autoScrollTimer: Timer?
    
    /// Get Started screen content (Figma 1:28055)
    /// Layout: Gray text first ("Make\nyour rent"), then brand text ("work for you->")
    /// Arrow uses Unicode right arrow (U+2192) attached to text per Figma visual
    /// Figma exact text: "Make" (line 1), "your rent" (line 2), "work for you->" (line 3)
    /// Subtitle line break matches Figma rendering at 297pt width
    private let getStartedContent = CarouselSlideContent(
        grayLines: "Make\nyour rent",
        brandLines: "work for you\u{2192}",
        subtitle: "Secured is India's first rent payment app built\nto reward reliable tenants.",
        backgroundIndex: nil // Uses vector image separately
    )

    /// Carousel slides content (Figma 1:28985, 1:29025, 1:29065)
    /// Note: Carousel 1 has orange text FIRST, others have gray first
    private let carouselSlides: [CarouselSlideContent] = [
        // Carousel 1 - Figma 1:28985 (orange first, then gray)
        CarouselSlideContent(
            grayLines: "on your rent",
            brandLines: "Earn 1% back",
            subtitle: "For every timely payment made via UPI, netbanking or credit cards.",
            backgroundIndex: 0,
            brandFirst: true
        ),
        // Carousel 2 - Figma 1:29025 (gray first, then orange)
        CarouselSlideContent(
            grayLines: "More than",
            brandLines: "just cashback",
            subtitle: "Keep paying via Secured to unlock exclusive renting benefits over time",
            backgroundIndex: 1,
            brandFirst: false
        ),
        // Carousel 3 - Figma 1:29065 (gray first, then orange)
        CarouselSlideContent(
            grayLines: "Your landlord",
            brandLines: "benefits too",
            subtitle: "3 months of rent payments unlock a free vacancy cover for your landlord",
            backgroundIndex: 2,
            brandFirst: false
        )
    ]
    
    var body: some View {
        ZStack {
            // Background layer
            backgroundLayer

            // Animation mode: centered logo + badge (Figma 1:28071)
            if case .animation = currentMode {
                animationModeContent
            } else {
                // Content layer for getStarted and carousel modes
                VStack(alignment: .leading, spacing: 0) {
                    // For carousel screens: add top spacer for vertical centering
                    if case .carousel = currentMode {
                        Spacer()
                    }

                    // Top content: Logo + Text + Indicators
                    // Figma visual analysis: Logo to text gap is 40pt (Spacing.xxl)
                    VStack(alignment: .leading, spacing: Spacing.xxl) { // 40pt per Figma spec
                        logoView
                        textContent

                        if case .carousel(let index) = currentMode {
                            carouselDotIndicators(activeIndex: index)
                        }
                    }

                    Spacer()

                    // Bottom section (only visible for getStarted mode)
                    bottomSection
                }
                .padding(.horizontal, Spacing.xxxl) // 48pt
                .padding(.bottom, Spacing.huge) // 64pt (Figma: paddingBottom: 64.0)
                .padding(.top, topPaddingForMode) // Figma: carousel=80pt, getStarted=64pt
            }
        }
        .ignoresSafeArea()
        .navigationBarHidden(true)
        .animation(.easeInOut(duration: 0.3), value: currentMode) // Animate all content changes smoothly
        .onAppear {
            setupOnAppear()
        }
        .onDisappear {
            cleanup()
        }
        .onChange(of: scenePhase) { _, newPhase in
            handleScenePhaseChange(newPhase)
        }
        .gesture(
            DragGesture(minimumDistance: 50)
                .onEnded { value in
                    handleSwipe(value.translation.width)
                }
        )
    }

    // MARK: - Animation Mode Content (Figma 1:28071)

    @ViewBuilder
    private var animationModeContent: some View {
        VStack(spacing: Spacing.md) { // 16pt gap between logo and badge
            // Centered logo (33.375×40pt - same as getStarted)
            Image("flent-logo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 33.375, height: 40)
                .accessibilityHidden(true)

            // BETA LAUNCH badge
            BetaLaunchBadge()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .transition(.opacity)
    }
    
    // MARK: - Background Layer
    
    @ViewBuilder
    private var backgroundLayer: some View {
        ZStack {
            // Base background color (#131313)
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Background Shapes/Images
            Group {
                if case .getStarted = currentMode {
                    // Get Started Vector (Bottom Right) - F logo silhouette watermark
                    // Figma specs: Frame 333.75 x 400, positioned bottom-right with 120.56pt offset from right edge
                    // Using bundled asset as Figma MCP URL is not accessible
                    // Figma visual analysis: Watermark is extremely subtle, warm brown tones blending into #131313
                    GeometryReader { geometry in
                        Image("splash_background")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 333.75, height: 400)
                            .position(x: geometry.size.width - (333.75/2) + 120.56, y: geometry.size.height - (400/2))
                            .opacity(0.15) // Reduced from 0.25 to match Figma's very subtle watermark
                    }
                    .ignoresSafeArea()
                } else if case .carousel(let index) = currentMode, carouselSlides[index].backgroundIndex != nil {
                    // Carousel Background Shapes (Bottom Center)
                    // Figma: Very subtle warm-toned background shapes, barely visible
                    // Note: Original Figma MCP asset URLs return HTTP 404
                    GeometryReader { geometry in
                        ZStack {
                            // Abstract gradient shape matching Figma carousel backgrounds
                            // Figma: Shapes are extremely subtle - reduced opacity to 0.15
                            CarouselBackgroundShape(index: index)
                                .frame(width: 393, height: 400)
                                .opacity(0.15)

                            // Gradient Overlay - blends shapes into background
                            LinearGradient(
                                stops: [
                                    .init(color: AppColors.backgroundPrimary, location: 0.0),
                                    .init(color: AppColors.backgroundPrimary.opacity(0.8), location: 0.3),
                                    .init(color: .clear, location: 0.6)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        }
                        .frame(width: 393, height: 400)
                        .position(x: geometry.size.width / 2, y: geometry.size.height - (400/2) + 50)
                    }
                    .ignoresSafeArea()
                }
            }
            
            // Dotted grid pattern
            // Figma spec: 1.0pt dots, 8pt spacing, #7A6B5A at 0.2 opacity
            // The gradient mask creates the fade-to-bottom effect per Figma spec
            // Figma analysis: Dots visible in top ~60% of screen, fading gradually
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
    
    // MARK: - Mode Helpers

    /// Helper to check if current mode is any carousel slide
    private var isCarouselMode: Bool {
        if case .carousel = currentMode { return true }
        return false
    }

    /// Top padding varies between screen modes per Figma specs
    /// - Animation (1:28071): Content is centered, no top padding needed
    /// - Get Started (1:28055): Logo positioned ~150pt below status bar area
    ///   With ignoresSafeArea(), padding from screen top edge
    ///   Figma visual: Logo at approximately 18% down from screen top (852 * 0.18 = 153)
    /// - Carousel (1:28985+): Uses CENTER layout with paddingTop: 80pt
    private var topPaddingForMode: CGFloat {
        switch currentMode {
        case .animation:
            return 0 // Centered content, handled separately
        case .getStarted:
            return 150 // Figma visual: ~18% from top, adjusted for better pixel parity
        case .carousel:
            return 80 // Figma: paddingTop: 80.0 for carousel screens
        }
    }

    // MARK: - Top Bar

    /// Returns the appropriate logo size based on current mode
    /// - Get Started: 33.375×40pt (Figma 1:28055)
    /// - Carousel: 26.7×32pt (Figma 1:28985, 1:29025, 1:29065)
    private var logoSize: (width: CGFloat, height: CGFloat) {
        switch currentMode {
        case .animation, .getStarted:
            return (33.375, 40)
        case .carousel:
            return (26.7, 32)
        }
    }

    /// Returns the appropriate logo asset URL based on current mode
    private var logoUrl: String {
        switch currentMode {
        case .animation, .getStarted:
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
            case .animation, .getStarted:
                return getStartedContent
            case .carousel(let index):
                return carouselSlides[index]
            }
        }()

        VStack(alignment: .leading, spacing: Spacing.md) { // 16pt gap between headline and subtitle per Figma spec
            // Headline - H1: 48px, Regular, line-height 64px, tracking -2px
            // Handle brandFirst flag for proper text order
            Group {
                if content.brandFirst {
                    // Orange text first, then gray (Carousel 1)
                    (
                        Text(content.brandLines)
                            .foregroundColor(AppColors.brand500)
                        + Text(content.grayLines.isEmpty ? "" : "\n" + content.grayLines)
                            .foregroundColor(AppColors.black200) // #A6A6A6 per Figma spec
                    )
                } else {
                    // Gray text first, then orange (default)
                    (
                        Text(content.grayLines)
                            .foregroundColor(AppColors.black200) // #A6A6A6 per Figma spec
                        + Text(content.brandLines.isEmpty ? "" : "\n" + content.brandLines)
                            .foregroundColor(AppColors.brand500)
                    )
                }
            }
            .font(Typography.h1)
            .tracking(-2)
            .lineHeight(64, fontSize: 48) // Figma: H1 line-height 64px with 48px font
            .fixedSize(horizontal: false, vertical: true)

            // Subtitle - 14px, Regular, line-height 20px
            Text(content.subtitle)
                .font(Typography.bodyMd2)
                .lineHeight(20, fontSize: 14) // Figma: bodyMd2 line-height 20px with 14px font
                .foregroundColor(subtitleColor(for: currentMode))
                .fixedSize(horizontal: false, vertical: true)

            // Skip link - only visible in carousel mode (Figma parity fix)
            if case .carousel = currentMode {
                Button(action: {
                    viewModel.trackAnalyticsEvent(.getStartedTapped) // Skip action same as Get Started
                    stopAutoScroll()
                    coordinator.navigate(to: .phoneEntry(authIntent: .signup))
                }) {
                    HStack(spacing: 4) {
                        Text("Skip")
                            .foregroundColor(.white)
                        Text("→")
                            .foregroundColor(.white)
                    }
                    .font(Typography.bodyMd2)
                }
                .padding(.top, Spacing.lg) // 24pt gap from subtitle
                .accessibilityIdentifier("skip_link")
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabelForContent(content))
        .id(currentMode) // Force SwiftUI to treat each mode as a separate view for proper transitions
        .transition(.opacity.combined(with: .scale(scale: 0.98)))
    }

    /// Subtitle color - Figma uses black200 (#A6A6A6) consistently
    /// Per Figma screens: 1:28055 (Get Started), 1:28985, 1:29025, 1:29065 (Carousels)
    /// All carousel screens show consistent gray subtitle text
    private func subtitleColor(for mode: SplashScreenMode) -> Color {
        // Use black200 (#A6A6A6) consistently across all screens per Figma
        return AppColors.black200
    }    
    // MARK: - Bottom Section

    @ViewBuilder
    private var bottomSection: some View {
        switch currentMode {
        case .animation:
            // Animation screen has no bottom section (just centered logo + badge)
            EmptyView()
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
            // Button (centered) - using unified PrimaryButton with bar indicator
            PrimaryButton(
                title: "Get Started",
                showBarIndicator: true
            ) {
                viewModel.trackAnalyticsEvent(.getStartedTapped)
                stopAutoScroll()
                coordinator.navigate(to: .phoneEntry(authIntent: .signup))
            }
            .frame(width: 297) // Figma: w-297px
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
        // Ignore swipes during animation mode
        guard currentMode != .animation else { return }

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
            case .animation:
                currentMode = .getStarted
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
            case .animation, .getStarted:
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

        // Handle intro mode (first launch) - show animation screen
        if !viewModel.hasSeenIntro {
            currentMode = .animation
            // Transition to getStarted after animation duration
            DispatchQueue.main.asyncAfter(deadline: .now() + viewModel.introAnimationDuration) {
                withAnimation(.easeInOut(duration: 0.5)) {
                    currentMode = .getStarted
                }
                viewModel.markIntroSeen()
                startAutoScroll()
            }
        } else {
            currentMode = .getStarted
            startAutoScroll()
        }
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

// MARK: - Previews

#Preview("Splash - Animation (First Launch)") {
    SplashCarouselView()
        .environment(AppCoordinator())
        .onAppear {
            // Reset intro state to show animation
            UserDefaults.standard.removeObject(forKey: "hasSeenSplashIntroAnimation")
        }
}

#Preview("Splash - Get Started Screen") {
    SplashCarouselView()
        .environment(AppCoordinator())
}
