/// LoadingView.swift
/// Flent Secured v2 - Loading View Components
///
/// Various loading states and indicators

import SwiftUI

// MARK: - Full Screen Loading

struct LoadingView: View {
    var message: String? = nil

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: Spacing.md) {
                ProgressView()
                    .tint(AppColors.accentPrimary)
                    .scaleEffect(1.5)

                if let message = message {
                    Text(message)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                }
            }
        }
    }
}

// MARK: - Inline Loading

struct InlineLoadingView: View {
    var message: String = "Loading..."

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ProgressView()
                .tint(AppColors.accentPrimary)

            Text(message)
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.lg)
    }
}

// MARK: - Dots Loading Animation

struct DotsLoadingView: View {
    @State private var animatingDots = [false, false, false]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(AppColors.accentPrimary)
                    .frame(width: 8, height: 8)
                    .scaleEffect(animatingDots[index] ? 1.0 : 0.5)
                    .opacity(animatingDots[index] ? 1.0 : 0.3)
            }
        }
        .onAppear {
            for index in 0..<3 {
                withAnimation(
                    .easeInOut(duration: 0.6)
                    .repeatForever()
                    .delay(Double(index) * 0.2)
                ) {
                    animatingDots[index] = true
                }
            }
        }
    }
}

// MARK: - Skeleton Loading

struct SkeletonView: View {
    var height: CGFloat = 20
    var cornerRadius: CGFloat = Radius.xs

    @State private var phase: CGFloat = 0

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(AppColors.backgroundSecondary)
            .frame(height: height)
            .overlay(
                GeometryReader { geometry in
                    LinearGradient(
                        gradient: Gradient(colors: [
                            .clear,
                            AppColors.backgroundElevated.opacity(0.5),
                            .clear
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geometry.size.width * 0.7)
                    .offset(x: -geometry.size.width * 0.35 + phase * geometry.size.width * 1.35)
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

// MARK: - Skeleton Card

struct SkeletonCard: View {
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: Spacing.md) {
                    SkeletonView(height: 44, cornerRadius: 22)
                        .frame(width: 44)

                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        SkeletonView(height: 16)
                            .frame(width: 120)
                        SkeletonView(height: 12)
                            .frame(width: 80)
                    }

                    Spacer()
                }

                SkeletonView(height: 14)
                SkeletonView(height: 14)
                    .frame(width: 200)
            }
        }
    }
}

// MARK: - Pull to Refresh Loading

struct RefreshLoadingView: View {
    var body: some View {
        VStack(spacing: Spacing.sm) {
            ProgressView()
                .tint(AppColors.accentPrimary)

            Text("Refreshing...")
                .font(Typography.caption)
                .foregroundColor(AppColors.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.md)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        LoadingView(message: "Loading your data...")
            .frame(height: 150)

        InlineLoadingView()

        DotsLoadingView()

        SkeletonView(height: 20)

        SkeletonCard()
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}
