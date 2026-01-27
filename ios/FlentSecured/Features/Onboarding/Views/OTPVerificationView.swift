/// OTPVerificationView.swift
/// Flent Secured v2 - OTP Verification Screen
///
/// Figma: node-id=1:31277
/// - Presented as bottom sheet (dark bg #1A1A1A)
/// - "Let's verify your number" title
/// - "We've sent a 4-digit code..." subtitle
/// - 4 OTP boxes
/// - "Proceed" button
/// - "Didn't receive the code? Resend" link

import SwiftUI

struct OTPVerificationView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    let phone: String

    @State private var viewModel: OTPVerificationViewModel
    @State private var otpCode: String = ""

    init(phone: String) {
        self.phone = phone
        self._viewModel = State(initialValue: OTPVerificationViewModel(phone: phone))
    }

    var body: some View {
        ZStack {
            // Background with phone entry visible behind
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            // Dimmed background content (simulating the phone screen behind)
            VStack(alignment: .leading) {
                FlentLogo()
                    .padding(.top, Spacing.xxl)

                Spacer()
                    .frame(height: Spacing.huge)

                VStack(alignment: .leading, spacing: 0) {
                    Text("Let's get to")
                        .font(.system(size: 40, weight: .light))
                        .foregroundColor(.white.opacity(0.3))
                    Text("know you")
                        .font(.system(size: 40, weight: .light))
                        .foregroundColor(AppColors.brand500.opacity(0.3))
                }

                Spacer()
            }
            .padding(.horizontal, Spacing.screenHorizontal)

            // Bottom sheet
            VStack {
                Spacer()

                BottomSheetContainer {
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        // Title
                        Text("Let's verify your number")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(.white)

                        // Subtitle
                        Text("We've sent a 4-digit code to your phone. It'll auto-verify once entered")
                            .font(.system(size: 14, weight: .regular))
                            .foregroundColor(AppColors.neutral500)

                        // OTP Input - 4 digits
                        OTPInputField(otp: $otpCode, digitCount: 4) { code in
                            handleOTPComplete(code)
                        }
                        .frame(maxWidth: .infinity, alignment: .center)

                        // Error Message
                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(.system(size: 14, weight: .regular))
                                .foregroundColor(AppColors.error)
                        }

                        // Proceed Button
                        PrimaryButton(
                            title: "Proceed",
                            isLoading: viewModel.isVerifying,
                            isEnabled: otpCode.count == 4
                        ) {
                            verifyOTP()
                        }

                        // Resend link
                        Button(action: {
                            resendOTP()
                        }) {
                            HStack(spacing: 4) {
                                Text("Didn't receive the code?")
                                    .foregroundColor(AppColors.neutral500)
                                Text("Resend")
                                    .foregroundColor(AppColors.brand500)
                            }
                            .font(.system(size: 14, weight: .medium))
                        }
                        .frame(maxWidth: .infinity)
                        .disabled(!viewModel.canResend)
                        .opacity(viewModel.canResend ? 1 : 0.5)
                    }
                }
            }
        }
        .navigationBarHidden(true)
        .onAppear {
            viewModel.startResendTimer()
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.errorMessage)
    }

    private func handleOTPComplete(_ code: String) {
        // Update viewModel with new OTP format
        for (index, char) in code.enumerated() {
            if index < viewModel.otpDigits.count {
                viewModel.otpDigits[index] = String(char)
            }
        }
        // Auto-verify
        verifyOTP()
    }

    // MARK: - OTP Logic

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
                // For new users, go directly to name verification
                // For existing users, fetch profile and route based on status
                if result.isNewUser {
                    coordinator.navigate(to: .nameVerification)
                } else {
                    // Existing user - fetch profile and route appropriately
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
            _ = await viewModel.resendOTP()
        }
    }
}

#Preview("OTP Verification") {
    OTPVerificationView(phone: "+919999999999")
        .environment(AppCoordinator())
        .environment(AppState())
}
