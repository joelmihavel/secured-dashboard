/// HomeZeroStateFigmaView.swift
/// Pixel-perfect implementation of Figma node 41:4569 "Home --Empty State"
///
/// This view is built component-by-component from Figma design context
/// to achieve pixel-level parity with the design.

import SwiftUI

// MARK: - Main Home Zero State View

struct HomeZeroStateFigmaView: View {
    // MARK: - Visual Testing Mode
    /// When true, uses exact Figma mock data for pixel-perfect comparison
    var isVisualTestMode: Bool = true

    // MARK: - Figma Reference Dimensions (393pt design width)
    private let figmaDesignWidth: CGFloat = 393

    // ViewModel for dynamic data (only used when not in visual test mode)
    @State private var viewModel = HomeViewModel()

    // Timer for countdown
    @State private var countdownSeconds: Int = 28 * 3600 + 12 * 60 + 12 // 28:12:12

    // MARK: - Mock Data (Figma exact values for visual testing)
    private struct FigmaMockData {
        static let userName = "Rishabh"
        static let daysUntilDue = 10
        static let rentAmount = "32,500"
        static let daysInFooter = 28
    }

    // Computed properties - use mock data in test mode
    private var userName: String {
        guard !isVisualTestMode else { return FigmaMockData.userName }
        let name = viewModel.firstName
        return (name.isEmpty || name == "there") ? FigmaMockData.userName : name
    }

    private var daysUntilDue: Int {
        guard !isVisualTestMode else { return FigmaMockData.daysUntilDue }
        return viewModel.daysUntilDue == 0 ? FigmaMockData.daysUntilDue : viewModel.daysUntilDue
    }

    private var rentAmountValue: String {
        guard !isVisualTestMode else { return FigmaMockData.rentAmount }
        let amount = viewModel.rentAmount.replacingOccurrences(of: "₹", with: "").trimmingCharacters(in: .whitespaces)
        return (amount.isEmpty || amount == "0") ? FigmaMockData.rentAmount : amount
    }

    // Countdown formatted as HH:MM:SS
    private var countdownFormatted: String {
        let hours = countdownSeconds / 3600
        let minutes = (countdownSeconds % 3600) / 60
        let seconds = countdownSeconds % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }

    var body: some View {
        ZStack {
            // Background - Figma: #131313
            AppColors.black700
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header (Figma: 41:4758)
                HomeHeaderFigma(userName: userName)

                // Scrollable Content
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Headline Section (Figma: 41:4571)
                        HeadlineSectionFigma(daysUntilDue: daysUntilDue)
                            .padding(.bottom, Spacing.lg) // 24pt gap

                        // Payment Card Section (Figma: 41:4574)
                        PaymentCardSectionFigma()
                            .padding(.bottom, Spacing.xl) // 32pt gap before divider

                        // Divider line (Figma: 41:4723)
                        Rectangle()
                            .fill(AppColors.black400.opacity(0.35))
                            .frame(height: 1)
                            .padding(.horizontal, Spacing.xl) // 32pt to match card padding
                            .padding(.bottom, Spacing.lg) // 24pt gap after divider

                        // Setup Progress Card (Figma: 41:4724)
                        SetupProgressCardFigma(
                            countdownTime: countdownFormatted,
                            bankDetailsComplete: true, // First item active per Figma
                            addressProofComplete: false,
                            landlordInvited: false
                        )
                        .padding(.horizontal, Spacing.xl) // 32pt
                    }
                    .padding(.bottom, Spacing.lg) // 24pt bottom padding
                }

                // Footer (Figma: 41:4750)
                RentFooterFigma(
                    rentAmount: rentAmountValue,
                    daysUntilDue: 28 // Figma shows "Due in 28 Days"
                )
            }
        }
        .task {
            await viewModel.loadDashboard()
        }
    }
}

// MARK: - Header Component (Figma: 41:4758)
/// "Hi, Rishabh" greeting with logo and avatar

struct HomeHeaderFigma: View {
    let userName: String

    var body: some View {
        HStack {
            // Logo + Greeting (Figma: 41:4761)
            HStack(spacing: Spacing.md) { // 16pt gap
                // Flent Logo (Figma: 41:4762) - 26.7x32
                Image("flent-logo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: DesignScale.scaled(26.7), height: DesignScale.scaled(32))

                // Greeting text (Figma: 41:4763)
                // Font: Plus Jakarta Sans Regular, 14px, line-height 20px
                Text("Hi, \(userName)")
                    .font(Typography.bodyMd2) // 14px Regular
                    .foregroundColor(AppColors.neutral300) // #CBCBCB
            }

            Spacer()

            // Avatar (Figma: 41:4764) - 32x32 circle with gradient
            Image("avatar_placeholder")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: DesignScale.scaled(32), height: DesignScale.scaled(32))
                .clipShape(Circle())
        }
        .padding(.horizontal, Spacing.xl) // 32pt
        .padding(.top, Spacing.md) // 16pt top
        .padding(.bottom, Spacing.sm) // 12pt bottom - tighter per Figma
    }
}

// MARK: - Headline Section (Figma: 41:4571)
/// "Your rent is due in 10 days" - Uses H4 (28px)

struct HeadlineSectionFigma: View {
    let daysUntilDue: Int

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 0) {
                // "Your rent is due" (Figma: 41:4572)
                // Font: H4/Regular 400 - 28px, tracking -1px, line-height 40px
                Text("Your rent is due")
                    .font(Typography.h4) // 28px Regular
                    .foregroundColor(Color(hex: "BABABA")) // Figma: #BABABA (neutral/400)

                Text("in \(daysUntilDue) days")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.brand500) // #FF9A6D Orange
            }

            Spacer()
        }
        .padding(.horizontal, DesignScale.scaled(64)) // Figma: px-64
    }
}

// MARK: - Payment Card Section (Figma: 41:4574)
/// Contains the payment setup card with specific positioning
///
/// DEBUG NOTE: Previous issue was using `Spacer()` on right side which took
/// ALL remaining space instead of Figma's fixed 32px right padding.
/// Fix: Use explicit padding instead of HStack with Spacers.

struct PaymentCardSectionFigma: View {
    var body: some View {
        // Figma: pl-64px, pr-32px, card width 270px
        // Using leading alignment with explicit padding to match Figma exactly
        HStack {
            PaymentSetupCardFigma()
                .frame(width: DesignScale.scaled(270))
            Spacer(minLength: 0) // Allow card to stay at leading edge
        }
        .padding(.leading, DesignScale.scaled(64))  // Figma: pl-64
        .padding(.trailing, DesignScale.scaled(32)) // Figma: pr-32
    }
}

// MARK: - Payment Setup Card (Figma: 41:4707)
/// Dark card with "Setup your payment method" - 270px wide, 408px tall

struct PaymentSetupCardFigma: View {
    var body: some View {
        VStack(spacing: 0) {
            // Top section with content (Figma: 41:4708)
            VStack(alignment: .leading, spacing: Spacing.lg) { // 24pt gap
                // Text block (Figma: 41:4710)
                VStack(alignment: .leading, spacing: Spacing.xs) { // 8pt gap
                    // Main title (Figma: 41:4711)
                    // "Setup" in orange, rest in gray - 20px bodyLg
                    (Text("Setup")
                        .foregroundColor(AppColors.brand500) +
                     Text(" your payment method to start")
                        .foregroundColor(AppColors.neutral300))
                        .font(Typography.bodyLg) // 20px Regular

                    // Subtitle (Figma: 41:4712) - 14px, #878787
                    Text("Add UPI, card, or bank to start earning rewards")
                        .font(Typography.bodyMd2) // 14px
                        .foregroundColor(AppColors.neutral600) // #878787
                }

                // "+ Add Payment" button (Figma: 41:4713)
                // Gradient button with orange border - Figma screenshot shows "+ Add Payment"
                GradientBorderButton(title: "+ Add Payment") {}
            }
            .padding(.horizontal, Spacing.xl) // 32pt
            .padding(.vertical, Spacing.lg) // 24pt
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                ZStack {
                    // Base background (Figma: #202020)
                    AppColors.black500

                    // Pattern overlay at 16% opacity
                    Image("card_pattern")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .opacity(0.16)

                    // Dark overlay (Figma: rgba(0,0,0,0.64))
                    Color.black.opacity(0.64)
                }
            )
            .clipShape(
                UnevenRoundedRectangle(
                    topLeadingRadius: Radius.md,
                    bottomLeadingRadius: 0,
                    bottomTrailingRadius: 0,
                    topTrailingRadius: Radius.md
                )
            )

            // Footer section (Figma: 41:4714)
            HStack(spacing: Spacing.md) {
                // "NEW PAYMENT" label with info icon
                HStack(spacing: Spacing.xxs) {
                    Text("NEW PAYMENT")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.neutral300)

                    Image(systemName: "info.circle")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.neutral300)
                }

                Spacer()

                // Flent icon - 20x24
                Image("flent-logo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: DesignScale.scaled(20), height: DesignScale.scaled(24))
            }
            .padding(.horizontal, Spacing.xl)
            .padding(.top, Spacing.md)
            .padding(.bottom, Spacing.lg)
            .background(AppColors.black600) // #1A1A1A
            .clipShape(
                UnevenRoundedRectangle(
                    topLeadingRadius: 0,
                    bottomLeadingRadius: Radius.md,
                    bottomTrailingRadius: Radius.md,
                    topTrailingRadius: 0
                )
            )
        }
    }
}

// MARK: - Gradient Border Button (Figma button style)
/// Button with gradient background, orange border, and shadow

struct GradientBorderButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Spacing.xs) {
                // Top bar indicator (Figma: 2px, #4D4D4D)
                RoundedRectangle(cornerRadius: Radius.pill)
                    .fill(AppColors.black400)
                    .frame(width: 24, height: 2)

                // Button content
                Text(title)
                    .font(Typography.bodyMdMedium) // 16px Medium
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(Spacing.md) // 16pt
                    .background(
                        LinearGradient(
                            colors: [AppColors.black500, Color(hex: "0D0D0D")],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.sm) // 8px per Figma rd-8
                            .stroke(AppColors.brand500.opacity(0.6), lineWidth: 0.5) // Subtle orange border
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radius.sm)) // 8px
                    .shadow(color: Color(hex: "995C41").opacity(0.24), radius: 6, x: 0, y: 6)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Setup Progress Card (Figma: 41:4724)
/// Countdown timer + 3 setup items + "Finish Setup" button

struct SetupProgressCardFigma: View {
    let countdownTime: String
    let bankDetailsComplete: Bool
    let addressProofComplete: Bool
    let landlordInvited: Bool

    // Setup items with active states
    private var setupItems: [(title: String, subtitle: String, isActive: Bool)] {
        [
            ("Add landlord's bank details", "enables secure payouts", bankDetailsComplete),
            ("Upload address proof", "for verification", addressProofComplete),
            ("Invite your landlord", "needed for cashback eligibility", landlordInvited)
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) { // 24pt gap
            // Title with countdown (Figma: 41:4727)
            // "Complete setup in 28:12:12 to unlock Cashbacks"
            HStack(spacing: 0) {
                Text("Complete setup in ")
                    .font(Typography.bodyMd2) // 14px Regular
                    .foregroundColor(AppColors.neutral300)

                Text(countdownTime)
                    .font(Typography.bodyMd2Medium) // 14px Medium
                    .foregroundColor(AppColors.brand500)
                    .underline()

                Text(" to\nunlock Cashbacks")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.neutral300)
            }
            .fixedSize(horizontal: false, vertical: true)

            // Setup checklist items (Figma: 41:4728, 41:4735, 41:4742)
            VStack(spacing: Spacing.md) { // 16pt gap between items
                ForEach(Array(setupItems.enumerated()), id: \.offset) { index, item in
                    HomeSetupItemRow(
                        title: item.title,
                        subtitle: item.subtitle,
                        isActive: item.isActive,
                        isLast: index == setupItems.count - 1
                    )
                }
            }

            // "Finish Setup" button (Figma: 41:4748)
            GradientBorderButton(title: "Finish Setup") {}
        }
        .padding(.horizontal, Spacing.md) // 16pt
        .padding(.vertical, Spacing.lg) // 24pt
        .background(AppColors.black500) // #202020
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg)) // 16px per Figma
    }
}

// MARK: - Setup Item Row

struct HomeSetupItemRow: View {
    let title: String
    let subtitle: String
    let isActive: Bool
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.xs) { // 8pt gap
            // Indicator + vertical line
            VStack(spacing: 0) {
                // Circle indicator (Figma: 20x20)
                Circle()
                    .fill(isActive ? AppColors.brand500 : AppColors.black400)
                    .frame(width: 20, height: 20)

                // Vertical connecting line (except for last item)
                if !isLast {
                    Rectangle()
                        .fill(isActive ? AppColors.brand500.opacity(0.5) : AppColors.black400)
                        .frame(width: 2, height: 36) // Adjusted for tighter spacing
                }
            }

            // Text content (Figma: 41:4732)
            VStack(alignment: .leading, spacing: Spacing.xxs) { // 4pt gap
                Text(title)
                    .font(Typography.bodyMd2) // 14px Regular
                    .foregroundColor(AppColors.neutral300)

                Text(subtitle)
                    .font(Typography.bodySm) // 12px Regular
                    .foregroundColor(AppColors.neutral600) // #878787
            }

            Spacer()
        }
    }
}

// MARK: - Rent Footer (Figma: 41:4750)
/// "Due in 28 Days" + "₹ 32,500" + "Review" button

struct RentFooterFigma: View {
    let rentAmount: String
    let daysUntilDue: Int

    var body: some View {
        HStack {
            // Left: Due info (Figma: 41:4751)
            VStack(alignment: .leading, spacing: Spacing.xxs) {
                // "Due in 28 Days" - 12px Bold
                Text("Due in \(daysUntilDue) Days")
                    .font(Typography.bodySmBold)
                    .foregroundColor(AppColors.neutral500) // #A9A9A9

                // "₹ 32,500" - mixed sizes
                HStack(spacing: 2) {
                    Text("₹")
                        .font(Typography.bodySmSemiBold) // 12px SemiBold
                        .foregroundColor(AppColors.neutral100) // #EEE

                    Text(rentAmount)
                        .font(Typography.bodyMd) // 16px SemiBold
                        .foregroundColor(AppColors.neutral100)
                        .tracking(-0.48)
                }
            }

            Spacer()

            // Right: "Review" button (Figma: 41:4754)
            GradientBorderButton(title: "Review") {}
                .frame(width: DesignScale.scaled(160))
        }
        .padding(.horizontal, Spacing.xl) // 32pt
        .padding(.top, Spacing.md) // 16pt
        .padding(.bottom, Spacing.lg) // 24pt - adjusted per Figma
        .background(AppColors.black500) // #202020
    }
}

// MARK: - Preview

#Preview("Zero State - Figma Match") {
    HomeZeroStateFigmaView()
}
