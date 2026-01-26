/// OTPVerificationView.swift
/// Flent Secured v2 - OTP Verification Screen
///
/// States handled:
/// - .idle: Entering OTP digits
/// - .verifying: Verifying OTP with backend
/// - .verified: Successfully verified
/// - .error: Invalid OTP or verification failed
///
/// Figma: auth / sign up --enter OTP (and variants)

import SwiftUI

struct OTPVerificationView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    let phone: String

    @State private var viewModel: OTPVerificationViewModel
    @FocusState private var focusedField: Int?

    init(phone: String) {
        self.phone = phone
        self._viewModel = State(initialValue: OTPVerificationViewModel(phone: phone))
    }

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Back Button
                Button {
                    coordinator.pop()
                } label: {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(AppColors.textPrimary)
                        .frame(width: 44, height: 44) // Minimum tap target for accessibility
                }
                .accessibilityIdentifier("back_button")
                .accessibilityLabel("Go back")

                // Header
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Enter verification code")
                        .font(Typography.h4)
                        .foregroundColor(AppColors.textPrimary)

                    Text("We sent a code to \(phone)")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.textSecondary)
                }

                // OTP Input Fields
                HStack(spacing: Spacing.xs) {
                    ForEach(0..<6, id: \.self) { index in
                        OTPDigitField(
                            digit: $viewModel.otpDigits[index],
                            isFocused: focusedField == index,
                            hasError: viewModel.errorMessage != nil
                        )
                        .focused($focusedField, equals: index)
                        .onChange(of: viewModel.otpDigits[index]) { _, newValue in
                            handleDigitChange(at: index, newValue: newValue)
                        }
                        .accessibilityIdentifier("otp_input_\(index)")
                    }
                }

                // Error Message
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.error)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }

                // Resend Code
                HStack {
                    Text("Didn't receive a code?")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textSecondary)

                    if viewModel.canResend {
                        Button("Resend") {
                            resendOTP()
                        }
                        .font(Typography.bodySmMedium)
                        .foregroundColor(AppColors.accentPrimary)
                        .disabled(viewModel.isResending)
                    } else {
                        Text("Resend in \(viewModel.resendCountdown)s")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textMuted)
                    }
                }

                // Mobile 360 Consent
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Toggle(isOn: $viewModel.consentForMobile360) {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: Spacing.xxs) {
                                Text("Allow identity verification")
                                    .font(Typography.bodySm)
                                    .foregroundColor(AppColors.textPrimary)
                                Text("*")
                                    .font(Typography.bodySm)
                                    .foregroundColor(AppColors.error)
                            }
                            Text("We'll fetch your name from your mobile number")
                                .font(Typography.caption)
                                .foregroundColor(AppColors.textMuted)
                        }
                    }
                    .toggleStyle(SwitchToggleStyle(tint: AppColors.accentPrimary))
                    .accessibilityIdentifier("consent_toggle")

                    // Consent warning message
                    if let consentError = viewModel.consentErrorMessage {
                        Text(consentError)
                            .font(Typography.caption)
                            .foregroundColor(AppColors.error)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }

                Spacer()

                // Verify Button
                PrimaryButton(
                    title: "Verify",
                    isLoading: viewModel.isVerifying,
                    isEnabled: viewModel.canVerify
                ) {
                    verifyOTP()
                }
            }
            .screenPadding()
            .padding(.top, Spacing.xl)
        }
        .navigationBarHidden(true)
        .onAppear {
            focusedField = 0
            viewModel.startResendTimer()
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.errorMessage)
        .animation(.easeInOut(duration: 0.2), value: viewModel.consentForMobile360)
    }

    // MARK: - OTP Logic

    private func handleDigitChange(at index: Int, newValue: String) {
        if let nextIndex = viewModel.handleDigitInput(at: index, newValue: newValue) {
            focusedField = nextIndex
        } else if viewModel.isOTPComplete && viewModel.canVerify {
            // Auto-verify when complete and consent given
            focusedField = nil
            verifyOTP()
        }
    }

    private func verifyOTP() {
        focusedField = nil

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
                // Error occurred - focus first field
                focusedField = 0
            }
        }
    }

    private func resendOTP() {
        Task {
            _ = await viewModel.resendOTP()
        }
    }
}

// MARK: - OTP Digit Field

struct OTPDigitField: View {
    @Binding var digit: String
    let isFocused: Bool
    var hasError: Bool = false

    var body: some View {
        TextField("", text: $digit)
            .font(Typography.otpInput)
            .foregroundColor(AppColors.textPrimary)
            .multilineTextAlignment(.center)
            .keyboardType(.numberPad)
            .textContentType(.oneTimeCode)
            .frame(width: 48, height: 56)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.sm)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .stroke(
                        hasError ? AppColors.error :
                        isFocused ? AppColors.accentPrimary : AppColors.border,
                        lineWidth: isFocused ? 2 : 1
                    )
            )
            .animation(.easeInOut(duration: 0.15), value: isFocused)
    }
}

#Preview("Empty") {
    OTPVerificationView(phone: "+919999999999")
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("With OTP") {
    struct PreviewWrapper: View {
        var body: some View {
            OTPVerificationView(phone: "+919999999999")
                .environment(AppCoordinator())
                .environment(AppState())
        }
    }
    return PreviewWrapper()
}

#Preview("Error") {
    OTPVerificationView(phone: "+919999999999")
        .environment(AppCoordinator())
        .environment(AppState())
}
