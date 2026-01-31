/// OnboardingSlideView.swift
/// Flent Secured v2 - Reusable Onboarding Slide Component
///
/// Figma Nodes: 1-28985, 1-29025, 1-29065
/// Reusable component for carousel slides with:
/// - Two-tone headline (gray + orange or orange + gray)
/// - Subtitle text
/// - Skip link
/// - Page indicators
///
/// Design Specs from Figma:
/// - Background: #131313 with dotted grid + background shapes
/// - Logo: FlentLogo 26.7x32pt (smaller than splash)
/// - Headline: H1 (48px Regular, -2 tracking, 64px line-height)
/// - Subtitle: 14px Regular, line-height 20px
/// - Skip link: 14px Regular, white with arrow
/// - Horizontal padding: 48pt
/// - Top padding: 80pt (for centered layout)
/// - Page indicators: 8x8pt circles, brand500 active, black400 inactive

import SwiftUI

// MARK: - Onboarding Slide Data

struct OnboardingSlideData: Equatable, Identifiable {
    let id: Int
    let primaryText: String
    let secondaryText: String
    let subtitle: String
    let brandFirst: Bool
    let backgroundIndex: Int? // Index for CarouselBackgroundShape (0, 1, 2 for carousel slides)

    /// Subtitle text color - Figma uses black200 (#A6A6A6) consistently for carousel subtitles
    /// Per Figma screens 1-28985, 1-29025, 1-29065
    var subtitleColor: Color {
        AppColors.black200
    }
}

// MARK: - Onboarding Slide View

struct OnboardingSlideView: View {
    let slide: OnboardingSlideData
    let totalSlides: Int
    let currentIndex: Int
    let onSkip: () -> Void
    let onDotTap: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Content area - Figma: left-aligned, paddingTop 80pt for carousel screens
            VStack(alignment: .leading, spacing: Spacing.xxl) { // 40pt gap between major sections
                // Logo (26.7x32pt - smaller for carousel per Figma)
                FlentLogo(size: 26.7)

                // Text content block (headline + subtitle)
                textContent

                // Skip link - Figma: positioned after text with ~24pt gap
                skipLink
                    .padding(.top, Spacing.xs) // 8pt additional gap

                // Page indicators - Figma: left-aligned, 8x8pt dots with 8pt spacing
                pageIndicators
            }
            .padding(.top, 80) // Figma: paddingTop 80pt for carousel screens

            Spacer()
        }
        .padding(.horizontal, Spacing.xxxl) // 48pt horizontal padding per Figma
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    // MARK: - Text Content

    @ViewBuilder
    private var textContent: some View {
        VStack(alignment: .leading, spacing: Spacing.md) { // 16pt gap
            // Headline - H1 style with two-tone text
            headlineText
                .fixedSize(horizontal: false, vertical: true)

            // Subtitle
            Text(slide.subtitle)
                .font(Typography.bodyMd2) // 14px Regular
                .foregroundColor(slide.subtitleColor)
                .lineSpacing(6) // 20 - 14 = 6
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Headline Text

    @ViewBuilder
    private var headlineText: some View {
        Group {
            if slide.brandFirst {
                // Orange text first, then gray (Carousel 1 style)
                // Figma: brandFirst uses brand500 for primary, black200 (#A6A6A6) for secondary
                (
                    Text(slide.primaryText)
                        .foregroundColor(AppColors.brand500)
                    + Text("\n" + slide.secondaryText)
                        .foregroundColor(AppColors.black200)
                )
            } else {
                // Gray text first, then orange (Carousel 2, 3 style)
                // Figma: Uses black200 (#A6A6A6) for gray text, brand500 for orange
                (
                    Text(slide.primaryText)
                        .foregroundColor(AppColors.black200)
                    + Text("\n" + slide.secondaryText)
                        .foregroundColor(AppColors.brand500)
                )
            }
        }
        .font(Typography.h1)
        .tracking(-2)
        .lineSpacing(16) // 64 - 48 = 16
    }

    // MARK: - Skip Link
    // Figma: 14px Regular, white text, "Skip" followed by right arrow
    // Positioned with 24pt gap from subtitle per Figma spec

    @ViewBuilder
    private var skipLink: some View {
        Button(action: onSkip) {
            HStack(spacing: 4) {
                Text("Skip")
                    .foregroundColor(.white)
                Text("\u{2192}") // Right arrow (Unicode arrow matching Figma)
                    .foregroundColor(.white)
            }
            .font(Typography.bodyMd2) // 14px Regular
        }
        .accessibilityIdentifier("skip_link")
        .accessibilityLabel("Skip onboarding")
        .accessibilityHint("Double tap to skip to phone entry")
    }

    // MARK: - Page Indicators

    @ViewBuilder
    private var pageIndicators: some View {
        HStack(spacing: Spacing.xs) { // 8pt gap
            ForEach(0..<totalSlides, id: \.self) { index in
                Circle()
                    .fill(index == currentIndex ? AppColors.brand500 : AppColors.black400)
                    .frame(width: 8, height: 8)
                    .animation(.easeInOut(duration: 0.2), value: currentIndex)
                    .onTapGesture {
                        onDotTap(index)
                    }
            }
        }
        .accessibilityLabel("Page \(currentIndex + 1) of \(totalSlides)")
        .accessibilityHint("Swipe left or right to change slides")
    }

    // MARK: - Accessibility

    private var accessibilityLabel: String {
        let headline = slide.brandFirst
            ? "\(slide.primaryText) \(slide.secondaryText)"
            : "\(slide.primaryText) \(slide.secondaryText)"
        return "\(headline). \(slide.subtitle). Page \(currentIndex + 1) of \(totalSlides)"
    }
}

// MARK: - Slide Background View

/// Background component for onboarding slides
/// Handles the background shapes and gradients specific to each slide
/// Figma: Very subtle background with barely visible warm-toned organic shapes
struct OnboardingSlideBackground: View {
    let slide: OnboardingSlideData

    var body: some View {
        ZStack {
            // Base background color (#131313)
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Slide-specific background shape using gradient-based abstract shapes
            // Figma: Background shapes are VERY subtle - barely visible warm tones
            // Note: Original Figma MCP asset URLs return HTTP 404, using CarouselBackgroundShape instead
            if let bgIndex = slide.backgroundIndex {
                GeometryReader { geometry in
                    ZStack {
                        // Abstract gradient shape matching Figma carousel backgrounds
                        // Figma: Shapes are extremely subtle, reduced opacity to 0.15
                        CarouselBackgroundShape(index: bgIndex)
                            .frame(width: 393, height: 400)
                            .opacity(0.15) // Reduced from 0.4 to match Figma's subtle appearance

                        // Gradient overlay from top to blend into background
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
                    .position(
                        x: geometry.size.width / 2,
                        y: geometry.size.height - (400/2) + 50
                    )
                }
                .ignoresSafeArea()
            }

            // Dotted grid pattern with gradient mask
            // Figma: Very subtle dotted pattern, reduced opacity
            DottedGridPattern(dotOpacity: 0.12) // Reduced from default 0.2 for subtlety
                .mask(
                    LinearGradient(
                        colors: [.black, .black.opacity(0.4), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .ignoresSafeArea()
        }
    }
}

// MARK: - Preview Data

extension OnboardingSlideData {
    /// Preview slides matching Figma designs
    /// Note: Uses CarouselBackgroundShape indices instead of Figma MCP URLs (which return HTTP 404)
    static let previewSlides: [OnboardingSlideData] = [
        // Carousel 1 - Figma 1:28985 (brand first)
        OnboardingSlideData(
            id: 0,
            primaryText: "Earn 1% back",
            secondaryText: "on your rent",
            subtitle: "For every timely payment made via UPI, netbanking or credit cards.",
            brandFirst: true,
            backgroundIndex: 0
        ),
        // Carousel 2 - Figma 1:29025 (gray first)
        OnboardingSlideData(
            id: 1,
            primaryText: "More than",
            secondaryText: "just cashback",
            subtitle: "Keep paying via Secured to unlock exclusive renting benefits over time",
            brandFirst: false,
            backgroundIndex: 1
        ),
        // Carousel 3 - Figma 1:29065 (gray first)
        OnboardingSlideData(
            id: 2,
            primaryText: "Your landlord",
            secondaryText: "benefits too",
            subtitle: "3 months of rent payments unlock a free vacancy cover for your landlord",
            brandFirst: false,
            backgroundIndex: 2
        )
    ]
}

// MARK: - Previews

#Preview("Carousel Slide 1 - Earn 1% Back") {
    ZStack {
        OnboardingSlideBackground(slide: OnboardingSlideData.previewSlides[0])
        OnboardingSlideView(
            slide: OnboardingSlideData.previewSlides[0],
            totalSlides: 3,
            currentIndex: 0,
            onSkip: {},
            onDotTap: { _ in }
        )
    }
}

#Preview("Carousel Slide 2 - More Than Cashback") {
    ZStack {
        OnboardingSlideBackground(slide: OnboardingSlideData.previewSlides[1])
        OnboardingSlideView(
            slide: OnboardingSlideData.previewSlides[1],
            totalSlides: 3,
            currentIndex: 1,
            onSkip: {},
            onDotTap: { _ in }
        )
    }
}

#Preview("Carousel Slide 3 - Landlord Benefits") {
    ZStack {
        OnboardingSlideBackground(slide: OnboardingSlideData.previewSlides[2])
        OnboardingSlideView(
            slide: OnboardingSlideData.previewSlides[2],
            totalSlides: 3,
            currentIndex: 2,
            onSkip: {},
            onDotTap: { _ in }
        )
    }
}
