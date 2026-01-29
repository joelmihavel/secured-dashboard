import SwiftUI

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
            AppColors.black600 // #1A1A1A - Figma: Frame 1686557301
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Drag Indicator
                Capsule()
                    .fill(AppColors.black400)
                    .frame(width: 48, height: 4)
                    .padding(.top, 16)
                    .padding(.bottom, 32)
                
                // Content
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 12) {
                        Text("Let’s verify your number")
                            .font(Typography.h4)
                            .foregroundColor(AppColors.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        
                        Text("We’ve sent a 6-digit code to your phone. It’ll auto-verify once entered")
                            .font(Typography.bodyMd2) // 14px
                            .foregroundColor(AppColors.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .lineSpacing(4)
                    }
                    
                    // OTP Input Section
                    VStack(spacing: 8) {
                        // Input Fields
                        HStack(spacing: 8) {
                            // First 3
                            ForEach(0..<3) { index in
                                otpDigitBox(at: index)
                            }
                            
                            // Dash separator
                            Text("-")
                                .font(Typography.h4)
                                .foregroundColor(AppColors.black400)
                                .padding(.horizontal, 4)
                            
                            // Last 3
                            ForEach(3..<6) { index in
                                otpDigitBox(at: index)
                            }
                        }
                        .background(
                            // Hidden text field
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
                        
                        // Error Text
                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(Typography.caption)
                                .foregroundColor(AppColors.error)
                                .frame(maxWidth: .infinity, alignment: .center) // Centered
                                .padding(.top, 4)
                        }
                    }
                    
                    Spacer().frame(height: 16)
                    
                    // Proceed Button
                    PrimaryButton(
                        title: "Proceed",
                        isLoading: viewModel.isVerifying,
                        isEnabled: otpInput.count == 6 && !viewModel.isVerifying
                    ) {
                        submitOTP()
                    }
                    
                    // Resend Link
                    Button(action: {
                        Task { await viewModel.resendOTP() }
                    }) {
                        Text(viewModel.canResend ? "Didn’t receive the code? Resend" : "Resend available in \(viewModel.resendCountdown)s")
                            .font(Typography.bodySm)
                            .foregroundColor(viewModel.canResend ? AppColors.textSecondary : AppColors.textDisabled)
                    }
                    .disabled(!viewModel.canResend || viewModel.isVerifying)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
                
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
    }
    
    // MARK: - Helper Views
    
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

                // Success - navigate based on user status
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