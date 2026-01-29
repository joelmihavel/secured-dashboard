/// PostApprovalView.swift
/// Flent Secured v2 - Post Approval Onboarding Carousel
///
/// Figma Node IDs:
/// - 41:10712 - Post approval 1 (Welcome/Approved)
/// - 41:10859 - Post approval 2 (Credit Score benefit)
/// - 41:11006 - Post approval 3 (Cashback benefit)
///
/// PIXEL PERFECT from Figma:
/// - Background: #131313 with dotted grid pattern
/// - Header: H1/Regular 400 (48px, tracking -2px)
///   - State-specific two-color headlines
/// - Page indicators: 6x6 circles, brand500 active, black400 inactive
/// - Horizontal padding: 48pt (sp-48)
///
/// Design Specifications:
/// - 3-step carousel with swipe navigation
/// - Gradient badge for approval
/// - Benefit cards with icons
/// - Skip button on first 2 screens
/// - "Let's get started" CTA on final screen

import SwiftUI

// MARK: - Post Approval Container (Carousel)

struct PostApprovalView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var currentPage: Int = 0
    @State private var showContent = false

    private let totalPages = 3

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            DottedGridPattern()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Skip button (visible on pages 0 and 1)
                HStack {
                    Spacer()
                    if currentPage < totalPages - 1 {
                        Button("Skip") {
                            withAnimation(.easeInOut(duration: 0.3)) {
                                currentPage = totalPages - 1
                            }
                        }
                        .font(Typography.buttonSmall)
                        .foregroundColor(AppColors.textSecondary)
                        .padding(.trailing, Spacing.lg)
                    }
                }
                .frame(height: 44)
                .padding(.top, Spacing.md)

                // Tab View Carousel
                TabView(selection: $currentPage) {
                    PostApprovalPage1()
                        .tag(0)

                    PostApprovalPage2()
                        .tag(1)

                    PostApprovalPage3()
                        .tag(2)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut(duration: 0.3), value: currentPage)

                // Page Indicators
                pageIndicators
                    .padding(.bottom, Spacing.lg)

                // Action Button
                actionButton
                    .padding(.horizontal, Spacing.xxxl) // 48pt horizontal (sp-48)
                    .padding(.bottom, Spacing.xl)
            }
        }
        .navigationBarHidden(true)
        .onAppear {
            withAnimation(.easeOut(duration: 0.6).delay(0.2)) {
                showContent = true
            }
        }
    }

    // MARK: - Page Indicators

    private var pageIndicators: some View {
        HStack(spacing: Spacing.xs) {
            ForEach(0..<totalPages, id: \.self) { index in
                Circle()
                    .fill(index == currentPage ? AppColors.brand500 : AppColors.black400)
                    .frame(width: 6, height: 6)
                    .animation(.easeInOut(duration: 0.2), value: currentPage)
            }
        }
    }

    // MARK: - Action Button

    private var actionButton: some View {
        PrimaryButton(
            title: currentPage == totalPages - 1 ? "Let's get started" : "Next"
        ) {
            if currentPage < totalPages - 1 {
                withAnimation(.easeInOut(duration: 0.3)) {
                    currentPage += 1
                }
            } else {
                // Navigate to pending steps
                coordinator.navigate(to: .pendingSteps)
            }
        }
    }
}

// MARK: - Page 1: Welcome/Approved (Figma: 41:10712)

private struct PostApprovalPage1: View {
    @State private var animateRings = false
    @State private var animateBadge = false

    var body: some View {
        VStack(spacing: Spacing.xl) {
            Spacer()

            // Animated Approval Badge
            ZStack {
                // Outer pulsing rings
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .stroke(
                            AppColors.brand500.opacity(0.15 - Double(index) * 0.04),
                            lineWidth: 2
                        )
                        .frame(
                            width: 160 + CGFloat(index * 30),
                            height: 160 + CGFloat(index * 30)
                        )
                        .scaleEffect(animateRings ? 1.05 : 0.95)
                        .animation(
                            .easeInOut(duration: 2.0)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * 0.2),
                            value: animateRings
                        )
                }

                // Main badge
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [AppColors.brand400, AppColors.brand500],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 140, height: 140)
                        .shadow(color: AppColors.brand500.opacity(0.4), radius: 30, x: 0, y: 15)

                    VStack(spacing: Spacing.xs) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 48, weight: .bold))
                            .foregroundColor(.white)

                        Text("APPROVED")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.white.opacity(0.9))
                            .tracking(2)
                    }
                }
                .scaleEffect(animateBadge ? 1 : 0.8)
                .opacity(animateBadge ? 1 : 0)
            }

            // Headlines - Figma: H1/Regular 400 with two-color format
            VStack(alignment: .leading, spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Welcome to")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.neutral500) // #A9A9A9
                        .tracking(-2)
                        .lineSpacing(16)
                    Text("Flent!")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.brand500) // #FF9A6D
                        .tracking(-2)
                        .lineSpacing(16)
                }

                Text("You're now part of a community of trustworthy tenants who earn rewards for paying rent on time.")
                    .font(Typography.bodyMd2) // 14px Regular
                    .foregroundColor(AppColors.black200) // #A6A6A6
                    .lineSpacing(6)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.xxxl) // 48pt horizontal

            Spacer()
            Spacer()
        }
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7).delay(0.1)) {
                animateBadge = true
            }
            animateRings = true
        }
    }
}

// MARK: - Page 2: Credit Score (Figma: 41:10859)

private struct PostApprovalPage2: View {
    @State private var animateChart = false
    @State private var animateContent = false

    var body: some View {
        VStack(spacing: Spacing.xl) {
            Spacer()

            // Credit Score Illustration
            ZStack {
                // Background circle
                Circle()
                    .fill(AppColors.backgroundSecondary)
                    .frame(width: 200, height: 200)

                // Credit gauge
                CreditScoreGauge(animateProgress: animateChart)
                    .frame(width: 160, height: 160)

                // Score value
                VStack(spacing: 2) {
                    Text("750")
                        .font(.system(size: 40, weight: .bold))
                        .foregroundColor(AppColors.success)
                        .opacity(animateChart ? 1 : 0)

                    Text("Excellent")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppColors.textSecondary)
                        .opacity(animateChart ? 1 : 0)
                }
            }
            .scaleEffect(animateContent ? 1 : 0.9)
            .opacity(animateContent ? 1 : 0)

            // Headlines
            VStack(spacing: Spacing.sm) {
                Text("Build Your Credit Score")
                    .font(Typography.h3)
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)

                Text("Every on-time rent payment is reported to credit bureaus, helping you build a stronger credit history.")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .padding(.horizontal, Spacing.lg)
            }
            .opacity(animateContent ? 1 : 0)
            .offset(y: animateContent ? 0 : 20)

            // Feature highlights
            HStack(spacing: Spacing.lg) {
                FeatureChip(icon: "chart.line.uptrend.xyaxis", text: "Track progress")
                FeatureChip(icon: "bell.badge", text: "Due reminders")
            }
            .opacity(animateContent ? 1 : 0)
            .offset(y: animateContent ? 0 : 10)

            Spacer()
            Spacer()
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.6).delay(0.2)) {
                animateContent = true
            }
            withAnimation(.easeOut(duration: 1.0).delay(0.4)) {
                animateChart = true
            }
        }
    }
}

// MARK: - Page 3: Cashback (Figma: 41:11006)

private struct PostApprovalPage3: View {
    @State private var animateCoins = false
    @State private var animateContent = false

    var body: some View {
        VStack(spacing: Spacing.xl) {
            Spacer()

            // Cashback Illustration
            ZStack {
                // Floating coins animation
                ForEach(0..<5, id: \.self) { index in
                    CashbackCoin(index: index, animate: animateCoins)
                }

                // Central rupee badge
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color(hex: "FFD700"), Color(hex: "FFA500")],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 100, height: 100)
                        .shadow(color: Color(hex: "FFD700").opacity(0.4), radius: 20, x: 0, y: 10)

                    Text("1%")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(AppColors.black700)
                }
                .scaleEffect(animateContent ? 1 : 0.8)
            }
            .frame(height: 200)
            .opacity(animateContent ? 1 : 0)

            // Headlines
            VStack(spacing: Spacing.sm) {
                Text("Earn Cashback")
                    .font(Typography.h3)
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)

                Text("Get up to 1% cashback on every rent payment. The more you pay on time, the more you earn.")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .padding(.horizontal, Spacing.lg)
            }
            .opacity(animateContent ? 1 : 0)
            .offset(y: animateContent ? 0 : 20)

            // Cashback tiers preview
            HStack(spacing: Spacing.sm) {
                CashbackTierChip(tier: "0.5%", label: "Standard")
                CashbackTierChip(tier: "0.75%", label: "Regular", isHighlighted: true)
                CashbackTierChip(tier: "1%", label: "Premium")
            }
            .opacity(animateContent ? 1 : 0)
            .offset(y: animateContent ? 0 : 10)

            Spacer()
            Spacer()
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.6).delay(0.2)) {
                animateContent = true
            }
            animateCoins = true
        }
    }
}

// MARK: - Credit Score Gauge

private struct CreditScoreGauge: View {
    let animateProgress: Bool

    var body: some View {
        ZStack {
            // Background arc
            Circle()
                .trim(from: 0, to: 0.75)
                .stroke(AppColors.black400, lineWidth: 12)
                .rotationEffect(.degrees(135))

            // Progress arc
            Circle()
                .trim(from: 0, to: animateProgress ? 0.65 : 0)
                .stroke(
                    LinearGradient(
                        colors: [AppColors.error, AppColors.warning, AppColors.success],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: 12, lineCap: .round)
                )
                .rotationEffect(.degrees(135))
                .animation(.easeOut(duration: 1.5), value: animateProgress)
        }
    }
}

// MARK: - Feature Chip

private struct FeatureChip: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: Spacing.xxs) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundColor(AppColors.brand500)

            Text(text)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppColors.textSecondary)
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.pill)
    }
}

// MARK: - Cashback Coin

private struct CashbackCoin: View {
    let index: Int
    let animate: Bool

    private var offset: CGSize {
        let angle = Double(index) * (360.0 / 5.0) * .pi / 180.0
        let radius: Double = 80
        return CGSize(
            width: CGFloat(cos(angle) * radius),
            height: CGFloat(sin(angle) * radius)
        )
    }

    private var delay: Double {
        Double(index) * 0.1
    }

    var body: some View {
        Circle()
            .fill(
                LinearGradient(
                    colors: [Color(hex: "FFE066"), Color(hex: "FFD700")],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .frame(width: 24, height: 24)
            .overlay(
                Text("R")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(Color(hex: "996600"))
            )
            .offset(offset)
            .scaleEffect(animate ? 1 : 0)
            .opacity(animate ? 0.8 : 0)
            .animation(
                .spring(response: 0.5, dampingFraction: 0.6)
                    .delay(delay),
                value: animate
            )
    }
}

// MARK: - Cashback Tier Chip

private struct CashbackTierChip: View {
    let tier: String
    let label: String
    var isHighlighted: Bool = false

    var body: some View {
        VStack(spacing: Spacing.xxxs) {
            Text(tier)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(isHighlighted ? AppColors.brand500 : AppColors.textPrimary)

            Text(label)
                .font(.system(size: 10, weight: .regular))
                .foregroundColor(AppColors.textMuted)
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .background(isHighlighted ? AppColors.brand500.opacity(0.1) : AppColors.backgroundSecondary)
        .cornerRadius(Radius.sm)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.sm)
                .stroke(isHighlighted ? AppColors.brand500 : Color.clear, lineWidth: 1)
        )
    }
}

// MARK: - Legacy Views (For backwards compatibility)

struct PostApprovalStep1View: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        PostApprovalView()
            .environment(coordinator)
    }
}

struct PostApprovalStep2View: View {
    @Environment(AppCoordinator.self) private var coordinator

    var body: some View {
        PostApprovalView()
            .environment(coordinator)
    }
}

// MARK: - Previews

#Preview("Post Approval Carousel") {
    PostApprovalView()
        .environment(AppCoordinator())
}

#Preview("Page 1 - Welcome") {
    ZStack {
        AppColors.backgroundPrimary.ignoresSafeArea()
        PostApprovalPage1()
    }
}

#Preview("Page 2 - Credit Score") {
    ZStack {
        AppColors.backgroundPrimary.ignoresSafeArea()
        PostApprovalPage2()
    }
}

#Preview("Page 3 - Cashback") {
    ZStack {
        AppColors.backgroundPrimary.ignoresSafeArea()
        PostApprovalPage3()
    }
}
