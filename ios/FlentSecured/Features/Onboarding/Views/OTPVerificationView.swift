import SwiftUI

/// OTP Verification View
/// Figma Nodes: 1-31175 (empty), 1-31485 (wrong code), 1-31380 (too many attempts), 1-31277 (filled)
///
/// Key specs:
/// - Bottom sheet with drag indicator
/// - Title: "Let's verify your number" (H4/Regular 28px)
/// - Subtitle: "We've sent a 6-digit code..." (12px Medium, #A9A9A9)
/// - OTP: 6 boxes with dash separator (000-000)
/// - Error: Red text centered below boxes
/// - Button: "Proceed" with bar indicator when enabled
struct OTPVerificationView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState
    @State private var viewModel: OTPVerificationViewModel

    /// User's name passed from PhoneEntryView
    let name: String

    // Local state for the hidden TextField input mechanism
    @State private var otpInput: String = ""
    @FocusState private var focusedIndex: Int?
    @State private var cursorVisible = true

    init(phone: String, name: String = "") {
        _viewModel = State(initialValue: OTPVerificationViewModel(phone: phone))
        self.name = name
    }

    // MARK: - Body
    var body: some View {
        ZStack {
            AppColors.black600 // #1A1A1A - Figma bottom sheet background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Drag Indicator - Figma: 48×4, gray (#4D4D4D), rounded-200
                Capsule()
                    .fill(AppColors.black400)
                    .frame(width: 48, height: 4)
                    .padding(.top, 15) // Figma: pt-15.192
                    .padding(.bottom, 24)

                // Content
                VStack(spacing: 30) { // Figma: gap-30.383px
                    // Header - Figma: gap-10px, px-48
                    VStack(alignment: .leading, spacing: 10) {
                        // Title: H4/Regular 28px, tracking -1px
                        Text("Let's verify your number")
                            .font(Typography.h4)
                            .foregroundColor(AppColors.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        // Subtitle: 12px Medium, #A9A9A9, tracking -0.132
                        Text("We've sent a 6-digit code to your phone. It'll auto-verify once entered")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppColors.neutral500) // #A9A9A9
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .lineSpacing(4)
                    }
                    .padding(.horizontal, Spacing.xxxl) // 48pt

                    // OTP Input Section - Figma: gap-6px
                    VStack(spacing: 6) {
                        // Input Fields - Figma: gap-8px
                        HStack(spacing: 8) {
                            // First 3
                            ForEach(0..<3, id: \.self) { index in
                                otpDigitBox(at: index)
                            }

                            // Dash separator - Figma: 20px Medium, #CBCBCB
                            Text("-")
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(AppColors.neutral300)
                                .padding(.horizontal, 4)

                            // Last 3
                            ForEach(3..<6, id: \.self) { index in
                                otpDigitBox(at: index)
                            }
                        }
                        .background(
                            // Hidden text field for OTP input
                            TextField("", text: $otpInput)
                                .keyboardType(.numberPad)
                                .textContentType(.oneTimeCode)
                                .focused($focusedIndex, equals: 0)
                                .frame(width: 1, height: 1)
                                .opacity(0.01)
                                .disabled(viewModel.isVerifying)
                                .onChange(of: otpInput) { _, newValue in
                                    handleOTPChange(newValue)
                                }
                        )

                        // Error Text - Figma: centered, 14px Medium, red
                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(AppColors.error) // Red #FF8080
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.top, 8)
                                .transition(.opacity)
                        }
                    }

                    // Button + Resend - Figma: gap-16px, px-48
                    VStack(spacing: Spacing.md) { // 16pt
                        // Proceed Button - show bar indicator when enabled (Figma 1-31277)
                        PrimaryButton(
                            title: "Proceed",
                            isLoading: viewModel.isVerifying,
                            isEnabled: otpInput.count == 6 && !viewModel.isVerifying,
                            showBarIndicator: otpInput.count == 6 && !viewModel.isVerifying
                        ) {
                            submitOTP()
                        }

                        // Resend Link - Figma: 12px Regular, #A9A9A9, centered
                        Button(action: {
                            Task { await viewModel.resendOTP() }
                        }) {
                            Text(viewModel.canResend ? "Didn't receive the code? Resend" : "Resend available in \(viewModel.resendCountdown)s")
                                .font(Typography.bodySm)
                                .foregroundColor(viewModel.canResend ? AppColors.neutral500 : AppColors.textDisabled)
                        }
                        .disabled(!viewModel.canResend || viewModel.isVerifying)
                    }
                    .padding(.horizontal, Spacing.xxxl) // 48pt
                }
                .padding(.top, Spacing.md) // 16pt
                .padding(.bottom, Spacing.lg) // 24pt

                Spacer()
            }
        }
        .onAppear {
            // Auto focus
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                focusedIndex = 0
            }
            startCursorBlink()
            viewModel.startResendTimer()
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.errorMessage)
    }
    
    // MARK: - Helper Views

    /// Creates an OTP digit box for the given index
    /// Uses the OTPDigitBox component from DesignSystem
    private func otpDigitBox(at index: Int) -> some View {
        OTPDigitBox(
            digit: getDigit(at: index),
            isFocused: index == otpInput.count,
            hasError: viewModel.errorMessage != nil,
            isFilled: index < otpInput.count,
            cursorVisible: cursorVisible
        )
        .onTapGesture {
            focusedIndex = 0 // Focus the hidden field
        }
    }
    
    // MARK: - Logic
    
    private func getDigit(at index: Int) -> String {
        guard index < otpInput.count else { return "" }
        let idx = otpInput.index(otpInput.startIndex, offsetBy: index)
        return String(otpInput[idx])
    }
    
    private func handleOTPChange(_ newValue: String) {
        let filtered = newValue.filter { $0.isNumber }
        let limited = String(filtered.prefix(6))
        
        if limited != otpInput {
            otpInput = limited
        }
        
        // Sync with ViewModel
        updateViewModelDigits(from: limited)
        
        if limited.count == 6 {
            // Auto submit
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                submitOTP()
            }
        }
    }
    
    private func updateViewModelDigits(from text: String) {
        // Create 6-element array
        var newDigits = Array(repeating: "", count: 6)
        for (i, char) in text.enumerated() {
            if i < 6 { newDigits[i] = String(char) }
        }
        viewModel.otpDigits = newDigits
    }
    
    private func submitOTP() {
        Task {
            if let _ = await viewModel.verifyOTP() {
                // Store the name entered during phone entry for NameVerificationView
                if !name.isEmpty {
                    appState.pendingUserName = name
                }

                // Success - dismiss sheet then navigate
                coordinator.dismiss()

                // Small delay to allow sheet dismissal animation
                try? await Task.sleep(for: .milliseconds(300))

                if let route = viewModel.determineNextRoute() {
                    coordinator.navigate(to: route)
                }
            }
        }
    }
    
    private func startCursorBlink() {
        Timer.scheduledTimer(withTimeInterval: 0.6, repeats: true) { _ in
            cursorVisible.toggle()
        }
    }
}

#Preview {
    OTPVerificationView(phone: "+91 98765 43210")
}