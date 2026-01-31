/// OTPInputField.swift
/// Flent Secured v2 - OTP Input Component
///
/// Reusable OTP input with configurable digit count
///
/// Figma: Components / OTP Input (02_OTP_ENTRY_SCREEN.md)
/// - Box size: 48x56px (6-digit), 56x64px (4-digit legacy)
/// - Background: #262626 (empty), #1A1A1A (filled)
/// - Border: 1px #4D4D4D (normal), 2px #FF9A6D (focused), 2px #FF8080 (error)
/// - Corner radius: 12px
/// - Text: 24px SemiBold white, centered
/// - Spacing: 12px between boxes

import SwiftUI

struct OTPInputField: View {
    @Binding var otp: String
    let digitCount: Int
    var hasError: Bool = false
    var onComplete: ((String) -> Void)? = nil

    @FocusState private var focusedIndex: Int?
    @State private var cursorVisible = true

    init(
        otp: Binding<String>,
        digitCount: Int = 6,  // Default to 6 digits per Figma spec
        hasError: Bool = false,
        onComplete: ((String) -> Void)? = nil
    ) {
        self._otp = otp
        self.digitCount = digitCount
        self.hasError = hasError
        self.onComplete = onComplete
    }

    var body: some View {
        HStack(spacing: Spacing.sm) { // 12px gap
            ForEach(0..<digitCount, id: \.self) { index in
                OTPDigitBox(
                    digit: getDigit(at: index),
                    isFocused: focusedIndex == index,
                    hasError: hasError,
                    isFilled: index < otp.count,
                    cursorVisible: cursorVisible
                )
                .onTapGesture {
                    focusedIndex = index
                }
            }
        }
        .background(
            // Hidden text field for keyboard input
            TextField("", text: $otp)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($focusedIndex, equals: 0)
                .frame(width: 1, height: 1)
                .opacity(0.01)
                .onChange(of: otp) { _, newValue in
                    handleOTPChange(newValue)
                }
        )
        .onAppear {
            focusedIndex = 0
            startCursorBlink()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Enter \(digitCount)-digit verification code")
        .accessibilityValue(otp.isEmpty ? "Empty" : "\(otp.count) digits entered")
    }

    private func getDigit(at index: Int) -> String {
        guard index < otp.count else { return "" }
        let idx = otp.index(otp.startIndex, offsetBy: index)
        return String(otp[idx])
    }

    private func handleOTPChange(_ newValue: String) {
        // Filter to digits only
        let filtered = newValue.filter { $0.isNumber }

        // Limit to digit count
        let limited = String(filtered.prefix(digitCount))

        if limited != otp {
            otp = limited
        }

        // Update focus based on current length
        if limited.count < digitCount {
            focusedIndex = limited.count
        } else {
            focusedIndex = nil
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

// MARK: - Legacy 4-Digit OTP Input

/// Legacy 4-digit OTP input for backward compatibility
/// Use OTPInputField with digitCount: 6 for new implementations
struct OTPInputFieldLegacy: View {
    @Binding var otp: String
    var onComplete: ((String) -> Void)? = nil

    var body: some View {
        OTPInputField(otp: $otp, digitCount: 4, onComplete: onComplete)
    }
}

// MARK: - Previews

#Preview("6-Digit Empty") {
    VStack {
        OTPInputField(otp: .constant("")) { code in
            print("OTP entered: \(code)")
        }
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}

#Preview("6-Digit Partial") {
    VStack {
        OTPInputField(otp: .constant("123")) { code in
            print("OTP entered: \(code)")
        }
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}

#Preview("6-Digit Complete") {
    VStack {
        OTPInputField(otp: .constant("123456")) { code in
            print("OTP entered: \(code)")
        }
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}

#Preview("6-Digit Error") {
    VStack {
        OTPInputField(otp: .constant("123456"), hasError: true) { code in
            print("OTP entered: \(code)")
        }
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}
