/// PhoneEntryView.swift
/// Flent Secured v2 - Phone Number Entry Screen
///
/// Figma: node-id=1:29108
/// - Dark background with dotted pattern
/// - Logo at top-left
/// - "Let's get to" (white) + "know you" (orange)
/// - Phone input with underline style
/// - Consent toggle
/// - Get Started button (disabled until valid)

import SwiftUI

struct PhoneEntryView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = PhoneEntryViewModel()
    @State private var consentGiven = false
    @FocusState private var isPhoneFocused: Bool

    var body: some View {
        ZStack {
            // Background
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Logo
                FlentLogo()
                    .padding(.top, Spacing.xxl)

                Spacer()
                    .frame(height: Spacing.huge)

                // Headline
                VStack(alignment: .leading, spacing: 0) {
                    Text("Let's get to")
                        .font(.system(size: 40, weight: .light))
                        .foregroundColor(.white)
                    Text("know you")
                        .font(.system(size: 40, weight: .light))
                        .foregroundColor(AppColors.brand500)
                }

                Spacer()
                    .frame(height: Spacing.xxl)

                // Phone Input - Underline style
                PhoneInputField(
                    label: "Phone",
                    text: $viewModel.phoneNumber,
                    placeholder: "Enter Number",
                    errorMessage: viewModel.errorMessage,
                    showEditLink: !viewModel.phoneNumber.isEmpty
                )
                .focused($isPhoneFocused)
                .accessibilityIdentifier("phone_input")

                Spacer()

                // Get Started Button
                PrimaryButton(
                    title: "Get Started",
                    isLoading: viewModel.isLoading,
                    isEnabled: viewModel.canProceed && consentGiven
                ) {
                    sendOTP()
                }

                // Consent Toggle
                HStack(alignment: .top, spacing: Spacing.sm) {
                    Toggle("", isOn: $consentGiven)
                        .toggleStyle(.switch)
                        .tint(AppColors.brand500)
                        .labelsHidden()

                    Text("I consent to a one-time verification check via Cashfree to help verify my profile.")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500)
                        .lineSpacing(4)
                }
                .padding(.top, Spacing.md)

                Spacer()
                    .frame(height: Spacing.xl)
            }
            .padding(.horizontal, Spacing.screenHorizontal) // 40px
        }
        .navigationBarHidden(true)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                isPhoneFocused = true
            }
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
