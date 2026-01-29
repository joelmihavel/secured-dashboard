/// WaitlistView.swift
/// Flent Secured v2 - Waitlist Screen
///
/// Figma Node IDs:
/// - 41:11206 - Waitlist screen (pending)
/// - 41:11313 - Waitlist accepted
/// - 41:11410 - Waitlist rejected
/// - 41:11506 - Referral code entry
/// - 41:11613 - Referral code invalid (variant 1)
/// - 41:11720 - Referral code invalid (variant 2)
/// - 41:11825 - Waitlist > 24hrs (pendingLong)
///
/// PIXEL PERFECT from Figma:
/// - Background: #131313 with dotted grid pattern
/// - Header: H1/Regular 400 (48px, tracking -2px)
///   - State-specific two-color headlines
/// - Horizontal padding: 48pt (sp-48)
///
/// States handled:
/// - .loading: Fetching waitlist status
/// - .pending: In queue, showing position
/// - .pendingLong: >24 hours wait, different messaging
/// - .approved: User qualified, proceed to setup
/// - .rejected: User not eligible
/// - .error: Error loading status

import SwiftUI

// MARK: - Referral Error Type

/// Types of referral code errors per Figma variants
enum ReferralCodeError: Equatable {
    /// Variant 1: General invalid errors (code not found, malformed, network)
    case notFound
    case malformed
    case networkError

    /// Variant 2: Specific errors requiring different messaging
    case expired
    case alreadyUsed
    case limitReached
    case selfReferral

    var message: String {
        switch self {
        case .notFound:
            return "This referral code doesn't exist. Please check and try again."
        case .malformed:
            return "Invalid code format. Referral codes are 6-8 characters."
        case .networkError:
            return "Couldn't verify code. Please check your connection and try again."
        case .expired:
            return "This referral code has expired. Ask your friend for a new one."
        case .alreadyUsed:
            return "You've already used a referral code on this account."
        case .limitReached:
            return "This referral code has reached its usage limit."
        case .selfReferral:
            return "You can't use your own referral code."
        }
    }

    var isRecoverable: Bool {
        switch self {
        case .notFound, .malformed, .networkError, .expired, .limitReached, .selfReferral:
            return true
        case .alreadyUsed:
            return false
        }
    }
}

struct WaitlistView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel = WaitlistViewModel()
    @State private var showReferralSheet = false
    @State private var referralCode = ""
    @State private var isApplyingReferral = false
    @State private var showConfetti = false
    @State private var referralError: ReferralCodeError?
    @State private var shakeReferralField = false

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            DottedGridPattern()
                .ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                // Polling indicator
                if viewModel.isPolling {
                    pollingIndicator
                }

                Spacer()

                // State-specific content
                stateContent

                Spacer()

                // State-specific actions
                stateActions
            }
            .padding(.horizontal, Spacing.xxxl) // 48pt horizontal (sp-48)

            // Confetti overlay for approval
            if showConfetti {
                WaitlistConfettiView()
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadStatus()
        }
        .animation(.easeInOut(duration: 0.3), value: viewModel.state)
        .sheet(isPresented: $showReferralSheet) {
            referralSheetContent
        }
        .onDisappear {
            viewModel.stopPolling()
        }
        .onChange(of: viewModel.state) { _, newState in
            if case .approved = newState {
                triggerApprovalCelebration()
            }
        }
    }

    // MARK: - Polling Indicator

    private var pollingIndicator: some View {
        HStack(spacing: Spacing.xs) {
            Circle()
                .fill(AppColors.success)
                .frame(width: 8, height: 8)
                .opacity(viewModel.isPolling ? 1 : 0.3)

            Text("Auto-refreshing every 30s")
                .font(Typography.caption)
                .foregroundColor(AppColors.textMuted)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.xs)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.pill)
    }

    // MARK: - Approval Celebration

    private func triggerApprovalCelebration() {
        showConfetti = true
        HapticManager.shared.notification(.success)

        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            withAnimation {
                showConfetti = false
            }
        }
    }

    // MARK: - State Content

    @ViewBuilder
    private var stateContent: some View {
        switch viewModel.state {
        case .loading:
            loadingContent

        case .pending(let position, let days):
            pendingContent(position: position, estimatedDays: days, isLongWait: false)

        case .pendingLong(let days):
            pendingContent(position: nil, estimatedDays: days, isLongWait: true)

        case .approved:
            acceptedContent

        case .rejected(let reason):
            rejectedContent(reason: reason)

        case .error(let message):
            errorContent(message: message)
        }
    }

    // MARK: - Loading Content

    private var loadingContent: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: AppColors.accentPrimary))
                .scaleEffect(1.2)

            Text("Loading your status...")
                .font(Typography.bodyMd)
                .foregroundColor(AppColors.textSecondary)
        }
    }

    // MARK: - Pending Content

    private func pendingContent(position: Int?, estimatedDays: Int?, isLongWait: Bool) -> some View {
        VStack(spacing: Spacing.lg) {
            // Animated Hourglass
            WaitlistHourglassAnimation(isLongWait: isLongWait)
                .frame(width: 120, height: 120)

            // Header - Figma: H1/Regular 400 with two-color format
            VStack(alignment: .leading, spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("You're on the")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.neutral500) // #A9A9A9
                        .tracking(-2)
                        .lineSpacing(16)
                    Text("waitlist!")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.brand500) // #FF9A6D
                        .tracking(-2)
                        .lineSpacing(16)
                }

                Text(isLongWait
                     ? "Thanks for your patience. We're working to expand our service to your area."
                     : "We're reviewing your application. This usually takes a few hours.")
                    .font(Typography.bodyMd2) // 14px Regular
                    .foregroundColor(AppColors.black200) // #A6A6A6
                    .lineSpacing(6)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Status Card
            VStack(spacing: Spacing.md) {
                // Position indicator
                if let position = position {
                    HStack {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: "person.3.fill")
                                .font(.system(size: 14))
                                .foregroundColor(AppColors.accentPrimary)
                            Text("Position in queue")
                                .font(Typography.bodySm)
                                .foregroundColor(AppColors.textMuted)
                        }

                        Spacer()

                        Text("#\(position)")
                            .font(Typography.bodyMdMedium)
                            .foregroundColor(AppColors.accentPrimary)
                    }
                }

                // Estimated wait
                if let days = estimatedDays, days > 0 {
                    HStack {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: "clock.fill")
                                .font(.system(size: 14))
                                .foregroundColor(AppColors.textMuted)
                            Text("Estimated wait")
                                .font(Typography.bodySm)
                                .foregroundColor(AppColors.textMuted)
                        }

                        Spacer()

                        Text(days == 1 ? "~1 day" : "~\(days) days")
                            .font(Typography.bodySmMedium)
                            .foregroundColor(AppColors.textSecondary)
                    }
                }

                // Verification checks
                VStack(spacing: Spacing.xs) {
                    verificationCheckRow(title: "Phone verified", isComplete: true)
                    verificationCheckRow(title: "Name verified", isComplete: true)
                    verificationCheckRow(title: "Agreement uploaded", isComplete: true)
                    verificationCheckRow(title: "Account approval", isComplete: false, isPending: true)
                }
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.md)

            // Last updated
            if let lastUpdated = viewModel.lastUpdated {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 10))
                        .foregroundColor(AppColors.textMuted)
                    Text("Last checked: \(lastUpdated.formatted(.relative(presentation: .named)))")
                        .font(Typography.caption)
                        .foregroundColor(AppColors.textMuted)
                }
            }
        }
    }

    private func verificationCheckRow(title: String, isComplete: Bool, isPending: Bool = false) -> some View {
        HStack(spacing: Spacing.xs) {
            if isComplete {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.success)
            } else if isPending {
                ProgressView()
                    .scaleEffect(0.6)
                    .frame(width: 14, height: 14)
            } else {
                Image(systemName: "circle")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.border)
            }

            Text(title)
                .font(Typography.caption)
                .foregroundColor(isComplete ? AppColors.textSecondary : AppColors.textMuted)

            Spacer()
        }
    }

    // MARK: - Accepted Content

    private var acceptedContent: some View {
        VStack(spacing: Spacing.lg) {
            // Animated Success Badge
            ZStack {
                Circle()
                    .fill(AppColors.success.opacity(0.1))
                    .frame(width: 120, height: 120)

                Circle()
                    .fill(AppColors.success.opacity(0.2))
                    .frame(width: 100, height: 100)

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 64))
                    .foregroundColor(AppColors.success)
            }

            // Header - Figma: H1/Regular 400 with two-color format
            VStack(alignment: .leading, spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("You're")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.neutral500) // #A9A9A9
                        .tracking(-2)
                        .lineSpacing(16)
                    Text("in!")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.brand500) // #FF9A6D
                        .tracking(-2)
                        .lineSpacing(16)
                }

                Text("Complete your setup to start paying rent through Flent.")
                    .font(Typography.bodyMd2) // 14px Regular
                    .foregroundColor(AppColors.black200) // #A6A6A6
                    .lineSpacing(6)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Next Steps Preview
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Next steps")
                    .font(Typography.label)
                    .foregroundColor(AppColors.textMuted)

                HStack(spacing: Spacing.md) {
                    nextStepBadge(number: 1, title: "Add bank", icon: "building.columns.fill")
                    nextStepBadge(number: 2, title: "Verify bill", icon: "bolt.fill")
                    nextStepBadge(number: 3, title: "Invite owner", icon: "person.badge.plus")
                }
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.md)
        }
    }

    private func nextStepBadge(number: Int, title: String, icon: String) -> some View {
        VStack(spacing: Spacing.xs) {
            ZStack {
                Circle()
                    .fill(AppColors.accentPrimary.opacity(0.1))
                    .frame(width: 44, height: 44)

                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(AppColors.accentPrimary)
            }

            Text(title)
                .font(Typography.caption)
                .foregroundColor(AppColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Rejected Content

    private func rejectedContent(reason: String) -> some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(AppColors.error)

            VStack(spacing: Spacing.sm) {
                Text("Not eligible")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text(reason)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - Error Content

    private func errorContent(message: String) -> some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 60))
                .foregroundColor(AppColors.warning)

            VStack(spacing: Spacing.sm) {
                Text("Something went wrong")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text(message)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - State Actions

    @ViewBuilder
    private var stateActions: some View {
        switch viewModel.state {
        case .loading:
            EmptyView()

        case .pending, .pendingLong:
            VStack(spacing: Spacing.md) {
                TextButton(title: "Have a referral code?") {
                    showReferralSheet = true
                }

                SecondaryButton(title: "Refresh Status") {
                    Task {
                        await viewModel.refresh()
                    }
                }
            }

        case .approved:
            PrimaryButton(title: "Complete Setup") {
                if let route = viewModel.nextRoute() {
                    coordinator.navigate(to: route)
                }
            }

        case .rejected:
            VStack(spacing: Spacing.md) {
                SecondaryButton(title: "Contact Support") {
                    openSupport()
                }

                TextButton(title: "Sign out") {
                    Task {
                        // TODO: Sign out and return to phone entry
                        coordinator.popToRoot()
                    }
                }
            }

        case .error:
            VStack(spacing: Spacing.md) {
                PrimaryButton(title: "Try Again") {
                    Task {
                        await viewModel.refresh()
                    }
                }

                SecondaryButton(title: "Contact Support") {
                    openSupport()
                }
            }
        }
    }

    // MARK: - Referral Sheet

    /// Referral code entry sheet with error states
    /// Figma: 41:11506 (entry), 41:11613 (invalid v1), 41:11720 (invalid v2)
    private var referralSheetContent: some View {
        NavigationView {
            ZStack {
                AppColors.backgroundPrimary
                    .ignoresSafeArea()

                VStack(spacing: Spacing.xl) {
                    // Header
                    VStack(spacing: Spacing.sm) {
                        Text("Enter referral code")
                            .font(Typography.h4)
                            .foregroundColor(AppColors.textPrimary)

                        Text("A valid referral code can help you skip the queue")
                            .font(Typography.bodyMd2)
                            .foregroundColor(AppColors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, Spacing.xl)

                    // Input field with error state
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        TextField("", text: $referralCode)
                            .font(Typography.bodyMd)
                            .foregroundColor(AppColors.textPrimary)
                            .multilineTextAlignment(.center)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .keyboardType(.asciiCapable)
                            .padding(Spacing.md)
                            .background(AppColors.backgroundSecondary)
                            .cornerRadius(Radius.input)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.input)
                                    .stroke(referralError != nil ? AppColors.error : AppColors.border, lineWidth: referralError != nil ? 2 : 1)
                            )
                            .shake(trigger: shakeReferralField)
                            .onChange(of: referralCode) { _, newValue in
                                // Clear error when user starts typing again
                                if referralError != nil {
                                    referralError = nil
                                }
                                // Limit to 8 characters and uppercase
                                let filtered = String(newValue.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(8))
                                if filtered != referralCode {
                                    referralCode = filtered
                                }
                            }

                        // Error message
                        if let error = referralError {
                            HStack(spacing: Spacing.xs) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.system(size: 12))
                                Text(error.message)
                                    .font(Typography.caption)
                            }
                            .foregroundColor(AppColors.error)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                            .padding(.top, Spacing.xxs)
                        }
                    }
                    .padding(.horizontal, Spacing.xl)
                    .animation(.spring(response: 0.3, dampingFraction: 0.8), value: referralError)

                    Spacer()

                    // Apply button - disabled for non-recoverable errors
                    PrimaryButton(
                        title: "Apply Code",
                        isLoading: isApplyingReferral,
                        isEnabled: !referralCode.isEmpty && (referralError?.isRecoverable ?? true)
                    ) {
                        applyReferralCode()
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.bottom, Spacing.lg)
                }
                .screenPadding()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        // Reset state on dismiss
                        referralCode = ""
                        referralError = nil
                        showReferralSheet = false
                    }
                    .foregroundColor(AppColors.textSecondary)
                }
            }
        }
        .presentationDetents([.medium])
        .onDisappear {
            // Reset state when sheet is dismissed
            referralCode = ""
            referralError = nil
        }
    }

    // MARK: - Actions

    private func applyReferralCode() {
        // Validate code format first
        guard referralCode.count >= 6 && referralCode.count <= 8 else {
            triggerReferralError(.malformed)
            return
        }

        isApplyingReferral = true

        // Call referral code API
        Task {
            do {
                // Simulate API call - replace with actual implementation
                // let result = try await userService.applyReferralCode(referralCode)
                try await Task.sleep(nanoseconds: 1_500_000_000)

                // Simulate different error scenarios for testing
                // In production, this would be determined by the API response
                let testErrorCode = referralCode.uppercased()

                await MainActor.run {
                    isApplyingReferral = false

                    // Handle test cases for development
                    switch testErrorCode {
                    case "EXPIRED1":
                        triggerReferralError(.expired)
                    case "USED1234":
                        triggerReferralError(.alreadyUsed)
                    case "LIMIT123":
                        triggerReferralError(.limitReached)
                    case "INVALID1":
                        triggerReferralError(.notFound)
                    case "SELF1234":
                        triggerReferralError(.selfReferral)
                    default:
                        // Success case
                        HapticManager.shared.success()
                        showReferralSheet = false
                        referralCode = ""
                        referralError = nil

                        // Refresh status after applying code
                        Task {
                            await viewModel.refresh()
                        }
                    }
                }
            } catch {
                await MainActor.run {
                    isApplyingReferral = false
                    triggerReferralError(.networkError)
                }
            }
        }
    }

    private func triggerReferralError(_ error: ReferralCodeError) {
        referralError = error
        HapticManager.shared.error()

        // Trigger shake animation
        withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
            shakeReferralField = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            shakeReferralField = false
        }
    }

    private func openSupport() {
        // Open support email with prefilled content
        let subject = "Waitlist Application - Assistance Needed".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let body = "I need help with my application...".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""

        if let url = URL(string: "mailto:support@flent.app?subject=\(subject)&body=\(body)") {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Waitlist Hourglass Animation

struct WaitlistHourglassAnimation: View {
    let isLongWait: Bool

    @State private var rotation: Double = 0
    @State private var sandOffset: CGFloat = 0

    var body: some View {
        ZStack {
            // Background glow
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            (isLongWait ? AppColors.warning : AppColors.accentPrimary).opacity(0.2),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 30,
                        endRadius: 60
                    )
                )
                .frame(width: 120, height: 120)

            // Hourglass icon
            Image(systemName: isLongWait ? "hourglass.bottomhalf.filled" : "hourglass")
                .font(.system(size: 56))
                .foregroundColor(isLongWait ? AppColors.warning : AppColors.accentPrimary)
                .rotationEffect(.degrees(rotation))
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                rotation = isLongWait ? 0 : 15
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

// Note: TextButton and SecondaryButton are defined in Core/DesignSystem/Components/PrimaryButton.swift

#Preview("Loading") {
    WaitlistView()
        .environment(AppCoordinator())
}

#Preview("Pending") {
    WaitlistView()
        .environment(AppCoordinator())
}

#Preview("Approved") {
    WaitlistView()
        .environment(AppCoordinator())
}

#Preview("Rejected") {
    WaitlistView()
        .environment(AppCoordinator())
}
