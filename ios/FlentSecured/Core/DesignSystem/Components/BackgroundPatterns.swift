/// BackgroundPatterns.swift
/// Flent Secured v2 - Shared Background Pattern Components
///
/// Contains reusable background patterns used throughout the app
/// Extracted from SplashCarouselView for shared access
///
/// Figma: Background patterns used on onboarding and main screens

import SwiftUI

// MARK: - Dotted Grid Pattern

/// A dotted grid pattern overlay used as background texture
/// Figma: Used on splash, phone entry, OTP, and other screens
/// - Dot size: 1.0pt
/// - Spacing: 8pt grid
/// - Color: muted warm brown #7A6B5A at 0.2 opacity
///
/// Usage:
/// - Use default opacity (0.2) and do NOT apply additional .opacity() modifier
/// - For custom opacity, pass the `dotOpacity` parameter directly
/// - For custom dot color, pass the `dotColor` parameter
struct DottedGridPattern: View {
    let dotSize: CGFloat
    let spacing: CGFloat
    let dotOpacity: Double
    let dotColor: Color

    /// Initialize with configurable parameters
    /// - Parameters:
    ///   - dotSize: Size of each dot in points (default: 1.0 per Figma spec)
    ///   - spacing: Grid spacing between dots in points (default: 8pt per Figma spec)
    ///   - dotOpacity: Opacity of dots from 0.0 to 1.0 (default: 0.2 per Figma spec)
    ///   - dotColor: Color of dots (default: muted warm brown #7A6B5A per Figma spec)
    init(
        dotSize: CGFloat = 1.0,
        spacing: CGFloat = 8,
        dotOpacity: Double = 0.2,
        dotColor: Color = Color(hex: "7A6B5A")
    ) {
        self.dotSize = dotSize
        self.spacing = spacing
        self.dotOpacity = dotOpacity
        self.dotColor = dotColor
    }

    var body: some View {
        GeometryReader { geometry in
            Canvas { context, size in
                let rows = Int(size.height / spacing) + 1
                let cols = Int(size.width / spacing) + 1

                for row in 0...rows {
                    for col in 0...cols {
                        let x = CGFloat(col) * spacing
                        let y = CGFloat(row) * spacing

                        let rect = CGRect(
                            x: x - dotSize / 2,
                            y: y - dotSize / 2,
                            width: dotSize,
                            height: dotSize
                        )

                        context.fill(
                            Circle().path(in: rect),
                            with: .color(dotColor.opacity(dotOpacity))
                        )
                    }
                }
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Flent Logo

/// Flent brand logo - uses bundled asset
/// Figma: Used on splash, phone entry, and other onboarding screens
/// Sizes: 33.375×40pt (Get Started) or 26.7×32pt (Carousel)
struct FlentLogo: View {
    var size: CGFloat = 33.375

    /// Computed height based on Figma aspect ratio (33.375:40 = 0.834)
    private var height: CGFloat { size * 1.2 }

    var body: some View {
        Image("flent-logo")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: size, height: height)
    }
}

// MARK: - Keyhole Shape (Fallback)

/// Simple keyhole shape - fallback if logo asset not available
struct KeyholeShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()

        let width = rect.width
        let height = rect.height

        let circleRadius = width * 0.4
        let circleCenter = CGPoint(x: width / 2, y: circleRadius + (height * 0.05))

        let notchWidth = width * 0.25
        let notchTop = circleCenter.y + circleRadius * 0.3
        let notchBottom = height

        // Main circle
        path.addArc(
            center: circleCenter,
            radius: circleRadius,
            startAngle: .degrees(0),
            endAngle: .degrees(360),
            clockwise: false
        )

        // Notch extending down
        let notchPath = Path { p in
            p.move(to: CGPoint(x: (width - notchWidth) / 2, y: notchTop))
            p.addLine(to: CGPoint(x: (width - notchWidth * 1.3) / 2, y: notchBottom))
            p.addLine(to: CGPoint(x: (width + notchWidth * 1.3) / 2, y: notchBottom))
            p.addLine(to: CGPoint(x: (width + notchWidth) / 2, y: notchTop))
            p.closeSubpath()
        }

        path.addPath(notchPath)

        return path
    }
}

// MARK: - Gradient Background

/// Standard app gradient background
/// Used for screens that need a gradient rather than solid color
struct GradientBackground: View {
    var colors: [Color] = [AppColors.black700, AppColors.black600]
    var startPoint: UnitPoint = .top
    var endPoint: UnitPoint = .bottom

    var body: some View {
        LinearGradient(
            gradient: Gradient(colors: colors),
            startPoint: startPoint,
            endPoint: endPoint
        )
        .ignoresSafeArea()
    }
}

// MARK: - Standard Screen Background

/// Standard screen background with optional dotted pattern
/// Combines solid color background with optional dotted grid overlay
struct ScreenBackground: View {
    var showDottedPattern: Bool = true
    var backgroundColor: Color = AppColors.backgroundPrimary

    var body: some View {
        ZStack {
            backgroundColor
                .ignoresSafeArea()

            if showDottedPattern {
                DottedGridPattern()
                    .ignoresSafeArea()
            }
        }
    }
}

// MARK: - Hola Decorative Text

/// Decorative "Hola!" text flourish for onboarding screens
/// Figma: Top-right decorative element on phone entry screen
/// - Uses handwritten/script style font
/// - Brand orange color with semi-transparency
/// - Rotated at an angle for visual interest
/// - Positioned absolutely in top-right corner
struct HolaDecorativeText: View {
    /// Size of the text (default based on Figma proportions)
    var fontSize: CGFloat = 72

    /// Opacity of the decorative element (0.0 to 1.0)
    var textOpacity: Double = 0.35

    /// Rotation angle in degrees
    var rotation: Double = -15

    /// The decorative text color
    var textColor: Color = AppColors.brand500

    var body: some View {
        Text("Hola!")
            .font(.custom("Snell Roundhand", size: fontSize))
            .fontWeight(.bold)
            .foregroundColor(textColor)
            .opacity(textOpacity)
            .rotationEffect(.degrees(rotation))
            .accessibilityHidden(true) // Decorative element
    }
}

/// Container view that positions the Hola decorative element in the top-right
/// Use this in a ZStack to overlay on screen backgrounds
struct HolaDecorativeOverlay: View {
    /// Horizontal offset from trailing edge
    var trailingOffset: CGFloat = 24

    /// Vertical offset from top safe area
    var topOffset: CGFloat = 80

    var body: some View {
        GeometryReader { geometry in
            HolaDecorativeText()
                .position(
                    x: geometry.size.width - trailingOffset - 40,
                    y: topOffset + 40
                )
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Previews

#Preview("Dotted Grid Pattern") {
    ZStack {
        Color(hex: "131313")
            .ignoresSafeArea()
        DottedGridPattern()
            .ignoresSafeArea()
    }
}

#Preview("Flent Logo") {
    ZStack {
        Color(hex: "131313")
            .ignoresSafeArea()
        VStack(spacing: 32) {
            FlentLogo(size: 32)
            FlentLogo(size: 40)
            FlentLogo(size: 64)
        }
    }
}

#Preview("Screen Background") {
    ScreenBackground(showDottedPattern: true)
}

#Preview("Hola Decorative Text") {
    ZStack {
        Color(hex: "131313")
            .ignoresSafeArea()
        DottedGridPattern()
            .ignoresSafeArea()
        HolaDecorativeOverlay()
    }
}

#Preview("Hola Decorative - Phone Entry Style") {
    ZStack {
        Color(hex: "131313")
            .ignoresSafeArea()
        DottedGridPattern()
            .ignoresSafeArea()
        HolaDecorativeOverlay(trailingOffset: 0, topOffset: 60)

        VStack(alignment: .leading, spacing: 0) {
            FlentLogo()
                .padding(.top, 40)

            Spacer().frame(height: 40)

            Text("Let's get to")
                .font(.system(size: 48, weight: .regular))
                .foregroundColor(Color(hex: "A9A9A9"))
            Text("know you")
                .font(.system(size: 48, weight: .regular))
                .foregroundColor(Color(hex: "FF9A6D"))

            Spacer()
        }
        .padding(.horizontal, 48)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
