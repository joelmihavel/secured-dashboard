/// PhoneEntryView.swift
/// Flent Secured v2 - Phone Number Entry Screen
///
/// States handled:
/// - .idle: Initial state with empty phone field
/// - .loading: Sending OTP
/// - .success: OTP sent successfully
/// - .error: Error state
///
/// Figma: auth / sign up --enter phone number (and variants)

import SwiftUI

struct PhoneEntryView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = PhoneEntryViewModel()
    @FocusState private var isPhoneFocused: Bool

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Header
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Enter your phone number")
                        .font(Typography.h4)
                        .foregroundColor(AppColors.textPrimary)

                    Text("We'll send you a verification code")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.textSecondary)
                }

                // Phone Input
                HStack(spacing: Spacing.sm) {
                    // Country Code
                    Text("+91")
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)
                        .padding(.horizontal, Spacing.md)
                        .frame(height: 56)
                        .background(AppColors.backgroundSecondary)
                        .cornerRadius(Radius.input)

                    // Phone Number Field
                    TextField("Enter 10-digit mobile number", text: $viewModel.phoneNumber)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)
                        .keyboardType(.numberPad)
                        .textContentType(.telephoneNumber)
                        .padding(.horizontal, Spacing.md)
                        .frame(height: 56)
                        .background(AppColors.backgroundSecondary)
                        .cornerRadius(Radius.input)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.input)
                                .stroke(
                                    viewModel.errorMessage != nil ? AppColors.error : AppColors.border,
                                    lineWidth: 1
                                )
                        )
                        .focused($isPhoneFocused)
                        .accessibilityIdentifier("phone_input")
                        .accessibilityLabel("Phone number")
                }

                // Error Message
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.error)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }

                Spacer()

                // Continue Button
                PrimaryButton(
                    title: "Continue",
                    isLoading: viewModel.isLoading,
                    isEnabled: viewModel.canProceed
                ) {
                    sendOTP()
                }
            }
            .screenPadding()
            .padding(.top, Spacing.xl)
        }
        .navigationBarHidden(true)
        .onAppear {
            isPhoneFocused = true
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.errorMessage)
    }

    private func sendOTP() {
        isPhoneFocused = false

        Task {
            let success = await viewModel.sendOTP()
            if success {
                coordinator.navigate(to: .otpVerification(phone: viewModel.fullPhoneNumber))
            }
        }
    }
}

#Preview("Empty") {
    PhoneEntryView()
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("With Number") {
    struct PreviewWrapper: View {
        @State var viewModel = PhoneEntryViewModel.previewWithPhone

        var body: some View {
            PhoneEntryView()
                .environment(AppCoordinator())
                .environment(AppState())
        }
    }
    return PreviewWrapper()
}

#Preview("Error") {
    struct PreviewWrapper: View {
        @State var viewModel = PhoneEntryViewModel.previewError

        var body: some View {
            PhoneEntryView()
                .environment(AppCoordinator())
                .environment(AppState())
        }
    }
    return PreviewWrapper()
}
