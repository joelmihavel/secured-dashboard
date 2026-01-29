/// PhoneEntryView.swift
/// Flent Secured v2 - Phone Number Entry Screen
///
/// Figma Node IDs:
/// - 1:29108 - auth / sign up --enter phone number (Empty state)
/// - 1:31073 - auth / sign up --filled (Filled state)
/// - 1:31590 - auth / sign up --error 1
/// - 1:31671 - auth / sign up --error 2
///
/// PIXEL PERFECT from Figma screenshot (1:29108):
/// - Background: #131313 with dotted grid pattern
/// - Logo: Flent keyhole, white, top-left
/// - Headline: H1/Regular 400 (48px, line-height 64px, tracking -2px)
///   - "Let's get to" - Gray (#A9A9A9 - neutral500)
///   - "know you" - Brand (#FF9A6D - brand500)
/// - Input label: "Phone" - 14px, gray
/// - Phone input: Box style with "+91 ▼" country code + "Enter Number" placeholder
/// - Button: "Get Started" - disabled until valid phone + consent
/// - Consent: Toggle + "I consent to a identity verification via to help verify my profile and other privacy policy and TnC."
/// - Horizontal padding: 48pt (sp-48)
///
/// States:
/// - zero: Empty input field with placeholder
/// - filled: Phone number entered, Get Started enabled
/// - error_invalid: Invalid format error message
/// - error_not_found: Phone not registered error

import SwiftUI

struct PhoneEntryView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    /// Authentication intent passed from splash screen
    let authIntent: AuthIntent

    @State private var viewModel = PhoneEntryViewModel()
    @State private var consentGiven = false
    @FocusState private var isPhoneFocused: Bool

    // Animation states
    @State private var showContent = false
    @State private var shakeError = false

    // MARK: - Initialization

    init(authIntent: AuthIntent = .signup) {
        self.authIntent = authIntent
    }

    var body: some View {
        ZStack {
            // Background: #131313
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern overlay
            DottedGridPattern()
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Logo - Flent keyhole, top-left (33.375x40pt)
                FlentLogo()
                    .padding(.top, Spacing.xxl) // 40pt from safe area
                    .opacity(showContent ? 1 : 0)
                    .offset(y: showContent ? 0 : -10)

                Spacer()
                    .frame(height: Spacing.xxl) // 40pt gap (sp-40)

                // Headline - Figma H1/Regular 400
                // "Let's get to" (gray) + "know you" (brand)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Let's get to")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.neutral500) // #A9A9A9
                        .tracking(-2)
                        .lineSpacing(16) // 64 - 48 = 16

                    Text("know you")
                        .font(Typography.h1) // 48px Regular
                        .foregroundColor(AppColors.brand500) // #FF9A6D
                        .tracking(-2)
                        .lineSpacing(16)
                }
                .opacity(showContent ? 1 : 0)
                .offset(y: showContent ? 0 : 20)

                Spacer()
                    .frame(height: Spacing.xl) // 32pt gap to input

                // Phone Input with "Phone" label - Box style per Figma
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    // "Phone" label
                    Text("Phone")
                        .font(Typography.bodyMd2) // 14px Regular
                        .foregroundColor(AppColors.black300) // Gray label

                    PhoneInputFieldBox(
                        text: $viewModel.phoneNumber,
                        isFocused: isPhoneFocused,
                        hasError: viewModel.errorMessage != nil,
                        errorMessage: viewModel.errorMessage
                    )
                    .focused($isPhoneFocused)
                }
                .shake(trigger: shakeError)
                .opacity(showContent ? 1 : 0)
                .offset(y: showContent ? 0 : 20)
                .accessibilityIdentifier("phone_input")
                .accessibilityLabel("Phone number input")
                .accessibilityHint("Enter your 10-digit Indian mobile number")

                Spacer()

                // Consent Toggle - above button
                ConsentToggleView(isOn: $consentGiven)
                    .padding(.bottom, Spacing.md) // 16pt gap to button
                    .opacity(showContent ? 1 : 0)
                    .accessibilityIdentifier("consent_toggle")

                // Get Started Button - Figma: disabled until valid phone + consent
                PrimaryButton(
                    title: "Get Started",
                    isLoading: viewModel.isLoading,
                    isEnabled: viewModel.canProceed && consentGiven
                ) {
                    sendOTP()
                }
                .opacity(showContent ? 1 : 0)
                .accessibilityIdentifier("continue_button")
                .accessibilityLabel("Get Started")
                .accessibilityHint(buttonAccessibilityHint)

                Spacer()
                    .frame(height: Spacing.huge) // 64pt bottom padding (scale/64)
            }
            .padding(.horizontal, Spacing.xxxl) // 48pt horizontal (sp-48)
        }
        .navigationBarHidden(true)
        .onAppear {
            // Animate content in
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8).delay(0.1)) {
                showContent = true
            }

            // Auto-focus phone field
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                isPhoneFocused = true
            }
        }
        .onChange(of: viewModel.errorMessage) { _, newError in
            if newError != nil {
                // Trigger shake animation on error
                withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                    shakeError = true
                }
                // Reset shake trigger
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    shakeError = false
                }
                // Haptic feedback for error
                HapticManager.shared.error()
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: viewModel.errorMessage)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: viewModel.isLoading)
    }

    // MARK: - Accessibility

    private var buttonAccessibilityHint: String {
        if viewModel.isLoading {
            return "Sending verification code"
        } else if !viewModel.canProceed {
            return "Enter a valid 10-digit phone number to continue"
        } else if !consentGiven {
            return "Enable consent toggle to continue"
        }
        return "Double tap to receive verification code"
    }

    // MARK: - Actions

    private func sendOTP() {
        isPhoneFocused = false

        Task {
            let success = await viewModel.sendOTP()
            if success {
                // Haptic success feedback
                HapticManager.shared.success()
                coordinator.navigate(to: .otpVerification(phone: viewModel.fullPhoneNumber))
            }
        }
    }
}

// MARK: - Phone Input Field (Box Style)

/// Phone input field with box style per Figma spec (01_PHONE_ENTRY_SCREEN.md)
/// - Height: 56pt
/// - Corner Radius: 12pt
/// - Background: #262626
/// - Country code width: 80pt
/// - Internal padding: 16pt
/// - Font: 16pt Regular
/// - Focus border: #00C853 (brand green)
/// - Error border: #FF5252
struct PhoneInputFieldBox: View {
    @Binding var text: String
    var isFocused: Bool = false
    var hasError: Bool = false
    var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Input box
            HStack(spacing: 0) {
                // Country Code Picker - 80pt width
                HStack(spacing: Spacing.xxs) {
                    Text("+91")
                        .font(.system(size: 16, weight: .regular))
                        .foregroundColor(.white)

                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.white.opacity(0.6))
                }
                .frame(width: 80)
                .accessibilityLabel("Country code India plus 91")

                // Divider
                Rectangle()
                    .fill(Color.white.opacity(0.4))
                    .frame(width: 1, height: 24)

                // Phone number input - Figma placeholder: "Enter Number"
                TextField("Enter Number", text: $text)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundColor(.white)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    .tint(AppColors.brand500)
                    .padding(.leading, Spacing.md)
            }
            .frame(height: 56)
            .background(Color(hex: "262626"))
            .cornerRadius(Radius.md) // 12pt
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(borderColor, lineWidth: borderWidth)
            )
            .animation(.easeInOut(duration: 0.2), value: isFocused)
            .animation(.easeInOut(duration: 0.2), value: hasError)

            // Error message
            if let error = errorMessage {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.error)

                    Text(error)
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(AppColors.error)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private var borderColor: Color {
        if hasError {
            return AppColors.error // #FF5252
        } else if isFocused {
            return AppColors.brand500 // Using brand color for focus
        }
        return Color.clear // No border when not focused
    }

    private var borderWidth: CGFloat {
        (isFocused || hasError) ? 1 : 0
    }
}

// MARK: - Consent Toggle View

/// Consent toggle with descriptive text
/// Figma (1:29108): System switch with brand tint + 12px regular neutral text
/// Text: "I consent to a identity verification via to help verify my profile and other privacy policy and TnC."
struct ConsentToggleView: View {
    @Binding var isOn: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Toggle("", isOn: $isOn)
                .toggleStyle(.switch)
                .tint(AppColors.brand500) // Brand tint #FF9A6D
                .labelsHidden()
                .accessibilityLabel("Verification consent")
                .accessibilityValue(isOn ? "Enabled" : "Disabled")

            Text("I consent to a identity verification via to help verify my profile and other privacy policy and TnC.")
                .font(Typography.bodySm) // 12px Regular
                .foregroundColor(AppColors.black300) // Gray text from Figma
                .lineSpacing(4) // 20 - 12 = 8, but using 4 for tighter look
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityHidden(true) // Read as part of toggle
        }
    }
}

// MARK: - Previews

#Preview("Empty State") {
    PhoneEntryView()
        .environment(AppCoordinator())
        .environment(AppState())
}

#Preview("Filled State") {
    struct PreviewWrapper: View {
        var body: some View {
            PhoneEntryView()
                .environment(AppCoordinator())
                .environment(AppState())
        }
    }
    return PreviewWrapper()
}

#Preview("Error State") {
    struct PreviewWrapper: View {
        var body: some View {
            PhoneEntryView()
                .environment(AppCoordinator())
                .environment(AppState())
        }
    }
    return PreviewWrapper()
}

#Preview("Loading State") {
    struct PreviewWrapper: View {
        var body: some View {
            PhoneEntryView()
                .environment(AppCoordinator())
                .environment(AppState())
        }
    }
    return PreviewWrapper()
}
