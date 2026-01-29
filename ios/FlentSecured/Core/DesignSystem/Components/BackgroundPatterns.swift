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
/// - Dot size: 1.5pt
/// - Spacing: 20pt grid
/// - Color: black400 at 40% opacity
struct DottedGridPattern: View {
    let dotSize: CGFloat = 1.5
    let spacing: CGFloat = 20

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
                            with: .color(AppColors.black400.opacity(0.4))
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
