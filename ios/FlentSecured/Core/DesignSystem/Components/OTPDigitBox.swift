/// OTPDigitBox.swift
/// Flent Secured v2 - OTP Digit Input Box Component
///
/// Figma Specifications (Node: 1-31175, 1-31485, 1-31380, 1-31277):
/// - Size: 64×64pt (scaled)
/// - Border radius: 8px
/// - Background (empty): #222222 (neutral900)
/// - Border (normal): #444444 (neutral800)
/// - Border (error): Red (#FF8080)
/// - Border (focused/first): White background
/// - Text: 20px Medium, placeholder #444, filled white
///
/// States:
/// - Empty: Dark background (#222), gray border (#444), "0" placeholder
/// - Focused (cursor): White background, gray border, blinking cursor
/// - Filled: Dark background, gray border, white digit
/// - Error: Dark background, red border

import SwiftUI

// MARK: - OTP Digit Box

struct OTPDigitBox: View {
    let digit: String
    let isFocused: Bool
    let hasError: Bool
    let isFilled: Bool
    let cursorVisible: Bool

    /// Box dimensions from Figma
    private let boxSize: CGFloat = 48 // Scaled from 64 for mobile
    private let cornerRadius: CGFloat = 8

    var body: some View {
        ZStack {
            // Background
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(backgroundColor)

            // Border
            RoundedRectangle(cornerRadius: cornerRadius)
                .strokeBorder(borderColor, lineWidth: hasError ? 1.5 : 1)

            // Content
            if isFocused && !isFilled {
                // Blinking cursor for focused empty box
                if cursorVisible {
                    Rectangle()
                        .fill(AppColors.neutral300)
                        .frame(width: 2, height: 24)
                }
            } else {
                // Digit or placeholder
                Text(digit.isEmpty ? "0" : digit)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(textColor)
            }
        }
        .frame(width: boxSize, height: boxSize)
        .shadow(
            color: Color.black.opacity(0.05),
            radius: 1,
            y: 1
        )
    }

    // MARK: - Computed Properties

    private var backgroundColor: Color {
        if isFocused && !isFilled {
            // Focused empty box has white background per Figma
            return .white
        }
        return AppColors.neutral900 // #222222
    }

    private var borderColor: Color {
        if hasError {
            return AppColors.error // Red border for error
        }
        if isFocused && !isFilled {
            return Color(hex: "D5D7DA") // Light gray border for focused
        }
        return AppColors.neutral800 // #444444 default
    }

    private var textColor: Color {
        if isFocused && !isFilled {
            // Placeholder in focused white box
            return Color(hex: "D5D7DA")
        }
        if isFilled {
            return .white // Filled digit is white
        }
        return AppColors.neutral800 // #444 for placeholder
    }
}

// MARK: - Preview

#Preview("OTP Digit States") {
    VStack(spacing: 20) {
        HStack(spacing: 8) {
            // Empty
            OTPDigitBox(digit: "", isFocused: false, hasError: false, isFilled: false, cursorVisible: true)
            // Focused with cursor
            OTPDigitBox(digit: "", isFocused: true, hasError: false, isFilled: false, cursorVisible: true)
            // Filled
            OTPDigitBox(digit: "5", isFocused: false, hasError: false, isFilled: true, cursorVisible: false)
        }

        HStack(spacing: 8) {
            // Error empty
            OTPDigitBox(digit: "", isFocused: false, hasError: true, isFilled: false, cursorVisible: false)
            // Error filled
            OTPDigitBox(digit: "5", isFocused: false, hasError: true, isFilled: true, cursorVisible: false)
        }
    }
    .padding()
    .background(AppColors.black600)
}
