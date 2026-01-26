/// SplashView.swift
/// Flent Secured v2 - Splash/Get Started Screen
///
/// States handled:
/// - .initial: Logo animation + Get Started button
///
/// Figma: Splash / get-started

import SwiftUI

struct SplashView: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        ZStack {
            // Background
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: Spacing.xxl) {
                Spacer()

                // Logo
                VStack(spacing: Spacing.md) {
                    Image(systemName: "house.fill")
                        .font(.system(size: 80))
                        .foregroundColor(AppColors.accentPrimary)

                    Text("Flent")
                        .font(Typography.h1)
                        .foregroundColor(AppColors.textPrimary)
                }

                Spacer()

                // Get Started Button
                PrimaryButton(title: "Get Started") {
                    coordinator.navigate(to: .phoneEntry)
                }
                .screenPadding()

                Spacer()
                    .frame(height: Spacing.xxl)
            }
        }
        .navigationBarHidden(true)
    }
}

#Preview {
    SplashView()
        .environment(AppCoordinator())
}
