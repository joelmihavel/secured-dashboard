/// PhoneEntryView.swift
/// Flent Secured v2 - Phone Number Entry Screen
///
/// Figma: node-id=1:29108
/// - Background: #131313 with dotted grid pattern
/// - Logo: Flent keyhole, top-left
/// - Headline: "Let's get to" (white) + "know you" (orange #FF9A6D) - 40px light
/// - Phone input: Underline style (NOT bordered box)
///   - Label: "Phone" 12px medium, #A9A9A9
///   - Country code: "+91 ▼" selector
///   - Placeholder: "Enter Number"
///   - Underline: 1px neutral, 2px brand on focus
/// - Consent toggle: System switch with brand tint
/// - Button: "Get Started" - disabled until valid phone + consent
/// - Horizontal padding: 40px

import SwiftUI

struct PhoneEntryView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = PhoneEntryViewModel()
    @State private var consentGiven = false
    @FocusState private var isPhoneFocused: Bool

    var body: some View {
        ZStack {
            // Background: #131313
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern overlay
            DottedGridPattern()
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Logo - Flent keyhole, top-left
                FlentLogo()
                    .padding(.top, Spacing.xxl) // 40pt from safe area

                Spacer()
                    .frame(height: Spacing.huge) // 64pt gap

                // Headline: 40px light weight
                VStack(alignment: .leading, spacing: 0) {
                    Text("Let's get to")
                        .font(.system(size: 40, weight: .light))
                        .foregroundColor(.white)
                    Text("know you")
                        .font(.system(size: 40, weight: .light))
                        .foregroundColor(AppColors.brand500) // #FF9A6D
                }

                Spacer()
                    .frame(height: Spacing.xxl) // 40pt gap to input

                // Phone Input - Underline style per Figma
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

                // Consent Toggle - above button per Figma flow
                HStack(alignment: .top, spacing: Spacing.sm) {
                    Toggle("", isOn: $consentGiven)
                        .toggleStyle(.switch)
                        .tint(AppColors.brand500) // Brand tint #FF9A6D
                        .labelsHidden()
                        .accessibilityIdentifier("consent_toggle")

                    Text("I consent to a one-time verification check via Cashfree to help verify my profile.")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(AppColors.neutral500) // #A9A9A9
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.bottom, Spacing.md) // 16pt gap to button

                // Get Started Button - disabled until valid phone + consent
                PrimaryButton(
                    title: "Get Started",
                    isLoading: viewModel.isLoading,
                    isEnabled: viewModel.canProceed && consentGiven
                ) {
                    sendOTP()
                }
                .accessibilityIdentifier("get_started_button")

                Spacer()
                    .frame(height: Spacing.xl) // 32pt bottom padding
            }
            .padding(.horizontal, Spacing.screenHorizontal) // 40px horizontal
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
