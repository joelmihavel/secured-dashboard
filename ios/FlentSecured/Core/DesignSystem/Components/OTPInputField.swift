/// OTPInputField.swift
/// Flent Secured v2 - OTP Input Component
///
/// 4-digit OTP input with auto-focus and paste support
///
/// Figma: Components / OTP Input
/// - Box size: 56x64px
/// - Background: #202020 (black/500)
/// - Border: 1px #4D4D4D (or brand/500 when focused)
/// - Corner radius: 8px
/// - Text: 32px SemiBold white, centered
/// - Spacing: 12px between boxes

import SwiftUI

struct OTPInputField: View {
    @Binding var otp: String
    let digitCount: Int
    var onComplete: ((String) -> Void)? = nil

    @FocusState private var focusedIndex: Int?

    init(
        otp: Binding<String>,
        digitCount: Int = 4,  // Default to 4 digits per Figma
        onComplete: ((String) -> Void)? = nil
    ) {
        self._otp = otp
        self.digitCount = digitCount
        self.onComplete = onComplete
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(0..<digitCount, id: \.self) { index in
                OTPDigitBox(
                    digit: getDigit(at: index),
                    isFocused: focusedIndex == index
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
        }
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
}

// MARK: - OTP Digit Box

struct OTPDigitBox: View {
    let digit: String
    let isFocused: Bool

    var body: some View {
        ZStack {
            // Background with border
            RoundedRectangle(cornerRadius: Radius.sm)
                .fill(AppColors.black500) // #202020
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.sm)
                        .stroke(
                            isFocused ? AppColors.brand500 : AppColors.black400,
                            lineWidth: isFocused ? 2 : 1
                        )
                )

            if digit.isEmpty && isFocused {
                // Cursor animation
                Rectangle()
                    .fill(AppColors.brand500)
                    .frame(width: 2, height: 28)
                    .opacity(1)
                    .animation(
                        .easeInOut(duration: 0.5).repeatForever(autoreverses: true),
                        value: isFocused
                    )
            } else {
                // Digit text - 32px SemiBold white
                Text(digit)
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundColor(.white)
            }
        }
        .frame(width: 56, height: 64) // 56x64 per Figma
    }
}

// MARK: - Preview

#Preview {
    VStack {
        OTPInputField(otp: .constant("123")) { code in
            print("OTP entered: \(code)")
        }
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}
