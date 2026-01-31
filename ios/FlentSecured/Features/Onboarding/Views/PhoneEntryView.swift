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
    @FocusState private var isNameFocused: Bool

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

            // Decorative "Hola!" flourish - top-right per Figma (1:29108, 1:31073)
            // Positioned to align with headline area, ~140pt from top safe area
            HolaDecorativeOverlay(trailingOffset: -20, topOffset: 140)
                .opacity(showContent ? 1 : 0)

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

                // Phone Input with "Phone" label - Underline style per Figma
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    // "Phone" label + inline error (Figma: 1-31590, 1-31671)
                    HStack {
                        Text("Phone")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppColors.neutral500) // #A9A9A9

                        Spacer()

                        // Inline error message (right-aligned per Figma)
                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(AppColors.brand500) // Orange error text
                                .transition(.opacity)
                        }
                    }

                    PhoneInputFieldBox(
                        text: $viewModel.phoneNumber,
                        isFocused: isPhoneFocused,
                        hasError: viewModel.errorMessage != nil
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
                    .frame(height: Spacing.lg) // 24pt gap between Phone and Name inputs

                // Name Input with "Name" label - per Figma (1:29108, 1:31073, 1:31671)
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    // "Name" label - Figma: 12px Medium
                    Text("Name")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppColors.black300) // Gray label

                    NameInputFieldBox(
                        text: $viewModel.name,
                        isFocused: isNameFocused
                    )
                    .focused($isNameFocused)
                }
                .opacity(showContent ? 1 : 0)
                .offset(y: showContent ? 0 : 20)
                .accessibilityIdentifier("name_input")
                .accessibilityLabel("Name input")
                .accessibilityHint("Enter your full name")

                Spacer()

                // Get Started Button - Figma: above consent toggle per 1:29108
                PrimaryButton(
                    title: "Get Started",
                    isLoading: viewModel.isLoading,
                    isEnabled: viewModel.canProceed && consentGiven
                ) {
                    sendOTP()
                }
                .padding(.bottom, Spacing.md) // 16pt gap to consent
                .opacity(showContent ? 1 : 0)
                .accessibilityIdentifier("continue_button")
                .accessibilityLabel("Get Started")
                .accessibilityHint(buttonAccessibilityHint)

                // Consent Toggle - below button per Figma 1:29108
                ConsentToggleView(isOn: $consentGiven)
                    .opacity(showContent ? 1 : 0)
                    .accessibilityIdentifier("consent_toggle")

                Spacer()
                    .frame(height: Spacing.xxxl) // 48pt bottom padding per Figma
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
        } else if !viewModel.isValidPhone {
            return "Enter a valid 10-digit phone number to continue"
        } else if !viewModel.isValidName {
            return "Enter your name to continue"
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
                // Present OTP as sheet per Figma design (modal overlay)
                coordinator.present(sheet: .otpVerification(phone: viewModel.fullPhoneNumber, name: viewModel.trimmedName))
            }
        }
    }
}

// MARK: - Phone Input Field (Underline Style - Figma)

/// Phone input field with underline/transparent style per Figma spec
/// Figma Node: 1:29108, 1:31073, 1:31590, 1:31671
/// - No background (transparent)
/// - Vertical padding: 16pt
/// - Font: 20px Regular for input, #DDD placeholder, orange when error
/// - Country code: "+91" with chevron-down
/// - Underline: gray normally, orange when error
struct PhoneInputFieldBox: View {
    @Binding var text: String
    var isFocused: Bool = false
    var hasError: Bool = false

    /// Formats phone number with space after 5 digits: "98765 43210"
    private var formattedDisplay: String {
        let digits = text.filter { $0.isNumber }
        if digits.count > 5 {
            let index = digits.index(digits.startIndex, offsetBy: 5)
            return String(digits[..<index]) + " " + String(digits[index...])
        }
        return digits
    }

    /// Text color changes to orange when error (Figma: 1-31590, 1-31671)
    private var inputTextColor: Color {
        hasError ? AppColors.brand500 : AppColors.neutral200
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Input row - transparent background per Figma
            HStack(spacing: Spacing.md) {
                // Country Code Picker
                HStack(spacing: 4) {
                    Text("+91")
                        .font(.system(size: 20, weight: .regular))
                        .foregroundColor(hasError ? AppColors.brand500 : AppColors.neutral200)

                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppColors.neutral800)
                }
                .accessibilityLabel("Country code India plus 91")

                // Phone number input - Figma: 20px Regular
                ZStack(alignment: .leading) {
                    // Show formatted text when not empty
                    if !text.isEmpty {
                        Text(formattedDisplay)
                            .font(.system(size: 20, weight: .regular))
                            .foregroundColor(inputTextColor) // Orange when error
                    }

                    // Hidden text field for input
                    TextField("", text: $text)
                        .font(.system(size: 20, weight: .regular))
                        .foregroundColor(.clear) // Hide actual text, show formatted
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .tint(AppColors.brand500)
                        .onChange(of: text) { _, newValue in
                            // Limit to 10 digits
                            let digits = newValue.filter { $0.isNumber }
                            if digits.count > 10 {
                                text = String(digits.prefix(10))
                            } else {
                                text = digits
                            }
                        }

                    // Placeholder when empty - Figma: "Enter Number"
                    if text.isEmpty {
                        Text("Enter Number")
                            .font(.system(size: 20, weight: .regular))
                            .foregroundColor(AppColors.neutral800) // #444 placeholder
                    }
                }
            }
            .padding(.vertical, Spacing.md) // py-16pt per Figma

            // Underline - orange when error (Figma: 1-31590, 1-31671)
            Rectangle()
                .fill(hasError ? AppColors.brand500 : AppColors.neutral800)
                .frame(height: 1)
        }
        .animation(.easeInOut(duration: 0.2), value: isFocused)
        .animation(.easeInOut(duration: 0.2), value: hasError)
    }
}

// MARK: - Name Input Field (Underline Style - Figma)

/// Name input field with underline/transparent style per Figma spec (matching Phone input)
/// Figma Node: 1:29108, 1:31073, 1:31671
/// - No background (transparent)
/// - Vertical padding: 16pt
/// - Font: 20px Regular for input, #DDD placeholder, white for filled
/// - Placeholder: "e.g. John Appleseed"
struct NameInputFieldBox: View {
    @Binding var text: String
    var isFocused: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Input row - transparent background per Figma
            HStack(spacing: 0) {
                // Name input - Figma: 20px Regular (matching phone input)
                ZStack(alignment: .leading) {
                    // Show text when not empty
                    if !text.isEmpty {
                        Text(text)
                            .font(.system(size: 20, weight: .regular))
                            .foregroundColor(AppColors.neutral200) // #DDD for filled text
                    }

                    // Hidden text field for input
                    TextField("", text: $text)
                        .font(.system(size: 20, weight: .regular))
                        .foregroundColor(.clear) // Hide actual text, show formatted
                        .keyboardType(.default)
                        .textContentType(.name)
                        .autocapitalization(.words)
                        .disableAutocorrection(false)
                        .tint(AppColors.brand500)

                    // Placeholder when empty
                    if text.isEmpty {
                        Text("e.g. John Appleseed")
                            .font(.system(size: 20, weight: .regular))
                            .foregroundColor(AppColors.neutral800) // #444 placeholder
                    }
                }
            }
            .padding(.vertical, Spacing.md) // py-16pt per Figma
            .animation(.easeInOut(duration: 0.2), value: isFocused)
        }
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

            // Figma: "I consent to a one-time verification to confirm my profile details.
            // Verification is securely handled via Cashfree"
            (
                Text("I consent to a one-time verification to confirm my profile details. Verification is securely handled via ")
                    .foregroundColor(AppColors.black300)
                + Text("Cashfree")
                    .foregroundColor(AppColors.brand500)
                    .underline()
            )
            .font(Typography.bodySm) // 12px Regular
            .lineSpacing(4)
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
