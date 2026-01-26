/// OTPInputField.swift
/// Flent Secured v2 - OTP Input Component
///
/// 6-digit OTP input with auto-focus and paste support
/// Figma: Onboarding / OTP Verification

import SwiftUI

struct OTPInputField: View {
    @Binding var otp: String
    let digitCount: Int
    var onComplete: ((String) -> Void)? = nil

    @FocusState private var focusedIndex: Int?

    init(
        otp: Binding<String>,
        digitCount: Int = 6,
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
            RoundedRectangle(cornerRadius: Radius.sm)
                .stroke(
                    isFocused ? AppColors.accentPrimary : (digit.isEmpty ? AppColors.border : AppColors.borderActive),
                    lineWidth: isFocused ? 2 : 1
                )
                .background(
                    RoundedRectangle(cornerRadius: Radius.sm)
                        .fill(AppColors.backgroundSecondary)
                )

            if digit.isEmpty && isFocused {
                // Cursor
                Rectangle()
                    .fill(AppColors.accentPrimary)
                    .frame(width: 2, height: 24)
                    .opacity(1)
                    .animation(
                        .easeInOut(duration: 0.5).repeatForever(autoreverses: true),
                        value: isFocused
                    )
            } else {
                Text(digit)
                    .font(Typography.amountLarge)
                    .foregroundColor(AppColors.textPrimary)
            }
        }
        .frame(width: 48, height: 56)
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
