/// SplashView.swift
/// Flent Secured v2 - Splash/Get Started Screen
///
/// Figma: node-id=1:28055
/// - Background: #131313 with dotted grid pattern
/// - Logo: Flent keyhole icon, top-left
/// - Headline: "Make your rent" (white) + "work for you→" (orange)
/// - Subtitle: "Rewards for trustworthy tenants..."
/// - CTA: "Get Started" button
/// - Link: "Already a user? Log in"

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
                // Logo
                FlentLogo()
                    .padding(.top, Spacing.xxl)

                Spacer()
                    .frame(height: Spacing.huge)

                // Headline
                VStack(alignment: .leading, spacing: 0) {
                    Text("Make")
                        .font(.system(size: 40, weight: .light))
                        .foregroundColor(.white)
                    Text("your rent")
                        .font(.system(size: 40, weight: .light))
                        .foregroundColor(.white)
                    HStack(spacing: 0) {
                        Text("work for you")
                            .font(.system(size: 40, weight: .light))
                            .foregroundColor(AppColors.brand500)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 32, weight: .light))
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

                // Log in link
                Button(action: {
                    coordinator.navigate(to: .phoneEntry) // Same flow, different handling
                }) {
                    HStack(spacing: 4) {
                        Text("Already a user?")
                            .foregroundColor(AppColors.neutral500)
                        Text("Log in")
                            .foregroundColor(.white)
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

// MARK: - Flent Logo

struct FlentLogo: View {
    var size: CGFloat = 40

    var body: some View {
        // Keyhole "f" icon
        ZStack {
            // Main "f" shape with keyhole
            Image(systemName: "key.fill")
                .font(.system(size: size))
                .foregroundColor(.white)
                .rotationEffect(.degrees(-45))
        }
    }
}

// MARK: - Dotted Grid Pattern

struct DottedGridPattern: View {
    let dotSize: CGFloat = 2
    let spacing: CGFloat = 24

    var body: some View {
        GeometryReader { geometry in
            Canvas { context, size in
                let rows = Int(size.height / spacing)
                let cols = Int(size.width / spacing)

                for row in 0...rows {
                    for col in 0...cols {
                        let x = CGFloat(col) * spacing + spacing / 2
                        let y = CGFloat(row) * spacing + spacing / 2

                        let rect = CGRect(
                            x: x - dotSize / 2,
                            y: y - dotSize / 2,
                            width: dotSize,
                            height: dotSize
                        )

                        context.fill(
                            Circle().path(in: rect),
                            with: .color(AppColors.black400.opacity(0.3))
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
