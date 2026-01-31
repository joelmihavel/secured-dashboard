/// WaitlistView.swift
/// Flent Secured v2 - Waitlist Screen
///
/// Figma Node IDs:
/// - 41:11206 - Waitlist screen (pending)
/// - 41:11313 - Waitlist accepted
/// - 41:11410 - Waitlist rejected
/// - 41:11506 - Referral code entry
/// - 41:11613 - Referral code invalid
/// - 41:11720 - Referral code applied
/// - 41:11825 - Waitlist > 24hrs (pendingLong)
///
/// PIXEL PERFECT from Figma:
/// - Background: #131313 with dotted grid pattern
/// - Header: "Welcome," (gray) + User Name (brand orange)
/// - Status timeline card with colored dots
/// - Release gauge showing members onboarded
/// - Inline 4-character referral code input
/// - Benefits section at bottom

import SwiftUI

struct WaitlistView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = WaitlistViewModel()
    @State private var referralCode: [String] = ["", "", "", ""]
    @State private var referralError: String?
    @State private var isApplyingReferral = false
    @State private var showConfetti = false
    @State private var referralApplied = false
    @FocusState private var focusedReferralIndex: Int?

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            DottedGridPattern()
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    // Logo
                    HStack {
                        Image("flent-logo")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 32, height: 38)
                        Spacer()
                    }
                    .padding(.top, Spacing.xl)

                    Spacer().frame(height: Spacing.xl)

                    // Header - State specific
                    headerContent
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Spacer().frame(height: Spacing.xl)

                    // Status Timeline Card
                    statusTimelineCard

                    Spacer().frame(height: Spacing.lg)

                    // Release Gauge Card (pending states only)
                    if case .pending = viewModel.state {
                        releaseGaugeCard
                        Spacer().frame(height: Spacing.lg)
                    } else if case .pendingLong = viewModel.state {
                        releaseGaugeCard
                        Spacer().frame(height: Spacing.lg)
                    }

                    // Rejection Reasons (rejected state only)
                    if case .rejected = viewModel.state {
                        rejectionReasonsCard
                        Spacer().frame(height: Spacing.lg)
                    }

                    // Benefits Section (accepted and pending states)
                    if case .approved = viewModel.state {
                        benefitsSection
                    } else if case .pending = viewModel.state {
                        benefitsSection
                    } else if case .pendingLong = viewModel.state {
                        benefitsSection
                    }

                    Spacer().frame(height: Spacing.xxxl)

                    // Bottom Action
                    bottomAction
                }
                .padding(.horizontal, Spacing.xxxl)
            }

            // Confetti overlay for approval
            if showConfetti {
                WaitlistConfettiView()
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }
        }
        .navigationBarHidden(true)
        .task {
            // Get user name from AppState
            if let profile = appState.userProfile {
                viewModel = WaitlistViewModel(
                    userService: AppEnvironment.shared.userService,
                    userName: profile.fullName
                )
            } else if let pendingName = appState.pendingUserName {
                viewModel = WaitlistViewModel(
                    userService: AppEnvironment.shared.userService,
                    userName: pendingName
                )
            }
            await viewModel.loadStatus()
        }
        .animation(.easeInOut(duration: 0.3), value: viewModel.state)
        .onDisappear {
            viewModel.stopPolling()
        }
        .onChange(of: viewModel.state) { _, newState in
            if case .approved = newState {
                triggerApprovalCelebration()
            }
        }
    }

    // MARK: - Header Content

    @ViewBuilder
    private var headerContent: some View {
        switch viewModel.state {
        case .loading:
            loadingHeader

        case .pending, .pendingLong:
            pendingHeader

        case .approved:
            acceptedHeader

        case .rejected:
            rejectedHeader

        case .error:
            errorHeader
        }
    }

    private var loadingHeader: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: AppColors.accentPrimary))
            Text("Loading...")
                .font(Typography.bodyMd)
                .foregroundColor(AppColors.textSecondary)
        }
    }

    private var pendingHeader: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Figma: "Welcome," + "[Name]" on separate lines
            VStack(alignment: .leading, spacing: 0) {
                if case .pendingLong = viewModel.state {
                    Text("We're still")
                        .font(Typography.h1)
                        .foregroundColor(AppColors.neutral500)
                        .tracking(-2)
                    Text("setting")
                        .font(Typography.h1)
                        .foregroundColor(AppColors.brand500)
                        .tracking(-2)
                    Text("things up")
                        .font(Typography.h1)
                        .foregroundColor(AppColors.brand500)
                        .tracking(-2)
                } else {
                    Text("Welcome,")
                        .font(Typography.h1)
                        .foregroundColor(AppColors.neutral500)
                        .tracking(-2)
                    Text(viewModel.userName)
                        .font(Typography.h1)
                        .foregroundColor(AppColors.brand500)
                        .tracking(-2)
                }
            }

            Text("Your application is in review")
                .font(Typography.bodyMd2)
                .foregroundColor(AppColors.black200)
        }
    }

    private var acceptedHeader: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Figma: "[Name]," + "you're all set."
            VStack(alignment: .leading, spacing: 0) {
                Text("\(viewModel.userName),")
                    .font(Typography.h1)
                    .foregroundColor(AppColors.neutral500)
                    .tracking(-2)
                Text("you're all set.")
                    .font(Typography.h1)
                    .foregroundColor(AppColors.brand500)
                    .tracking(-2)
            }

            Text("Welcome to the right side of renting.")
                .font(Typography.bodyMd2)
                .foregroundColor(AppColors.black200)
        }
    }

    private var rejectedHeader: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Figma: "We can't" + "approve you" + "right now"
            VStack(alignment: .leading, spacing: 0) {
                Text("We can't")
                    .font(Typography.h1)
                    .foregroundColor(AppColors.neutral500)
                    .tracking(-2)
                Text("approve you")
                    .font(Typography.h1)
                    .foregroundColor(AppColors.neutral500)
                    .tracking(-2)
                Text("right now")
                    .font(Typography.h1)
                    .foregroundColor(AppColors.brand500)
                    .tracking(-2)
            }

            Text("We're opening access in batches. Stay tuned.")
                .font(Typography.bodyMd2)
                .foregroundColor(AppColors.black200)
        }
    }

    private var errorHeader: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Something")
                    .font(Typography.h1)
                    .foregroundColor(AppColors.neutral500)
                    .tracking(-2)
                Text("went wrong")
                    .font(Typography.h1)
                    .foregroundColor(AppColors.error)
                    .tracking(-2)
            }

            if case .error(let message) = viewModel.state {
                Text(message)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.black200)
            }
        }
    }

    // MARK: - Status Timeline Card

    private var statusTimelineCard: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Application Sent
            statusTimelineRow(
                label: "Application Sent",
                value: submissionDateText,
                dotColor: AppColors.brand500,
                isComplete: true
            )

            // In Review
            statusTimelineRow(
                label: "In Review",
                value: viewModel.reviewTimeText,
                dotColor: statusDotColor,
                isComplete: false
            )

            // Account Status
            statusTimelineRow(
                label: "Account Status",
                value: accountStatusText,
                dotColor: accountStatusDotColor,
                isComplete: isAccountStatusComplete,
                isLast: true
            )
        }
        .padding(Spacing.lg)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.lg)
    }

    private func statusTimelineRow(
        label: String,
        value: String,
        dotColor: Color,
        isComplete: Bool,
        isLast: Bool = false
    ) -> some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            // Dot and line
            VStack(spacing: 0) {
                Circle()
                    .fill(dotColor)
                    .frame(width: 8, height: 8)

                if !isLast {
                    Rectangle()
                        .fill(AppColors.black400)
                        .frame(width: 1, height: 32)
                }
            }

            // Labels
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)

                Text(value)
                    .font(Typography.bodySmMedium)
                    .foregroundColor(AppColors.textPrimary)
            }

            Spacer()
        }
    }

    private var submissionDateText: String {
        guard let date = viewModel.submissionDate else {
            return "Submitted on \(formattedDate(Date()))"
        }
        return "Submitted on \(formattedDate(date))"
    }

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: date)
    }

    private var statusDotColor: Color {
        switch viewModel.state {
        case .approved:
            return AppColors.success
        case .rejected:
            return AppColors.error
        default:
            return AppColors.brand500
        }
    }

    private var accountStatusText: String {
        switch viewModel.state {
        case .approved:
            return "Accepted"
        case .rejected:
            return "Rejected"
        default:
            return "Pending"
        }
    }

    private var accountStatusDotColor: Color {
        switch viewModel.state {
        case .approved:
            return AppColors.success
        case .rejected:
            return AppColors.error
        default:
            return AppColors.black400
        }
    }

    private var isAccountStatusComplete: Bool {
        switch viewModel.state {
        case .approved, .rejected:
            return true
        default:
            return false
        }
    }

    // MARK: - Release Gauge Card

    private var releaseGaugeCard: some View {
        VStack(spacing: Spacing.md) {
            // "This release" label
            HStack {
                Text("This")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
                Spacer()
            }
            Text("release")
                .font(Typography.caption)
                .foregroundColor(AppColors.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Gauge visualization
            WaitlistReleaseGaugeView(
                current: viewModel.membersOnboarded,
                total: viewModel.totalMemberSlots
            )
            .frame(height: 80)

            // Member count
            VStack(spacing: 2) {
                Text("\(viewModel.membersOnboarded) / \(viewModel.totalMemberSlots)")
                    .font(Typography.bodyMdMedium)
                    .foregroundColor(AppColors.textPrimary)

                Text("members onboarded")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.brand500)
            }

            // Referral section (if not applied)
            if !referralApplied {
                referralInputSection
            } else {
                // Referral applied success
                VStack(spacing: Spacing.sm) {
                    SecondaryButton(title: "Be notified") {
                        // Enable notifications
                    }

                    Text("Kudos. You're among Secured's first members")
                        .font(Typography.caption)
                        .foregroundColor(AppColors.textMuted)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .padding(Spacing.lg)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.lg)
    }

    // MARK: - Referral Input Section

    private var referralInputSection: some View {
        VStack(spacing: Spacing.md) {
            // Label
            VStack(alignment: .leading, spacing: 4) {
                Text("Have an Invite Code?")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)

                Text("Get priority access to the platform if you use a referral code")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // 4-box input
            HStack(spacing: Spacing.sm) {
                ForEach(0..<4, id: \.self) { index in
                    referralDigitBox(at: index)
                }
            }

            // Error message
            if let error = referralError {
                Text(error)
                    .font(Typography.caption)
                    .foregroundColor(AppColors.error)
            }

            // Enter button
            SecondaryButton(
                title: "Enter Invite Code",
                isLoading: isApplyingReferral,
                isEnabled: referralCode.allSatisfy { !$0.isEmpty }
            ) {
                applyReferralCode()
            }
        }
    }

    private func referralDigitBox(at index: Int) -> some View {
        TextField("", text: Binding(
            get: { referralCode[index] },
            set: { newValue in
                let filtered = String(newValue.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(1))
                referralCode[index] = filtered
                if !filtered.isEmpty && index < 3 {
                    focusedReferralIndex = index + 1
                }
            }
        ))
        .font(.system(size: 24, weight: .semibold, design: .monospaced))
        .foregroundColor(AppColors.textPrimary)
        .multilineTextAlignment(.center)
        .textInputAutocapitalization(.characters)
        .autocorrectionDisabled()
        .keyboardType(.asciiCapable)
        .focused($focusedReferralIndex, equals: index)
        .frame(width: 56, height: 64)
        .background(AppColors.backgroundPrimary)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(
                    referralError != nil ? AppColors.error : (focusedReferralIndex == index ? AppColors.brand500 : AppColors.black400),
                    lineWidth: focusedReferralIndex == index || referralError != nil ? 2 : 1
                )
        )
    }

    // MARK: - Rejection Reasons Card

    private var rejectionReasonsCard: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header
            VStack(alignment: .leading, spacing: 0) {
                Text("Why was I")
                    .font(Typography.h5)
                    .foregroundColor(AppColors.neutral500)
                Text("Rejected?")
                    .font(Typography.h5)
                    .foregroundColor(AppColors.brand500)
            }

            // Reasons list
            VStack(alignment: .leading, spacing: Spacing.sm) {
                ForEach(viewModel.rejectionReasons, id: \.self) { reason in
                    HStack(spacing: Spacing.sm) {
                        Image("card_pattern") // Card icon
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 24, height: 24)
                            .opacity(0.6)

                        Text(reason)
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textSecondary)
                    }
                }
            }
        }
        .padding(Spacing.lg)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.lg)
    }

    // MARK: - Benefits Section

    private var benefitsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header
            VStack(alignment: .leading, spacing: 0) {
                Text("What do you get")
                    .font(Typography.h5)
                    .foregroundColor(AppColors.neutral500)
                Text("with Flent Secured?")
                    .font(Typography.h5)
                    .foregroundColor(AppColors.brand500)
            }

            // Benefits list
            VStack(spacing: Spacing.sm) {
                benefitRow(icon: "card_pattern", text: "Earn 1% back for paying rent on time")
                benefitRow(icon: "card_pattern", text: "Build a stronger rent history")
                benefitRow(icon: "card_pattern", text: "Unlock exclusive renting benefits over time")
            }
        }
        .padding(Spacing.lg)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.lg)
    }

    private func benefitRow(icon: String, text: String) -> some View {
        HStack(spacing: Spacing.sm) {
            Image(icon)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 32, height: 24)

            Text(text)
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textSecondary)

            Spacer()
        }
    }

    // MARK: - Bottom Action

    @ViewBuilder
    private var bottomAction: some View {
        switch viewModel.state {
        case .loading:
            EmptyView()

        case .pending, .pendingLong:
            EmptyView() // Referral is inline now

        case .approved:
            PrimaryButton(title: "Step Inside") {
                if let route = viewModel.nextRoute() {
                    coordinator.navigate(to: route)
                }
            }

        case .rejected:
            VStack(spacing: Spacing.md) {
                SecondaryButton(title: "Contact support") {
                    openSupport()
                }

                Text("Next applications open in \(viewModel.countdownText)")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
            }

        case .error:
            PrimaryButton(title: "Try Again") {
                Task {
                    await viewModel.refresh()
                }
            }
        }
    }

    // MARK: - Actions

    private func applyReferralCode() {
        let code = referralCode.joined()
        guard code.count == 4 else {
            referralError = "Invalid Code"
            return
        }

        isApplyingReferral = true
        referralError = nil

        Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)

            await MainActor.run {
                isApplyingReferral = false

                // Test: "FAIL" triggers error, anything else succeeds
                if code.uppercased() == "FAIL" {
                    referralError = "Invalid Code"
                } else {
                    referralApplied = true
                    HapticManager.shared.success()
                    Task {
                        await viewModel.refresh()
                    }
                }
            }
        }
    }

    private func triggerApprovalCelebration() {
        showConfetti = true
        HapticManager.shared.notification(.success)

        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            withAnimation {
                showConfetti = false
            }
        }
    }

    private func openSupport() {
        let subject = "Waitlist Application - Assistance Needed".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let body = "I need help with my application...".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""

        if let url = URL(string: "mailto:support@flent.app?subject=\(subject)&body=\(body)") {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Release Gauge View

struct WaitlistReleaseGaugeView: View {
    let current: Int
    let total: Int

    private var progress: Double {
        guard total > 0 else { return 0 }
        return min(Double(current) / Double(total), 1.0)
    }

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let height = geometry.size.height

            ZStack {
                // Background arc
                Path { path in
                    path.addArc(
                        center: CGPoint(x: width / 2, y: height),
                        radius: height * 0.9,
                        startAngle: .degrees(180),
                        endAngle: .degrees(0),
                        clockwise: false
                    )
                }
                .stroke(AppColors.black400, style: StrokeStyle(lineWidth: 12, lineCap: .round))

                // Progress arc
                Path { path in
                    path.addArc(
                        center: CGPoint(x: width / 2, y: height),
                        radius: height * 0.9,
                        startAngle: .degrees(180),
                        endAngle: .degrees(180 - (180 * progress)),
                        clockwise: true
                    )
                }
                .stroke(
                    LinearGradient(
                        colors: [AppColors.brand400, AppColors.brand500],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: 12, lineCap: .round)
                )
            }
        }
    }
}

// MARK: - Waitlist Confetti View

struct WaitlistConfettiView: View {
    @State private var confettiPieces: [WaitlistConfettiPiece] = []

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(confettiPieces) { piece in
                    WaitlistConfettiPieceView(piece: piece)
                }
            }
            .onAppear {
                generateConfetti(in: geometry.size)
            }
        }
    }

    private func generateConfetti(in size: CGSize) {
        confettiPieces = (0..<50).map { _ in
            WaitlistConfettiPiece(
                position: CGPoint(x: CGFloat.random(in: 0...size.width), y: -20),
                color: [AppColors.accentPrimary, AppColors.success, AppColors.warning, AppColors.brand400].randomElement()!,
                size: CGFloat.random(in: 8...16),
                rotation: Double.random(in: 0...360),
                velocity: CGFloat.random(in: 2...5)
            )
        }
    }
}

private struct WaitlistConfettiPiece: Identifiable {
    let id = UUID()
    var position: CGPoint
    let color: Color
    let size: CGFloat
    let rotation: Double
    let velocity: CGFloat
}

private struct WaitlistConfettiPieceView: View {
    let piece: WaitlistConfettiPiece

    @State private var yOffset: CGFloat = 0
    @State private var rotationAngle: Double = 0
    @State private var opacity: Double = 1

    var body: some View {
        Rectangle()
            .fill(piece.color)
            .frame(width: piece.size, height: piece.size * 0.6)
            .cornerRadius(2)
            .position(piece.position)
            .offset(y: yOffset)
            .rotationEffect(.degrees(rotationAngle))
            .opacity(opacity)
            .onAppear {
                withAnimation(.linear(duration: Double.random(in: 2...4))) {
                    yOffset = UIScreen.main.bounds.height + 100
                    rotationAngle = piece.rotation + Double.random(in: 180...720)
                }
                withAnimation(.linear(duration: 3).delay(1)) {
                    opacity = 0
                }
            }
    }
}

#Preview("Pending") {
    WaitlistView()
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Accepted") {
    WaitlistView()
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Rejected") {
    WaitlistView()
        .environment(AppCoordinator())
        .environment(AppState())
}
