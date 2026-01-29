/// OTPVerificationView.swift
/// Flent Secured v2 - OTP Verification Screen
///
/// Figma Node IDs:
/// - 1:31175 - auth / sign up --enter OTP (Empty state - primary reference)
/// - 1:30074 - auth / sign up --enter OTP (Alternate)
/// - 1:31277 - auth / sign up --OTP Filled (All 6 digits entered)
/// - 1:31380 - auth / sign up --OTP Error 2 (Max attempts)
/// - 1:31485 - auth / sign up --OTP Error 1 (Wrong code)
///
/// PIXEL PERFECT from Figma screenshot (1:31175):
/// - Presented as bottom sheet overlay on dimmed phone entry screen
/// - Background: #1A1A1A (black/600)
/// - Corner radius: 24px (top corners only)
/// - Drag handle: 40x4px, #4D4D4D, rd-2
///
/// OTP Input Specifications:
/// - Box count: 6 with dash separator (000-000 format)
/// - Box size: 48x56px
/// - Box spacing: 12px (8px around dash)
/// - Background: #262626 (empty), #1A1A1A (filled)
/// - Border: 1px #4D4D4D default, 2px #FF9A6D focused, 2px #FF8080 error
/// - Corner radius: 12px
/// - Text: 24px SemiBold White, centered
/// - Cursor: 2px #FF9A6D blinking bar when focused and empty
///
/// Content Layout:
/// - Title: "Let's verify your number" - H1/Regular 400 (48px)
///   - "Let's verify" in gray (#A9A9A9)
///   - "your number" in brand (#FF9A6D)
/// - Subtitle: "We've sent a 6-digit code to your phone. It'll auto-verify once entered" - 14px
/// - Error message: 14px Regular #FF8080 (when invalid)
/// - Button: "Proceed" - disabled until 6 digits entered
/// - Resend link: "Didn't receive the code? Resend" - 14px
///   - Timer: "Resend in 0:30" when countdown active

import SwiftUI

struct OTPVerificationView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    let phone: String

    @State private var viewModel: OTPVerificationViewModel
    @State private var otpCode: String = ""

    // Animation states
    @State private var showSheet = false
    @State private var shakeOTP = false

    init(phone: String) {
        self.phone = phone
        self._viewModel = State(initialValue: OTPVerificationViewModel(phone: phone))
    }

    /// Format phone number for display with masking
    /// Returns: "+91 98XXX XXXXX" format
    private var formattedPhone: String {
        let cleaned = phone.replacingOccurrences(of: " ", with: "")
        if cleaned.hasPrefix("+91") && cleaned.count >= 13 {
            let prefix = String(cleaned.prefix(5)) // +91 + first 2 digits
            return "\(prefix)XXX XXXXX"
        }
        return phone
    }

    var body: some View {
        ZStack {
            // Background with phone entry visible behind (dimmed)
            backgroundContent

            // Bottom sheet with OTP form
            VStack {
                Spacer()

                if showSheet {
                    otpBottomSheet
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .navigationBarHidden(true)
        .onAppear {
            // Animate sheet in
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                showSheet = true
            }
            viewModel.startResendTimer()
        }
        .onChange(of: viewModel.errorMessage) { _, newError in
            if newError != nil {
                // Trigger shake animation
                triggerShake()
                // Haptic error feedback
                HapticManager.shared.error()
            }
        }
    }

    // MARK: - Background Content (Dimmed Phone Entry Screen)

    private var backgroundContent: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            DottedGridPattern()
                .ignoresSafeArea()

            // Dimmed content from phone entry (visual continuity)
            VStack(alignment: .leading) {
                FlentLogo()
                    .padding(.top, Spacing.xxl) // 40pt

                Spacer()
                    .frame(height: Spacing.xxl) // 40pt gap

                VStack(alignment: .leading, spacing: 0) {
                    Text("Let's get to")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.neutral500.opacity(0.3))
                        .tracking(-2)
                    Text("know you")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.brand500.opacity(0.3))
                        .tracking(-2)
                }

                Spacer()
            }
            .padding(.horizontal, Spacing.xxxl) // 48pt horizontal (sp-48)
        }
    }

    // MARK: - OTP Bottom Sheet

    private var otpBottomSheet: some View {
        VStack(spacing: 0) {
            // Drag handle - Figma: 40x4px, #4D4D4D, rd-2
            DragHandle()
                .padding(.top, Spacing.md)
                .padding(.bottom, Spacing.lg)

            // Content
            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Title - Figma: H1 style, two-color format
                // "Let's verify" (gray) + "your number" (brand)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Let's verify")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.neutral500) // #A9A9A9
                        .tracking(-2)
                        .lineSpacing(16)
                    Text("your number")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.brand500) // #FF9A6D
                        .tracking(-2)
                        .lineSpacing(16)
                }
                .accessibilityAddTraits(.isHeader)

                // Subtitle - Figma: 14px Regular, describes auto-verify
                Text("We've sent a 6-digit code to your phone.\nIt'll auto-verify once entered")
                    .font(Typography.bodyMd2) // 14px Regular
                    .foregroundColor(AppColors.black200) // #A6A6A6
                    .lineSpacing(6)
                    .accessibilityLabel("Verification code sent to \(formattedPhone). It will auto-verify once entered")

                // OTP Input - 6 boxes per Figma spec
                OTPInputFieldSixDigit(
                    otp: $otpCode,
                    hasError: viewModel.errorMessage != nil
                ) { code in
                    handleOTPComplete(code)
                }
                .shake(trigger: shakeOTP)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, Spacing.sm)
                .accessibilityIdentifier("otp_input")

                // Error Message
                if let error = viewModel.errorMessage {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .font(.system(size: 14))
                        Text(error)
                            .font(.system(size: 14, weight: .regular))
                    }
                    .foregroundColor(AppColors.error)
                    .transition(.opacity.combined(with: .move(edge: .top)))
                    .accessibilityLabel("Error: \(error)")
                }

                // Proceed Button - Figma: "Proceed", disabled until 6 digits
                PrimaryButton(
                    title: "Proceed",
                    isLoading: viewModel.isVerifying,
                    isEnabled: otpCode.count == OTPVerificationViewModel.otpDigitCount && !viewModel.isVerifying
                ) {
                    verifyOTP()
                }
                .accessibilityIdentifier("proceed_button")
                .accessibilityHint(otpCode.count == OTPVerificationViewModel.otpDigitCount ? "Double tap to proceed" : "Enter all 6 digits to continue")

                // Resend link with timer
                resendSection
                    .padding(.top, Spacing.xs)
            }
            .padding(.horizontal, Spacing.xxxl) // 48pt horizontal (sp-48)
            .padding(.bottom, Spacing.xl) // 32pt bottom
        }
        .frame(maxWidth: .infinity)
        .background(AppColors.backgroundSecondary)
        .clipShape(RoundedCorner(radius: Radius.xl, corners: [.topLeft, .topRight]))
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: viewModel.errorMessage)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: viewModel.isVerifying)
    }

    // MARK: - Resend Section

    private var resendSection: some View {
        Group {
            if viewModel.canResend {
                // Resend available - Figma: "Didn't receive the code? Resend"
                Button(action: {
                    resendOTP()
                }) {
                    HStack(spacing: 4) {
                        Text("Didn't receive the code?")
                            .foregroundColor(AppColors.neutral500)
                        Text("Resend")
                            .foregroundColor(AppColors.brand500)
                            .underline()
                    }
                    .font(Typography.bodyMd2) // 14px Regular
                }
                .disabled(viewModel.isResending)
                .opacity(viewModel.isResending ? 0.5 : 1)
                .accessibilityLabel("Resend verification code")
            } else {
                // Countdown timer - Format: MM:SS
                HStack(spacing: 4) {
                    Text("Resend code in")
                        .foregroundColor(AppColors.neutral500)
                    Text(String(format: "%02d:%02d", viewModel.resendCountdown / 60, viewModel.resendCountdown % 60))
                        .foregroundColor(.white)
                        .fontWeight(.medium)
                }
                .font(.system(size: 16, weight: .regular))
                .accessibilityLabel("Resend available in \(viewModel.resendCountdown) seconds")
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Actions

    private func triggerShake() {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
            shakeOTP = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            shakeOTP = false
        }
    }

    private func handleOTPComplete(_ code: String) {
        // Update viewModel with new OTP
        for (index, char) in code.enumerated() {
            if index < viewModel.otpDigits.count {
                viewModel.otpDigits[index] = String(char)
            }
        }
        // Auto-verify on complete with small delay for visual feedback
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            verifyOTP()
        }
    }

    private func verifyOTP() {
        // Update viewModel digits from otpCode
        for (index, char) in otpCode.enumerated() {
            if index < viewModel.otpDigits.count {
                viewModel.otpDigits[index] = String(char)
            }
        }

        Task {
            let result = await viewModel.verifyOTP()

            if let result = result {
                // Success haptic
                HapticManager.shared.success()

                // Route based on user status
                if result.isNewUser {
                    coordinator.navigate(to: .nameVerification)
                } else {
                    let nextRoute = await viewModel.determineNextRouteAsync()
                    coordinator.navigate(to: nextRoute)
                }
            } else {
                // Error occurred - clear OTP for retry
                otpCode = ""
            }
        }
    }

    private func resendOTP() {
        Task {
            let success = await viewModel.resendOTP()
            if success {
                HapticManager.shared.success()
            }
        }
    }
}

// MARK: - 6-Digit OTP Input Field

/// 6-digit OTP input per Figma specifications (1:31175)
/// - Box count: 6 with dash separator (000-000 format)
/// - Box size: 48x56px
/// - Gap: 12px between boxes, 8px around dash
/// - Background: #262626 (empty), #1A1A1A (filled)
/// - Border: 1px #4D4D4D default, 2px #FF9A6D focused, 2px #FF8080 error
/// - Corner radius: 12px
/// - Text: 24px SemiBold White, centered
/// - Cursor: 2px #FF9A6D blinking bar
struct OTPInputFieldSixDigit: View {
    @Binding var otp: String
    var hasError: Bool = false
    var onComplete: ((String) -> Void)?

    @FocusState private var isFocused: Bool
    @State private var cursorVisible = true

    private let digitCount = 6

    var body: some View {
        HStack(spacing: Spacing.sm) { // 12px gap
            // First 3 digits
            ForEach(0..<3, id: \.self) { index in
                OTPDigitBoxSixDigit(
                    digit: getDigit(at: index),
                    isFocused: isFocused && index == otp.count,
                    hasError: hasError,
                    isFilled: index < otp.count,
                    cursorVisible: cursorVisible
                )
                .onTapGesture {
                    isFocused = true
                }
            }

            // Dash separator - Figma: between 3rd and 4th digit
            Text("-")
                .font(.system(size: 24, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .padding(.horizontal, Spacing.xxs) // 4px padding around dash

            // Last 3 digits
            ForEach(3..<6, id: \.self) { index in
                OTPDigitBoxSixDigit(
                    digit: getDigit(at: index),
                    isFocused: isFocused && index == otp.count,
                    hasError: hasError,
                    isFilled: index < otp.count,
                    cursorVisible: cursorVisible
                )
                .onTapGesture {
                    isFocused = true
                }
            }
        }
        .background(
            // Hidden text field for keyboard input
            TextField("", text: $otp)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode) // iOS auto-fill support
                .focused($isFocused)
                .frame(width: 1, height: 1)
                .opacity(0.01)
                .onChange(of: otp) { _, newValue in
                    handleOTPChange(newValue)
                }
        )
        .onAppear {
            // Auto-focus
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                isFocused = true
            }
            // Start cursor blink animation - 600ms per Figma
            startCursorBlink()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Enter 6-digit verification code")
        .accessibilityValue(otp.isEmpty ? "Empty" : "\(otp.count) digits entered")
        .accessibilityHint("Enter the code sent to your phone")
    }

    private func getDigit(at index: Int) -> String {
        guard index < otp.count else { return "" }
        let idx = otp.index(otp.startIndex, offsetBy: index)
        return String(otp[idx])
    }

    private func handleOTPChange(_ newValue: String) {
        // Filter to digits only
        let filtered = newValue.filter { $0.isNumber }

        // Limit to 6 digits
        let limited = String(filtered.prefix(digitCount))

        if limited != otp {
            otp = limited
        }

        // Call completion when all digits entered
        if limited.count == digitCount {
            HapticManager.shared.success()
            onComplete?(limited)
        }
    }

    private func startCursorBlink() {
        Timer.scheduledTimer(withTimeInterval: 0.6, repeats: true) { _ in
            cursorVisible.toggle()
        }
    }
}

// MARK: - OTP Digit Box (6-digit version)

/// Single OTP digit box with all visual states per Figma
/// - Size: 48x56px
/// - Corner radius: 12px
/// - Empty background: #262626
/// - Filled background: #1A1A1A
/// - Border default: 1px #4D4D4D
/// - Border focused: 2px #00C853
/// - Border error: 2px #FF8080
/// - Text: 24px SemiBold White
struct OTPDigitBoxSixDigit: View {
    let digit: String
    let isFocused: Bool
    let hasError: Bool
    let isFilled: Bool
    var cursorVisible: Bool = true

    var body: some View {
        ZStack {
            // Background - Figma: #262626 empty, #1A1A1A filled
            RoundedRectangle(cornerRadius: Radius.md) // 12px per Figma spec
                .fill(backgroundColor)
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md)
                        .stroke(borderColor, lineWidth: borderWidth)
                )

            // Content: Cursor or Digit
            if digit.isEmpty {
                if isFocused && cursorVisible {
                    // Blinking cursor - 2px wide, #00C853 (brand green in Figma doc)
                    Rectangle()
                        .fill(AppColors.brand500)
                        .frame(width: 2, height: 24)
                }
            } else {
                // Digit text - 24px SemiBold White per Figma
                Text(digit)
                    .font(.system(size: 24, weight: .semibold, design: .monospaced))
                    .foregroundColor(.white)
            }
        }
        .frame(width: 48, height: 56) // Per Figma spec
        .animation(.easeInOut(duration: 0.15), value: isFocused)
        .animation(.easeInOut(duration: 0.15), value: hasError)
        .animation(.easeInOut(duration: 0.15), value: isFilled)
    }

    private var backgroundColor: Color {
        // Figma: #262626 empty, #1A1A1A filled
        digit.isEmpty ? Color(hex: "262626") : AppColors.backgroundSecondary
    }

    private var borderColor: Color {
        if hasError {
            return AppColors.error // #FF8080
        } else if isFocused {
            return AppColors.brand500 // #FF9A6D (using brand for focus)
        } else if isFilled {
            return AppColors.brand500.opacity(0.3) // Subtle border when filled
        }
        return AppColors.black400 // #4D4D4D
    }

    private var borderWidth: CGFloat {
        if hasError || isFocused {
            return 2
        }
        return 1
    }
}

// MARK: - Previews

#Preview("OTP Empty") {
    OTPVerificationView(phone: "+919876543210")
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("OTP 6-Digit Partial") {
    struct PreviewWrapper: View {
        @State private var code = "123"

        var body: some View {
            ZStack {
                AppColors.backgroundSecondary
                    .ignoresSafeArea()

                OTPInputFieldSixDigit(otp: $code)
            }
        }
    }
    return PreviewWrapper()
}

#Preview("OTP 6-Digit Filled") {
    struct PreviewWrapper: View {
        @State private var code = "123456"

        var body: some View {
            ZStack {
                AppColors.backgroundSecondary
                    .ignoresSafeArea()

                OTPInputFieldSixDigit(otp: $code)
            }
        }
    }
    return PreviewWrapper()
}

#Preview("OTP 6-Digit Error") {
    struct PreviewWrapper: View {
        @State private var code = "123456"

        var body: some View {
            ZStack {
                AppColors.backgroundSecondary
                    .ignoresSafeArea()

                OTPInputFieldSixDigit(otp: $code, hasError: true)
            }
        }
    }
    return PreviewWrapper()
}
