/// SplashView.swift
/// Flent Secured v2 - Splash/Get Started Screen
///
/// Figma: node-id=1:28055
/// - Background: #131313 with dotted grid pattern
/// - Logo: Flent keyhole icon, top-left, white
/// - Headline: "Make your rent" (white) + "work for you->" (orange #FF9A6D)
/// - Subtitle: "Rewards for trustworthy tenants..."
/// - CTA: "Get Started" button with outer border padding
/// - Link: "Already a user? Log in" - 14px, neutral, underlined

import SwiftUI

struct SplashView: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        ZStack {
            // Background with dotted pattern
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern overlay
            DottedGridPattern()
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Logo - Flent keyhole icon
                FlentLogo()
                    .padding(.top, Spacing.xxl)

                Spacer()
                    .frame(height: Spacing.huge)

                // Headline - "Make your rent" (white) + "work for you->" (orange)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Make your rent")
                        .font(.system(size: 40, weight: .light))
                        .foregroundColor(.white)

                    HStack(spacing: 0) {
                        Text("work for you")
                            .font(.system(size: 40, weight: .light))
                            .foregroundColor(AppColors.brand500)
                        Text("\u{2192}") // Unicode right arrow
                            .font(.system(size: 40, weight: .light))
                            .foregroundColor(AppColors.brand500)
                    }
                }

                // Subtitle
                Text("Rewards for trustworthy tenants\n& Free protection for homeowners")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                    .padding(.top, Spacing.md)

                Spacer()

                // Get Started Button
                PrimaryButton(title: "Get Started") {
                    coordinator.navigate(to: .phoneEntry)
                }

                // Log in link - entire text neutral, "Log in" underlined
                Button(action: {
                    coordinator.navigate(to: .phoneEntry) // Same flow, different handling
                }) {
                    HStack(spacing: 4) {
                        Text("Already a user?")
                            .foregroundColor(AppColors.neutral500)
                        Text("Log in")
                            .foregroundColor(AppColors.neutral500)
                            .underline()
                    }
                    .font(.system(size: 14, weight: .regular))
                }
                .frame(maxWidth: .infinity)
                .padding(.top, Spacing.md)

                Spacer()
                    .frame(height: Spacing.xl)
            }
            .padding(.horizontal, Spacing.screenHorizontal) // 40px
        }
        .navigationBarHidden(true)
    }
}

// MARK: - Flent Logo (Keyhole "f" Icon)

/// Custom Flent keyhole logo drawn with SwiftUI
/// Represents the Flent brand - a stylized keyhole shape
struct FlentLogo: View {
    var size: CGFloat = 40

    var body: some View {
        // Keyhole shape: circle on top, triangle/trapezoid on bottom
        ZStack {
            // Outer keyhole shape
            KeyholeShape()
                .fill(Color.white)
                .frame(width: size, height: size * 1.2)
        }
    }
}

/// Custom keyhole shape for Flent logo
struct KeyholeShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()

        let width = rect.width
        let height = rect.height

        // Circle portion (top 60% of height)
        let circleRadius = width * 0.4
        let circleCenter = CGPoint(x: width / 2, y: circleRadius + (height * 0.05))

        // Keyhole notch dimensions
        let notchWidth = width * 0.25
        let notchTop = circleCenter.y + circleRadius * 0.3
        let notchBottom = height

        // Draw the circle
        path.addArc(
            center: circleCenter,
            radius: circleRadius,
            startAngle: .degrees(0),
            endAngle: .degrees(360),
            clockwise: false
        )

        // Draw the keyhole notch (trapezoid shape extending down)
        let notchPath = Path { p in
            // Start from left side of notch at top
            p.move(to: CGPoint(x: (width - notchWidth) / 2, y: notchTop))
            // Bottom left (slightly wider)
            p.addLine(to: CGPoint(x: (width - notchWidth * 1.3) / 2, y: notchBottom))
            // Bottom right
            p.addLine(to: CGPoint(x: (width + notchWidth * 1.3) / 2, y: notchBottom))
            // Top right
            p.addLine(to: CGPoint(x: (width + notchWidth) / 2, y: notchTop))
            p.closeSubpath()
        }

        path.addPath(notchPath)

        return path
    }
}

// MARK: - Dotted Grid Pattern

/// Background dotted grid pattern overlay
/// Figma: Subtle dot pattern on #131313 background
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
    }
}

#Preview {
    SplashView()
        .environment(AppCoordinator())
}
